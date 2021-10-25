import fs from 'fs';
import { logger } from './Logger';

logger.info('Initiating ...');
logger.info(`Running on Node ${process.version}`);

export const subjects = function () {
	try {
		return JSON.parse(fs.readFileSync('subjects.json', 'utf-8')) as Subject[];
	} catch (err) {
		logger.error(`Unable to parse subjects.json: ${err}`);
		process.exit(1);
	}
}();

import { Client, DMChannel, Guild, GuildChannelResolvable, Message, MessageEmbed, MessageEmbedOptions, TextChannel } from 'discord.js';
import schedule from 'node-schedule';
import moment from 'moment-timezone';
import jwt from 'jsonwebtoken';

import * as Tracker from './Logic';
import ConfigManager from './ConfigManager';
import { connectDB, GuildDataRepository, HomeworkRepository } from './DBManager';
import { IsNull, Not } from 'typeorm';
import { appendTime, Subject } from './Helper';
import { Homework } from './models/Homework';

if (ConfigManager.web.enable) import('./Web');

export const bot = new Client({ intents: ['GUILDS', 'GUILD_MESSAGES', 'GUILD_MESSAGE_REACTIONS', 'GUILD_WEBHOOKS'] });

let announce_guild: Guild;
export let announce_channel: TextChannel;

const periods_begin: { [key: string]: string; } = {
	'1': '8:30',
	'2': '9:20',
	'3': '10:10',
	'4': '11:00',
	'5': '12:40',
	'6': '13:30',
	'7': '14:20'
};

const periods_end: { [key: string]: string; } = {
	'1': '9:10',
	'2': '10:00',
	'3': '10:50',
	'4': '11:40',
	'5': '13:20',
	'6': '14:10',
	'7': '15:00'
};

moment.locale('en');
moment.tz.setDefault('Asia/Bangkok');



async function announce(subject: typeof subjects[0], period: string, length: number) {
	let link = '';
	if (subject.msteam) link = `[Microsoft Teams Channel](${subject.msteam})`;


	const embed = new MessageEmbed({
		title: `${subject.name}` + (subject.subID ? ` (${subject.subID})` : ''),
		description: `ได้เวลาของคาบ ${period} แล้ว! (${periods_begin[period]} น. - ${periods_end[+period + length - 1]} น.)\n\n${link}`,
		color: ConfigManager.color.aqua,
	});
	logger.debug(`Announcing class ${subject.name} ${subject.subID}`);
	announce_channel.send({
		content: `เริ่มคาบ ${subject.name} แล้ว <@&${ConfigManager.subscriber_role}>`,
		embeds: [embed]
	}).then(msg => {
		setTimeout(() => {
			msg.delete();
		}, 3600000 * length);
	});
}

async function announce_upcoming(subject: typeof subjects[0]) {
	let link = '';
	if (subject.msteam) link = `[Microsoft Teams Channel](${subject.msteam})`;
	logger.debug(`Announcing upcoming class ${subject.name} ${subject.subID}`);
	announce_channel.send(`**${subject.name} ${(subject.subID ? `(${subject.subID})` : '')}** กำลังจะเริ่มในอีก 5 นาทีครับ`).then(msg => {
		setTimeout(() => {
			msg.delete();
		}, 300000);
	});
}

export function scheduleDeleteJobs(hw: Homework) {
	hw.dueDate = new Date(hw.dueDate);
	if (hw.dueTime) {
		hw.dueDate = appendTime(hw.dueDate, hw.dueTime);
	} else {
		hw.dueDate = moment(hw.dueDate).endOf('date').toDate();
	}

	const remind1dJob = schedule.scheduleJob(moment(hw.dueDate).subtract(1, 'd').toDate(), () => {
		if (!ConfigManager.remind1d) return;
		logger.debug(`Remind 1 day ${hw.id}`);
		announce_channel.send({
			content: `1 day left before deadline <@&${ConfigManager.subscriber_role}>`,
			embeds: [{
				title: 'REMINDER! - __1 DAY LEFT__ For',
				description: `📕 **${hw.name}** | ID: \`${hw.id}\`\n\n**Subject**: ${subjects.filter(s => s.subID == hw.subID)[0].name}${hw.detail ? `\n**Detail**: ${hw.detail}` : ''}${hw.dueDate ? `\n\n**Due**: ${moment(hw.dueDate).format(hw.dueTime ? 'LLL' : 'LL')} ‼` : ''}`,
				color: ConfigManager.color.light_yellow
			}]
		}).then(msg => setTimeout(() => {
			if (!msg.deleted && msg.deletable) msg.delete();
		}, (24 - 1) * 60 * 60 * 1000));
	});
	const remind1hJob = schedule.scheduleJob(moment(hw.dueDate).subtract(1, 'h').toDate(), () => {
		if (!ConfigManager.remind1hr) return;
		logger.debug(`Remind 1 hour ${hw.id}`);
		announce_channel.send({
			content: `1 hour left before deadline <@&${ConfigManager.subscriber_role}>`,
			embeds: [{
				title: 'REMINDER! - __1 HOUR LEFT__ For',
				description: `📕 **${hw.name}** | ID: \`${hw.id}\`\n\n**Subject**: ${subjects.filter(s => s.subID == hw.subID)[0].name}${hw.detail ? `\n**Detail**: ${hw.detail}` : ''}${hw.dueDate ? `\n\n**Due**: ${moment(hw.dueDate).format(hw.dueTime ? 'LLL' : 'LL')} ‼` : ''}`,
				color: ConfigManager.color.light_yellow
			}]
		}).then(msg => setTimeout(() => {
			if (!msg.deleted && msg.deletable) msg.delete();
		}, (60 - 10) * 60 * 1000));
	});
	const remind10mJob = schedule.scheduleJob(moment(hw.dueDate).subtract(10, 'm').toDate(), () => {
		if (!ConfigManager.remind10m) return;
		logger.debug(`Remind 10 mins ${hw.id}`);
		announce_channel.send({
			content: `10 mins left before deadline <@&${ConfigManager.subscriber_role}>`,
			embeds: [{
				title: 'REMINDER! - __10 MINS LEFT__ For',
				description: `📕 **${hw.name}** | ID: \`${hw.id}\`\n\n${hw.detail ? `**Detail**: ${hw.detail}\n` : ''}**Subject**: ${subjects.filter(s => s.subID == hw.subID)[0].name}${hw.dueDate ? `\n\n**Due**: ${moment(hw.dueDate).format(hw.dueTime ? 'LLL' : 'LL')} ‼` : ''}`,
				color: ConfigManager.color.light_yellow
			}]
		}).then(msg => setTimeout(() => {
			if (!msg.deleted && msg.deletable) msg.delete();
		}, (10 - 5) * 60 * 1000));
	});
	const remind5mJob = schedule.scheduleJob(moment(hw.dueDate).subtract(5, 'm').toDate(), () => {
		if (!ConfigManager.remind5m) return;
		logger.debug(`Remind 5 mins ${hw.id}`);
		announce_channel.send({
			content: `5 mins left before deadline <@&${ConfigManager.subscriber_role}>`,
			embeds: [{
				title: 'REMINDER! - __5 MINS LEFT__ For',
				description: `📕 **${hw.name}** | ID: \`${hw.id}\`\n\n${hw.detail ? `**Detail**: ${hw.detail}\n` : ''}**Subject**: ${subjects.filter(s => s.subID == hw.subID)[0].name}${hw.dueDate ? `\n\n**Due**: ${moment(hw.dueDate).format(hw.dueTime ? 'LLL' : 'LL')} ‼` : ''}`,
				color: ConfigManager.color.light_yellow
			}]
		}).then(msg => setTimeout(() => {
			if (!msg.deleted && msg.deletable) msg.delete();
		}, 5 * 60 * 1000));
	});
	const deleteJob = schedule.scheduleJob(hw.dueDate, () => {
		HomeworkRepository.softDelete(hw.id);
		logger.debug(`Auto-deleted ${hw.id}`);
		announce_channel.send({
			content: `Time's up! <@&${ConfigManager.subscriber_role}>`,
			embeds: [{
				title: '⏰ DEADLINE HIT',
				description: `📕 **${hw.name}** | ID: \`${hw.id}\`\n\n**Subject**: ${subjects.filter(s => s.subID == hw.subID)[0].name}${hw.detail ? `\n**Detail**: ${hw.detail}` : ''}${hw.dueDate ? `\n\n**Due**: ${moment(hw.dueDate).format(hw.dueTime ? 'LLL' : 'LL')} ‼` : ''}`,
				color: ConfigManager.color.yellow,
				footer: { text: `Added by ${bot.users.resolve(hw.author).tag}` }
			}]
		});
	});

	if (remind1dJob) remind1dJobs.set(hw.id, remind1dJob);
	if (remind1hJob) remind1hJobs.set(hw.id, remind1hJob);
	if (remind5mJob) remind5mJobs.set(hw.id, remind5mJob);
	if (remind10mJob) remind10mJobs.set(hw.id, remind10mJob);
	if (deleteJob) deleteJobs.set(hw.id, deleteJob);
}






bot.once('ready', async () => {
	process.on('SIGTERM', gracefulExit);
	process.on('SIGINT', gracefulExit);

	bot.user.setPresence({ activities: [{ name: `/hw`, type: 'LISTENING' }] });

	announce_guild = await bot.guilds.fetch(ConfigManager.guildId);
	announce_channel = announce_guild.channels.resolve(ConfigManager.channelId) as TextChannel;

	// Register class start notification from subject.json
	if (!ConfigManager.pause_announce) {
		logger.info('Registering class schedule ...');
		subjects.forEach(subject => {
			subject.classes.forEach(c => {
				const [DoW, period, l] = c.split(' ');
				const length = l ? +l : 1;
				const [hour, min] = periods_begin[period].split(':');
				schedule.scheduleJob(`${min} ${hour} * * ${DoW}`, () => {
					announce(subject, period, length);
				});
				schedule.scheduleJob(`${+min >= 5 ? +min - 5 : 60 - 5 + +min} ${+min >= 5 ? hour : +hour - 1} * * ${DoW}`, () => {
					announce_upcoming(subject);
				});
			});
		});
		logger.info('Class schedule registered.');
	}

	// Register class schedule with given due dates
	const hws = await HomeworkRepository.find({ where: { dueDate: Not(IsNull()), guild: 'GLOBAL' } });
	logger.info('Registering auto-delete task(s) ...');
	hws.forEach(hw => {
		scheduleDeleteJobs(hw);
	});
	logger.info(`${deleteJobs.size} Auto-delete task(s) registered.`);

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
	const channel = interaction.channel;
	const user = interaction.user;


	if (interaction.isCommand()) {
		// console.log(interaction);
		if (interaction.channel instanceof DMChannel) return; // Not supporting DM yet
		if (!interaction.guild.me.permissionsIn(<GuildChannelResolvable>interaction.channel).has('VIEW_CHANNEL')) {
			interaction.reply({ content: 'I do not have `VIEW_CHANNEL` permission on this channel! Please try using other channels or contacting a server admin.', ephemeral: true });
			logger.warn('Detected command usage on a channel without `VIEW_CHANNEL` permission.');
			return;
		}
		switch (interaction.commandName) {
			case 'hw': {
				let useLocal: boolean;
				try {
					useLocal = (await GuildDataRepository.findOne({ id: interaction.guild.id }))?.useLocal;
				} catch (err) {
					logger.warn('Failed to read from database');
					const embed: MessageEmbedOptions = {
						description: `**Cannot read from database**:\n${err}`,
						color: ConfigManager.color.red
					};
					interaction.reply({ embeds: [embed] });
					return;
				};

				interaction.reply({
					embeds: [{
						title: `Homework Menu ${useLocal ? '(LOCAL MODE)' : ''}`,
						description: `Thank you for using my homework bot! 😄\nHere is the navigation menu. 👇\n\n` +
							`📕 <:join_arrow:845520716715917314> < 1 วัน\n` +
							`📙 <:join_arrow:845520716715917314> ≤ 3 วัน\n` +
							`📗 <:join_arrow:845520716715917314> > 3 วัน\n` +
							`📘 <:join_arrow:845520716715917314> ไม่ได้ระบุวันส่ง\n\n` +
							`Try \`/list\`, \`/add\` or \`/remove\`!\n\n`,
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
							label: '➕ Add',
							style: 'LINK',
							url: `https://discord.com/api/oauth2/authorize?client_id=${bot.application.id}&redirect_uri=${encodeURIComponent(ConfigManager.web.endpoint + '/add/redirect')}&response_type=code&scope=identify&prompt=none&state=${Buffer.from(JSON.stringify({
								guild: interaction.guild.id,
								channel: interaction.channel.id,
								isLocal: (await GuildDataRepository.findOne(interaction.guild.id))?.useLocal
							})).toString('base64url')}`
						},
						{
							type: 'BUTTON',
							label: '➖ Remove',
							style: 'SECONDARY',
							customId: 'hw_remove'
						}]
					}, {
						type: 'ACTION_ROW',
						components: [
							{
								type: 'BUTTON',
								label: 'Google Data Studio',
								emoji: '<:gds:880037684427509770>',
								style: 'LINK',
								url: 'https://omsinkrissada.sytes.net/homework/'
							},
							{
								type: 'BUTTON',
								label: 'GitHub',
								emoji: '<:github_white:880034279990640680>',
								style: 'LINK',
								url: 'https://github.com/OmsinKrissada/hw-tracker/'
							},]
					}]
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
			case 'remove': {
				// interaction.reply({
				// 	embeds: [{
				// 		description: 'Testing new awesome feature'
				// 	}],
				// 	components: [{
				// 		type: 'ACTION_ROW',
				// 		components: [{
				// 			type: 'SELECT_MENU',
				// 			placeholder: 'Choose homework to delete',
				// 			options: [{ label: 'Label', value: 'Value', default: false, description: 'description', emoji: '🎓' }],
				// 			customId: 'customId'
				// 		}]
				// 	}]
				// });
				// break;
				const id = interaction.options.get('id').value as number;
				Tracker.remove(interaction, id);
				break;
			}
			case 'toggle': {
				let useLocal = (await GuildDataRepository.findOne(interaction.guild.id))?.useLocal;
				GuildDataRepository.save({ id: interaction.guild.id, useLocal: !useLocal });
				interaction.reply(`Changed homework source to: \`${!useLocal ? 'LOCAL' : 'GLOBAL'}\``);
				logger.debug(`Guild<${interaction.guild.id}> Changed source mode to ${!useLocal ? 'LOCAL' : 'GLOBAL'}`);
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
					if (!ConfigManager.web.enable) {
						interaction.deferUpdate();
						Tracker.add(interaction);
					} else {
						let useLocal = (await GuildDataRepository.findOne(interaction.guild.id))?.useLocal;
						const token = jwt.sign({
							guild: interaction.guild.id,
							channel: interaction.channel.id,
							isLocal: useLocal,
							issuer: {
								id: interaction.user.id,
								tag: interaction.user.tag, avatarURL: interaction.user.displayAvatarURL()
							}
						}, ConfigManager.web.jwt_secret);
						const add_url = `${ConfigManager.web.endpoint}?token=${encodeURIComponent(token)}`;
						interaction.reply({
							embeds: [{
								description: `Please continue on web using ${add_url}\nor continue with old method using \`/add\``,
								color: ConfigManager.color.aqua
							}],
							ephemeral: true
						});
						(<Message>interaction.message).delete();
					}
					break;
				case 'hw_remove':
					interaction.update({
						embeds: [{ title: 'Please enter homework ID to delete.', description: '(ID คือเลขหลังชื่อการบ้านในในคำสั่ง \`/listid\`)' }],
						components: [{
							type: 'ACTION_ROW',
							components: [{
								type: 'BUTTON',
								label: 'Cancel',
								style: 'DANGER',
								customId: 'cancel_remove'
							}]
						}]
					});
					let received = false;
					const reply_promise = channel.awaitMessages({ filter: m => m.author.id == user.id, max: 1 }).then(async collected => {
						if (received) return;
						received = true;
						const content = collected.first()?.content;
						if (content) {
							if (isNaN(+content))
								(interaction.message as Message).edit({
									embeds: [{
										title: 'Invalid',
										description: `Invalid homework ID: \`${content}\``,
										color: ConfigManager.color.red
									}],
									components: []
								});
							else {
								Tracker.remove(interaction, +content);
							}
						} else {
							(interaction.message as Message).edit({
								embeds: [{
									title: 'Please provide homework ID',
									description: `Usage: \`/remove ID\`\nEx: \`/remove 10\``,
									color: ConfigManager.color.red
								}],
								components: []
							});
						}
						if (collected.first().deletable) collected.first().delete();
					});

					const cancel_promise = (<Message>interaction.message).awaitMessageComponent({ filter: i => i.user.id == user.id }).then(async interaction => {
						if (received) return;
						received = true;
						interaction.update({ content: 'You\'ve canceled homework deletion.', embeds: [], components: [] });
					});

					await Promise.race([reply_promise, cancel_promise]);

					break;


			}
		}
		// logger.debug(interaction.customId);
	} else if (interaction.isSelectMenu()) {
		// console.debug(interaction);
	}
});


export const deleteJobs = new Map<number, schedule.Job>();
export const remind1dJobs = new Map<number, schedule.Job>();
export const remind1hJobs = new Map<number, schedule.Job>();
export const remind10mJobs = new Map<number, schedule.Job>();
export const remind5mJobs = new Map<number, schedule.Job>();

connectDB().then(() => {
	bot.login(ConfigManager.discord.token).then(() => {
		logger.info(`Logged in to Discord as >> ${bot.user.tag} (${bot.user.id})`);
	});
});

function gracefulExit(signal: NodeJS.Signals) {
	logger.warn('Please debug the program if this wasn\'t your intention.');
	logger.info(`Graceful shutdown initiated with "${signal}".`);
	bot.destroy();
	logger.info('Successfully destroyed the bot instance.');
	process.exit();
}