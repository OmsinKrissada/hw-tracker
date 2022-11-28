import { logger } from './Logger';

logger.info('Initiating...');
logger.info(`Running on Node ${process.version}`);

import { Client, DMChannel, Guild, GuildChannelResolvable, Message, MessageEmbed, TextChannel } from 'discord.js';
import fs from 'fs';
import schedule from 'node-schedule';
import { execSync } from 'child_process';
import { endOfDay, subDays, subHours, format, subMinutes } from 'date-fns';
import { PrismaClient, Homework } from '@prisma/client';

import * as Tracker from './Logic';
import ConfigManager from './ConfigManager';
import { listenAPI } from './WebManager';
import { SubjectType } from './Helper';
import './WebResource';

const prisma = new PrismaClient();

// Import subjects from config file
export const subjects = function () {
	try {
		return JSON.parse(fs.readFileSync('subjects.json', 'utf-8')) as SubjectType[];
	} catch (err) {
		logger.error(`Unable to parse subjects.json: ${err}`);
		process.exit(1);
	}
}();

export const bot = new Client({ intents: ['GUILDS', 'GUILD_MESSAGES', 'GUILD_MESSAGE_REACTIONS', 'GUILD_WEBHOOKS'] });

let announce_target: Guild;
export let timetable_channel: TextChannel;
export let hw_channel: TextChannel;

const periods = [
	{ begin: null, end: null },
	{ begin: '8:30', end: '9:20' },
	{ begin: '9:20', end: '10:10' },
	{ begin: '10:20', end: '11:10' },
	{ begin: '11:10', end: '12:00' },
	{ begin: '13:00', end: '13:50' },
	{ begin: '14:00', end: '14:50' },
	{ begin: '14:50', end: '15:40' }
];

// Schedules Handling

export const deleteJobs = new Map<string, schedule.Job>();
export const remindJobs = new Map<string, { interval: string, job: schedule.Job; }[]>();

export function scheduleDeleteJobs(hw: Homework) {
	if (!hw.dueDate) throw "doesn't have dueDate";
	const formattedDate = hw.dueDate.valueOf() != endOfDay(hw.dueDate).valueOf() ? format(hw.dueDate, 'EEEEE d MMM yyyy') : 'EEEEE d MMM yyyy ';

	const reminders = [
		{
			name: '1d',
			friendlyName: '1 day',
			time: subDays(hw.dueDate, 1),
			expireDuration: (24 - 1) * 60 * 60 * 1000
		},
		{
			name: '1h',
			friendlyName: '1 hour',
			time: subHours(hw.dueDate, 1),
			expireDuration: (60 - 10) * 60 * 1000
		},
		{
			name: '10m',
			friendlyName: '10 mins',
			time: subMinutes(hw.dueDate, 10),
			expireDuration: (10 - 5) * 60 * 1000
		},
		{
			name: '5m',
			friendlyName: '5 mins',
			time: subMinutes(hw.dueDate, 5),
			expireDuration: 5 * 60 * 1000
		},
	];

	const remindJobsWithName = reminders.map(reminder => {
		const job = schedule.scheduleJob(reminder.time, () => {
			if (!ConfigManager.remind1d) return;
			logger.debug(`Remind ${reminder.friendlyName} ${hw.id}`);
			hw_channel.send({
				content: `${reminder.friendlyName} left before deadline <@&${ConfigManager.hw_role}>`,
				embeds: [{
					title: `REMINDER! - __${reminder.friendlyName.toUpperCase()} LEFT__ For`,
					description: `📕 **${hw.title}** | ID: \`${hw.id}\`\n\n**Subject**: ${hw.subId ? subjects.filter(s => s.subId == hw.subId)[0].name : 'None'}${hw.detail ? `\n**Detail**: ${hw.detail}` : ''}${hw.dueDate ? `\n\n**Due**: ${formattedDate} ‼` : ''}`,
					color: ConfigManager.color.light_yellow
				}]
			}).then(msg => setTimeout(() => {
				if (msg.deletable) msg.delete();
			}, reminder.expireDuration));
		});
		return { interval: reminder.name, job };
	});
	console.log(remindJobsWithName);
	remindJobs.set(hw.id, remindJobsWithName);

	const deleteJob = schedule.scheduleJob(hw.dueDate, async () => {
		prisma.homework.update({ where: { id: hw.id }, data: { deletedAt: new Date() } });
		logger.debug(`Auto-deleted ${hw.id}`);
		hw_channel.send({
			content: `Time's up! <@&${ConfigManager.hw_role}>`,
			embeds: [{
				title: '⏰ DEADLINE HIT',
				description: `📕 **${hw.title}** | \`${hw.id}\`\n\n**Subject**: ${hw.subId ? subjects.filter(s => s.subId == hw.subId)[0].name : 'None'}${hw.detail ? `\n**Detail**: ${hw.detail}` : ''}${hw.dueDate ? `\n\n**Due**: ${formattedDate} ‼` : ''}`,
				color: ConfigManager.color.yellow,
				footer: { text: `Added by ${hw.authorNickname ?? "Unknown"}` }
			}]
		});
	});

	if (deleteJob) deleteJobs.set(hw.id, deleteJob);
}

let previous_announce: Message;
function scheduleClassAnnounceJobs(subjects: SubjectType[]) {
	subjects.forEach(subject => {
		subject.classes.forEach(({ DoW, period, span }) => {
			const [hour, min] = periods[period].begin.split(':');
			schedule.scheduleJob(`${min} ${hour} * * ${DoW}`, () => {
				// Handle previous announce message
				if (previous_announce) previous_announce.delete();
				previous_announce = null;

				let next_period: number, next_span: number;
				const next_subject = subjects.find(_s => _s.classes.some(_c => {
					next_period = _c.period;
					next_span = _c.span;
					return _c.DoW == DoW && _c.period == period + span;
				}));

				// Construct embed message
				const embed = new MessageEmbed({
					title: `<:join_arrow:845520716715917314>  ${subject.name}` + (subject.subId ? ` (${subject.subId})` : ''),
					description: `ได้เวลาของคาบ ${period} แล้ว! (${periods[period].begin} - ${periods[period + span - 1].end} น.)\n\n`,
					color: ConfigManager.color.aqua,
				});
				if (next_subject) {
					embed.addField('🔺 Next Subject', `${next_subject.name} (${periods[next_period].begin} - ${periods[next_period + next_span - 1].end} น.)`);
				}

				// Send embed message
				logger.debug(`Announcing class ${subject.name} ${subject.subId}`);
				timetable_channel.send({
					content: `เริ่มคาบ ${subject.name} แล้ว <@&${ConfigManager.timetable_role}>`,
					embeds: [embed]
				}).then(msg => {
					previous_announce = msg;
					setTimeout(() => {
						if (next_subject) {
							const over_embed = new MessageEmbed({
								title: '<:idle:845520741315510284>  BREAK TIME',
								color: ConfigManager.color.aqua,
								fields: [{ name: '🔺 Next Subject', value: `${next_subject.name} (${periods[next_period].begin} - ${periods[next_period + next_span - 1].end} น.)` }]
							});
							msg.edit({
								embeds: [over_embed]
							});
						} else {
							msg.delete();
						}
					}, 2400000 * span);
				});
			});
			schedule.scheduleJob(`${+min >= 5 ? +min - 5 : 60 - 5 + +min} ${+min >= 5 ? hour : +hour - 1} * * ${DoW}`, () => {
				logger.debug(`Announcing upcoming class ${subject.name} ${subject.subId}`);
				timetable_channel.send(`**${subject.name} ${(subject.subId ? `(${subject.subId})` : '')}** กำลังจะเริ่มในอีก 5 นาทีครับ`).then(msg => {
					setTimeout(() => {
						msg.delete();
					}, 300000);
				});
			});
		});
	});
}

// Bot Events

bot.once('ready', async () => {
	process.on('SIGTERM', gracefulExit);
	process.on('SIGINT', gracefulExit);

	bot.user.setPresence({ activities: [{ name: `/hw`, type: 'LISTENING' }] });

	announce_target = await bot.guilds.fetch(ConfigManager.guildId);
	timetable_channel = announce_target.channels.resolve(ConfigManager.timetableChannelId) as TextChannel;
	hw_channel = announce_target.channels.resolve(ConfigManager.hwChannelId) as TextChannel;

	// Register class start notification from subject.json
	if (!ConfigManager.pause_announce) {
		logger.info('Registering class schedule ...');
		scheduleClassAnnounceJobs(subjects);
		logger.info('Class schedule registered.');
	}

	// Register homework schedule with given due dates
	const hws = await prisma.homework.findMany({
		where: {
			dueDate: { not: null },
		},
	});
	logger.info('Registering auto-delete task(s) ...');
	hws.forEach(hw => {
		scheduleDeleteJobs(hw);
	});
	logger.info(`${deleteJobs.size} Auto-delete task(s) registered.`);

	// Set bot interaction commands
	ConfigManager.update_commands && bot.application.commands.set([{
		name: 'hw',
		description: 'Opens homework menu.',
	},
	{
		name: 'list',
		description: 'Lists all homework.',
	},
	{
		name: 'listid',
		description: 'Lists all homework with their ID.'
	},
	{
		name: 'listall',
		description: 'Lists all homework including auto deleted ones.'
	},
	{
		name: 'add',
		description: 'Adds a task to global homework list.',
	},
	{
		name: 'remove',
		description: 'Deletes a task from global homework list. (Find ID from "/listid" command)',
		options: [{ type: 'INTEGER', description: 'Homework ID', name: 'id', required: true }],
	},
	{
		name: 'toggle',
		description: 'Toggles between global and local(server-specific) list.',
	}], ConfigManager.dev_mode ? ConfigManager.guildId : undefined).then(() => logger.info('Slash-commands registered.'));
});

bot.on('interactionCreate', async interaction => {
	if (!interaction.channel.isText()) return;

	if (interaction.isCommand()) {
		if (interaction.channel instanceof DMChannel) return; // Does not support DM yet
		if (!interaction.guild.me.permissionsIn(<GuildChannelResolvable>interaction.channel).has('VIEW_CHANNEL')) {
			interaction.reply({ content: 'I do not have `VIEW_CHANNEL` permission on this channel! Please try using other channels or contacting a server admin.', ephemeral: true });
			logger.warn('Detected command usage on a channel without `VIEW_CHANNEL` permission.');
			return;
		}
		switch (interaction.commandName) {
			case 'hw': {
				interaction.reply({
					embeds: [{
						title: `M.6/1 Homework Menu`,
						description: `Thank you for using my homework bot! 😄\n\n` +
							`📰 **NEW!** Web Dashboard\n\n` +
							`📕 <:join_arrow:845520716715917314> < 1 วัน\n` +
							`📙 <:join_arrow:845520716715917314> ≤ 3 วัน\n` +
							`📗 <:join_arrow:845520716715917314> > 3 วัน\n` +
							`📘 <:join_arrow:845520716715917314> ไม่ได้ระบุวันส่ง\n\n` +
							`<:github_white:880034279990640680> [**Source code**](https://github.com/OmsinKrissada/hw-tracker/)`,
						footer: { text: `Commit — ${execSync('git rev-parse HEAD').toString().slice(0, 7)}` },
						color: ConfigManager.color.blue,
					}],
					components: [{
						type: 'ACTION_ROW',
						components: [{
							type: 'BUTTON',
							label: '📚 List',
							style: 'PRIMARY',
							customId: 'hw_list'
						},
						{
							type: 'BUTTON',
							label: 'Web App',
							emoji: '✨',
							style: 'LINK',
							url: 'https://hw.krissada.com/dashboard#creation-form'
						}]
					},
					]
				});
				break;
			}
			case 'list': {
				logger.debug('listing from command');
				Tracker.list(interaction);
				break;
			}
			case 'listid':
				Tracker.list(interaction, { showID: true });
				break;
			case 'listall':
				Tracker.list(interaction, { showID: true, showDeleted: true });
				break;
			case 'add': {
				Tracker.add(interaction);
				break;
			}
		}
	}

	if (interaction.isButton()) {
		if (interaction.customId.startsWith('hw')) {
			switch (interaction.customId) {
				case 'hw_list':
					logger.debug('listing from button');
					await Tracker.list(interaction);
					interaction.deferUpdate();
					break;
				case 'hw_add':
					interaction.deferUpdate();
					Tracker.add(interaction);
					break;
			}
		}
	} else if (interaction.isSelectMenu()) {
		// console.debug(interaction);
	}
});

bot.login(ConfigManager.discord.token).then(() => {
	logger.info(`Logged-in to Discord as ${bot.user.tag} [ID: ${bot.user.id}]`);
	listenAPI();
});

function gracefulExit(signal: NodeJS.Signals) {
	logger.warn(`Graceful shutdown triggered by "${signal}".`);
	bot.destroy();
	logger.warn('Successfully destroyed the bot instance.');
	process.exit();
}