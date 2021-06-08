import { Client, DMChannel, Guild, Interaction, MessageComponentInteraction, MessageEmbed, MessageReaction, NewsChannel, TextChannel, User } from 'discord.js';
import schedule from 'node-schedule';
import moment from 'moment';

import * as Tracker from './Tracker';
import CONFIG from './ConfigManager';
import subjects from './subjects.json';

const bot = new Client({ intents: ['GUILDS', 'GUILD_MESSAGES', 'GUILD_MESSAGE_REACTIONS', 'GUILD_WEBHOOKS'] });

let announce_guild: Guild;
let announce_channel: TextChannel;

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



async function announce(subject: typeof subjects[0], period: string) {
	let link = '';
	if (subject.msteam) link = `[Microsoft Teams Channel](${subject.msteam})`;
	const embed = new MessageEmbed({
		author: { name: 'Class started' },
		title: `${subject.name}` + (subject.subID ? `(${subject.subID})` : ''),
		description: `คาบ ${period} เริ่มแล้ว! (${periods_begin[period]} น. - ${periods_end[period]} น.)\n\n${link}`,
		color: Math.floor(Math.random() * (16777215 - 0 + 1)) + 0,
	})
	announce_channel.send('<@&849534560668352542>', embed).then(msg => {
		setTimeout(() => {
			msg.delete()
		}, 3600000);
	})
}

async function announce_upcoming(subject: typeof subjects[0], period: string) {
	let link = '';
	if (subject.msteam) link = `[Microsoft Teams Channel](${subject.msteam})`;
	// const embed = new MessageEmbed({
	// 	author: { name: '🔺 Upcoming class' },
	// 	title: `${subject.name}` + (subject.subID ? `(${subject.subID})` : ''),
	// 	description: `คาบ ${period} กำลังจะเริ่ม! (${periods_begin[period]} น. - ${periods_end[period]} น.)\n\n${link}`,
	// 	color: Math.floor(Math.random() * (16777215 - 0 + 1)) + 0,
	// })
	// channel.send('<@&849534560668352542>', embed).then(msg => {
	// 	msg.delete({ timeout: 300000 })
	// })
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

	if (interaction.isMessageComponent() && interaction.customID.startsWith('hw') && channel.isText()) {
		// interaction.reply('reply', { ephemeral: true });
		console.log(interaction.customID)
		// interaction.defer();
		interaction.deferUpdate();
		if (channel.messages.resolve(interaction.message.id).deletable) channel.messages.resolve(interaction.message.id).delete();
		switch (interaction.customID) {
			case 'hw_list':
				console.log('listing')
				Tracker.list(channel)
				break;
			case 'hw_add':
				Tracker.add(user, channel)
				break;
			case 'hw_remove':
				await channel.send('Please enter homework ID to delete.');
				const content = (await channel.awaitMessages(m => m.author.id == user.id, { maxProcessed: 1 })).first()?.content;
				if (content) {
					if (isNaN(+content))
						channel.send(new MessageEmbed({
							title: 'Not Found',
							description: `Invalid homework ID: \`${content}\``,
							color: CONFIG.color.red
						}))
					else {
						Tracker.remove(user, channel, +content)
					}
				} else {
					channel.send(new MessageEmbed({
						title: 'Please provide homework ID',
						description: `Usage: \`${prefix}remove ID\`\nEx: \`${prefix}remove 10\``,
						color: CONFIG.color.red
					}))
				}
				break;
		}
	}
})



export const prefix = 'hw';
bot.on('message', async msg => {
	if (msg.author.bot || !msg.content.startsWith(prefix)) return;
	// msg.channel.send('',{reply:{}})
	const [command, ...args] = msg.content.slice(prefix.length).split(' ');
	const channel = msg.channel;
	const user = msg.author;


	switch (command.toLowerCase()) {
		case 'list':
			Tracker.list(channel)
			break;
		case 'add':
			Tracker.add(user, channel)
			break;
		case 'remove':
			if (args[0]) {
				if (isNaN(+args[0]))
					channel.send(new MessageEmbed({
						title: 'Not Found',
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
		default: {
			channel.send('Homework Menu >>', {
				// embed: {
				// 	title: 'Homework Menu',
				// 	description: `**กดปุ่มด้านล่าง**\nหรือใช้คำสั่งต่อไปนี้:\n\n\`${prefix}list\`\n\`${prefix}add\`\n\`${prefix}remove ID\``,
				// 	color: CONFIG.color.blue,
				// },
				components: [{
					type: 1,
					components: [{
						type: 2,
						label: 'List Homework',
						style: 1,
						customID: 'hw_list'
					},
					{
						type: 2,
						label: 'Add Homework',
						style: 2,
						customID: 'hw_add'
					},
					{
						type: 2,
						label: 'Remove Homework',
						style: 2,
						customID: 'hw_remove'
					}]
				}]
			})
		}
	}

})





async function initilize() {

	announce_guild = await bot.guilds.fetch(<any>CONFIG.guildId);
	announce_channel = announce_guild.channels.resolve(<any>CONFIG.channelId) as TextChannel;
}

bot.once('ready', async () => {
	await initilize();


	subjects.forEach(subject => {
		subject.classes.forEach(c => {
			const [DoW, period] = c.split(' ');
			const [hour, min] = periods_begin[period].split(':');
			schedule.scheduleJob(`${min} ${hour} * * ${DoW}`, () => {
				announce(subject, period);
			});
			schedule.scheduleJob(`${+min >= 5 ? +min - 5 : 60 - 5 + +min} ${+min >= 5 ? hour : +hour - 1} * * ${DoW}`, () => {
				announce_upcoming(subject, period);
			});
		})
	})

})

bot.login(CONFIG.token).then(() => {
	console.log(`Logged in as >> ${bot.user.tag} (${bot.user.id})`)
})