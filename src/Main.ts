import { Client, DMChannel, Guild, Interaction, MessageComponentInteraction, MessageEmbed, MessageReaction, NewsChannel, TextChannel, User } from 'discord.js';
import schedule from 'node-schedule';
import moment from 'moment';

import * as Tracker from './Logic';
import CONFIG from './ConfigManager';
import subjects from './subjects.json';
import { connectDB, HomeworkRepository } from './DBManager';
import { logger } from './Logger';
import { IsNull, Not } from 'typeorm';

const bot = new Client({ intents: ['GUILDS', 'GUILD_MESSAGES', 'GUILD_MESSAGE_REACTIONS', 'GUILD_WEBHOOKS'] });

let announce_guild: Guild;
export let announce_channel: TextChannel;

const periods_begin: { [key: string]: string } = {
	'1': '8:30',
	'2': '9:20',
	'3': '10:20',
	'4': '11:10',
	'5': '13:00',
	'6': '14:00',
	'7': '14:50'
}

const periods_end: { [key: string]: string } = {
	'1': '9:20',
	'2': '10:10',
	'3': '11:10',
	'4': '12:00',
	'5': '13:50',
	'6': '14:50',
	'7': '15:40'
}

moment.locale('th');



async function announce(subject: typeof subjects[0], period: string, length: number) {
	let link = '';
	if (subject.msteam) link = `[Microsoft Teams Channel](${subject.msteam})`;


	const embed = new MessageEmbed({
		author: { name: 'Class started!' },
		title: `${subject.name}` + (subject.subID ? ` (${subject.subID})` : ''),
		description: `ได้เวลาของคาบ ${period} แล้ว! (${periods_begin[period]} น. - ${periods_end[+period + length - 1]} น.)\n\n${link}`,
		color: Math.floor(Math.random() * (16777215 - 0 + 1)),
	})
	logger.debug(`Announcing class ${subject.name} ${subject.subID}`)
	announce_channel.send('<@&849534560668352542>', embed).then(msg => {
		setTimeout(() => {
			msg.delete()
		}, 3600000 * length);
	})
}

async function announce_upcoming(subject: typeof subjects[0]) {
	let link = '';
	if (subject.msteam) link = `[Microsoft Teams Channel](${subject.msteam})`;
	logger.debug(`Announcing upcoming class ${subject.name} ${subject.subID}`)
	announce_channel.send(`**${subject.name} ${(subject.subID ? `(${subject.subID})` : '')}** กำลังจะเริ่มในอีก 5 นาทีครับ`).then(msg => {
		setTimeout(() => {
			msg.delete()
		}, 300000);
	})
}









bot.on('interaction', async interaction => {
	// console.log(interaction)
	const channel = interaction.channel;
	const user = interaction.user;

	if (interaction.isMessageComponent() && channel.isText()) {
		if (interaction.customID.startsWith('hw')) {
			if (channel.messages.resolve(interaction.message.id).deletable) channel.messages.resolve(interaction.message.id).delete();
			switch (interaction.customID) {
				case 'hw_list':
					logger.debug('listing from interaction')
					Tracker.list(channel)
					break;
				case 'hw_add':
					Tracker.add(user, channel)
					break;
				case 'hw_remove':
					const prompt_promise = channel.send({
						embed: { title: 'Please enter homework ID to delete.', description: '(สามารถดู ID ได้จากคำสั่ง list)' },
						components: [{
							type: 1,
							components: [{
								type: 2,
								label: 'Cancel',
								style: 4,
								customID: 'cancel_remove'
							}]
						}]
					});
					let received = false;
					const reply_promise = channel.awaitMessages(m => m.author.id == user.id, { max: 1 }).then(async collected => {
						if (received) return;
						received = true;
						const content = collected.first()?.content;
						if (content) {
							if (isNaN(+content))
								channel.send({
									embed: {
										title: 'Invalid',
										description: `Invalid homework ID: \`${content}\``,
										color: CONFIG.color.red
									}
								})
							else {
								Tracker.remove(user, channel, +content)
							}
						} else {
							channel.send({
								embed: {
									title: 'Please provide homework ID',
									description: `Usage: \`${prefix}remove ID\`\nEx: \`${prefix}remove 10\``,
									color: CONFIG.color.red
								}
							})
						}
						if ((await prompt_promise)?.deletable) (await prompt_promise).delete();
					});
					const cancel_promise = (await prompt_promise).awaitMessageComponentInteractions(i => i.user.id == user.id, { maxComponents: 1 }).then(async collected => {
						if (received) return;
						received = true;
						const interaction = collected.first();
						interaction.reply('You\'ve canceled homework deletion.')
						if ((await prompt_promise)?.deletable) (await prompt_promise).delete();
					});

					await Promise.race([reply_promise, cancel_promise]);

					break;

			}
		} if (interaction.customID.startsWith('myhw')) {
			switch (interaction.customID) {
				case 'myhw_list':
					// Tracker.add(user, channel)
					const m = await channel.send({
						embed: {
							description: '**Homework Menus**',
							color: CONFIG.color.blue,
						},
						components: [{
							type: 1,
							components: [{
								type: 2,
								label: 'List homework',
								style: 1,
								customID: 'idk'
							}]
						}]
					})
					m.awaitMessageComponentInteractions(i => i.customID == 'idk', { maxComponents: 1 }).then(collected => {
						logger.debug('tryyyyinngggg')
						m.edit({ components: [] });
					})
					break;
				case 'myhw_checka':
					Tracker.add(user, channel)
					break;
				case 'myhw_a':
					break;
			}
		}
		logger.debug(interaction.customID)
		// interaction.deferUpdate(); // remove cuz it'll already be deleted
	}
})



export const prefix = CONFIG.prefix;
bot.on('message', async msg => {
	if (msg.author.bot) return;
	// msg.channel.send('',{reply:{}})
	const [command, ...args] = msg.content.split(' ');
	const channel = msg.channel;
	const user = msg.author;


	switch (command.toLowerCase()) {
		case `${prefix}`: {
			channel.send({
				embed: {
					description: '**Homework Menus**',
					color: CONFIG.color.blue,
				},
				components: [{
					type: 1,
					components: [{
						type: 2,
						label: 'List homework',
						style: 1,
						customID: 'hw_list'
					},
					{
						type: 2,
						label: 'Add homework',
						style: 2,
						customID: 'hw_add'
					},
					{
						type: 2,
						label: 'Remove homework',
						style: 2,
						customID: 'hw_remove'
					}]
				}]
			})
			break;
		}
		case `${prefix}list`:
			Tracker.list(channel)
			break;
		case `${prefix}add`:
			Tracker.add(user, channel)
			break;
		case `${prefix}rm`:
			if (args[0]) {
				if (isNaN(+args[0]))
					channel.send(new MessageEmbed({
						title: 'Invalid',
						description: `Invalid homework ID: \`${args[0]}\``,
						color: CONFIG.color.red
					}))
				else {
					Tracker.remove(user, channel, +args[0])
				}
			} else {
				channel.send(new MessageEmbed({
					title: 'Please provide homework ID',
					description: `Usage: \`${prefix}remove ID\`\nEx: \`${prefix}remove 10\``,
					color: CONFIG.color.red
				}))
			}
			break;
		case `my${prefix}`: {
			channel.send('Homework Menu (THIS DOESN\'T WORK YET!!!) >>', {
				// embed: {
				// 	title: 'Homework Menu',
				// 	description: `**กดปุ่มด้านล่าง**\nหรือใช้คำสั่งต่อไปนี้:\n\n\`${prefix}list\`\n\`${prefix}add\`\n\`${prefix}remove ID\``,
				// 	color: CONFIG.color.blue,
				// },
				components: [{
					type: 1,
					components: [{
						type: 2,
						label: 'List my unfinished tasks',
						style: 1,
						customID: 'myhw_list'
					},
					{
						type: 2,
						label: 'Mark a task as done',
						emoji: { id: '849685283459825714', name: 'checked' },
						style: 2,
						customID: 'myhw_add'
					},
					{
						type: 2,
						label: 'Mark a task as undone',
						emoji: { id: '849697672884650065', name: 'unchecked' },
						style: 2,
						customID: 'myhw_remove'
					}]
				}]
			})
			break;
		}
	}

})







bot.once('ready', async () => {
	announce_guild = await bot.guilds.fetch(CONFIG.guildId);
	announce_channel = announce_guild.channels.resolve(CONFIG.channelId) as TextChannel;

	logger.info('Registering class schedule ...')
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
		})
	})
	logger.info('Class schedule registered.');

	const hws = await HomeworkRepository.find({ where: { dueDate: Not(IsNull()) } });
	logger.info('Registering auto-delete tasks...')
	hws.forEach(hw => {
		hw.dueDate = new Date(hw.dueDate);
		if (hw.dueTime) {
			const [hours, mins, secs] = hw.dueTime.split(':');
			hw.dueDate.setHours(+hours, +mins, +secs);
		} else {
			hw.dueDate = moment(hw.dueDate).endOf('date').toDate();
		}
		// logger.debug(`HW ${hw.id}: ${moment(hw.dueDate).fromNow()}`)
		schedule.scheduleJob(hw.dueDate, () => {
			HomeworkRepository.softDelete(hw.id);
			logger.debug(`Auto-deleted ${hw.id}`)
			announce_channel.send({
				embed: {
					title: 'Auto-deleted due to hitting deadline.',
					description: `📋 **${hw.name}** | ID: \`${hw.id}\`\n\n**Subject**: ${subjects.filter(s => s.subID == hw.subID)[0].name}${hw.detail ? `**\nDetail**: ${hw.detail}` : ''}${hw.dueDate ? `**\n\nDue**: ${moment(hw.dueDate).format(hw.dueTime ? 'lll' : 'll')} ‼` : ''}`,
					color: CONFIG.color.yellow
				}
			})
		})
	});
	logger.info('Auto-delete tasks registered.');



	// (<TextChannel>bot.channels.cache.get('853997027984539668')).send('Ready.')
})

connectDB().then(() => {
	bot.login(CONFIG.token).then(() => {
		logger.info(`Logged in to Discord as >> ${bot.user.tag} (${bot.user.id})`)
	})
})