import { Client, Guild, Message, MessageEmbed, TextChannel } from 'discord.js';
import schedule from 'node-schedule';
import moment from 'moment-timezone';

import * as Tracker from './Logic';
import ConfigManager from './ConfigManager';
import subjects from './subjects.json';
import { connectDB, HomeworkRepository } from './DBManager';
import { logger } from './Logger';
import { IsNull, Not } from 'typeorm';
import { appendTime } from './Helper';

const bot = new Client({ intents: ['GUILDS', 'GUILD_MESSAGES', 'GUILD_MESSAGE_REACTIONS', 'GUILD_WEBHOOKS'] });

let announce_guild: Guild;
export let announce_channel: TextChannel;

const periods_begin: { [key: string]: string; } = {
	'1': '8:30',
	'2': '9:20',
	'3': '10:20',
	'4': '11:10',
	'5': '13:00',
	'6': '14:00',
	'7': '14:50'
};

const periods_end: { [key: string]: string; } = {
	'1': '9:20',
	'2': '10:10',
	'3': '11:10',
	'4': '12:00',
	'5': '13:50',
	'6': '14:50',
	'7': '15:40'
};

moment.locale('th');
moment.tz.setDefault('Asia/Bangkok');



async function announce(subject: typeof subjects[0], period: string, length: number) {
	let link = '';
	if (subject.msteam) link = `[Microsoft Teams Channel](${subject.msteam})`;


	const embed = new MessageEmbed({
		author: { name: 'Class started!' },
		title: `${subject.name}` + (subject.subID ? ` (${subject.subID})` : ''),
		description: `ได้เวลาของคาบ ${period} แล้ว! (${periods_begin[period]} น. - ${periods_end[+period + length - 1]} น.)\n\n${link}`,
		color: Math.floor(Math.random() * (16777215 - 0 + 1)),
	});
	logger.debug(`Announcing class ${subject.name} ${subject.subID}`);
	announce_channel.send({
		content: `<@&${ConfigManager.subscriber_role}>`,
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
	const hws = await HomeworkRepository.find({ where: { dueDate: Not(IsNull()) } });
	logger.info('Registering auto-delete task(s) ...');
	let adtCount = 0; // adt = auto-delete task
	hws.forEach(hw => {
		hw.dueDate = new Date(hw.dueDate);
		if (hw.dueTime) {
			hw.dueDate = appendTime(hw.dueDate, hw.dueTime);
		} else {
			hw.dueDate = moment(hw.dueDate).endOf('date').toDate();
		}
		const job = schedule.scheduleJob(hw.dueDate, () => {
			HomeworkRepository.softDelete(hw.id);
			logger.debug(`Auto-deleted ${hw.id}`);
			announce_channel.send({
				embeds: [{
					title: 'หมดเวลาส่งงานสำหรับ',
					description: `📋 **${hw.name}** | ID: \`${hw.id}\`\n\n**Subject**: ${subjects.filter(s => s.subID == hw.subID)[0].name}${hw.detail ? `**\nDetail**: ${hw.detail}` : ''}${hw.dueDate ? `**\n\nDue**: ${moment(hw.dueDate).format(hw.dueTime ? 'lll' : 'll')} ‼` : ''}`,
					color: ConfigManager.color.yellow
				}]
			});
		});
		autoDeleteJobs.set(hw.id, job);
		adtCount++;
	});
	logger.info(`${adtCount} Auto-delete task(s) registered.`);

	bot.application.commands.set([{
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
	}], ConfigManager.dev_mode ? ConfigManager.guildId : undefined).then(() => logger.info('Slash-commands registered.'));
});

bot.on('interactionCreate', async interaction => {
	if (!interaction.channel.isText()) return;
	const channel = interaction.channel;
	const user = interaction.user;


	if (interaction.isCommand()) {
		// console.log(interaction);
		switch (interaction.commandName) {
			case 'hw': {
				interaction.reply({
					embeds: [{
						title: 'Homework Menu',
						description: `Thank you for using my Homework Tracker bot! 😄\nHere is the navigation menu. 👇\n\n` +
							`📕 <:join_arrow:845520716715917314> เหลืออีก 1 วัน\n` +
							`📙 <:join_arrow:845520716715917314> เหลืออีก 3 วัน\n` +
							`📗 <:join_arrow:845520716715917314> เหลือมากกว่า 3 วัน\n` +
							`📘 <:join_arrow:845520716715917314> ไม่ได้ระบุวันส่ง\n\n` +
							`Also available using \`/list\`, \`/add\` or \`/remove\`!\n\n` +
							`[Web version (BETA)](https://omsinkrissada.sytes.net/homework)\n[Source code](https://github.com/OmsinKrissada/hw-tracker)`,
						color: ConfigManager.color.blue,
					}],
					components: [{
						type: 'ACTION_ROW',
						components: [{
							type: 'BUTTON',
							label: 'List homework',
							style: 'PRIMARY',
							customId: 'hw_list'
						},
						{
							type: 'BUTTON',
							label: '➕ Add',
							style: 'SECONDARY',
							customId: 'hw_add'
						},
						{
							type: 'BUTTON',
							label: '➖ Remove',
							style: 'SECONDARY',
							customId: 'hw_remove'
						}]
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


export const autoDeleteJobs = new Map<number, schedule.Job>();

connectDB().then(() => {
	bot.login(ConfigManager.token).then(() => {
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