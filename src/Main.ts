import { Client, Guild, MessageEmbed, MessageReaction, TextChannel, User } from 'discord.js';
import schedule from 'node-schedule';
import moment from 'moment';

import { confirm_type, sendEmbedPage } from './Helper';
import CONFIG from './ConfigManager';
import subjects from './subjects.json';

import { HomeworkRepository } from './DBManager';
import { Homework } from './models/Homework';

const bot = new Client();

let guild: Guild;
let channel: TextChannel;

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
	channel.send('<@&849534560668352542>', embed).then(msg => {
		msg.delete({ timeout: 3600000 })
	})
}

async function announce_upcoming(subject: typeof subjects[0], period: string) {
	let link = '';
	if (subject.msteam) link = `[Microsoft Teams Channel](${subject.msteam})`;
	const embed = new MessageEmbed({
		author: { name: '🔺 Upcoming class' },
		title: `${subject.name}` + (subject.subID ? `(${subject.subID})` : ''),
		description: `คาบ ${period} กำลังจะเริ่ม! (${periods_begin[period]} น. - ${periods_end[period]} น.)\n\n${link}`,
		color: Math.floor(Math.random() * (16777215 - 0 + 1)) + 0,
	})
	channel.send('<@&849534560668352542>', embed).then(msg => {
		msg.delete({ timeout: 300000 })
	})
}


async function getSubjectFromName(partialName: string, caller: User, channel: TextChannel) {
	let matched: typeof subjects = [];
	let sub: typeof subjects[0];
	for (const key in subjects) {
		if (subjects[key].name.toLowerCase().includes(partialName.toLowerCase())) {
			matched.push(subjects[key])
			console.log('found match')
		}
	}

	if (matched.length > 1) {
		sub = await confirm_type('คุณหมายถึงวิชาใด', matched, caller, channel, m => `${m.name} (${m.subID})`)
	} else {
		sub = matched[0];
	}
	return sub;
}

const prefix = '%';
bot.on('message', async msg => {
	if (msg.author.bot || !msg.content.startsWith(prefix)) return;
	const [command, ...args] = msg.content.slice(prefix.length).split(' ');
	const channel = msg.channel;

	switch (command.toLowerCase()) {
		case 'list': {
			const hws: Homework[] = await HomeworkRepository
				.createQueryBuilder()
				.select('*')
				.addOrderBy('-dueDate', 'DESC')
				.addOrderBy('-dueTime', 'DESC')
				.getRawMany();
			console.log(hws)
			let i = 0;
			sendEmbedPage(<TextChannel>channel, new MessageEmbed({ color: CONFIG.color.blue }), 'Homework List',
				hws
					.map(hw => {
						i++;
						let format;
						if (hw.dueTime) {
							format = {
								sameDay: '[วันนี้ เวลา] HH:mm:ss',
								nextDay: '[พรุ่งนี้ เวลา] HH:mm:ss',
								nextWeek: 'dddd[นี้ เวลา] HH:mm:ss',
								lastDay: '[เมื่อวานนี้ เวลา] HH:mm:ss',
								lastWeek: 'dddd[ที่แล้ว เวลา] HH:mm:ss',
								sameElse: 'DD/MM/YYYY [เวลา] HH:mm:ss'
							};
						} else {
							format = {
								sameDay: '[วันนี้]',
								nextDay: '[พรุ่งนี้]',
								nextWeek: 'dddd[นี้]',
								lastDay: '[เมื่อวานนี้]',
								lastWeek: 'dddd[ที่แล้ว]',
								sameElse: 'DD/MM/YYYY'
							};
						}


						return `-------------------------------------------\nID:\`${hw.id}\` __**${hw.name}**__\n\n📋 **Subject**: ${subjects.filter(s => s.subID == hw.subID)[0].name}\n\n**Description**:\n${hw.description ? `${hw.description}` : '*none*'}\n\n**Due**: ${hw.dueDate ? `${moment(hw.dueDate).calendar(format)} ‼` : '*none*'}`;
					})
			)
			break;
		}
		case 'add': {
			let title: string, sub: typeof subjects[0], description: string, dueDate: Date;

			// input topic
			const refmsg = await channel.send(new MessageEmbed({
				title: 'Homework Creation Session',
				description: `**กรุณาใส่ __หัวข้อการบ้าน__ ลงในแชท**`,
				color: CONFIG.color.blue
			}))
			await channel.awaitMessages(m => m.author.id == msg.author.id, { maxProcessed: 1, time: 300000 }).then(_m => {
				const m = _m.first();
				title = m.content;
				if (m.deletable) m.delete();
			})

			// input subject
			refmsg.edit(new MessageEmbed({
				title: 'Homework Creation Session',
				description: `**หัวข้อการบ้าน**: "${title}"\n\n**กรุณาใส่ __ชื่อวิชา__ ลงในแชท**`,
				color: CONFIG.color.blue
			}))
			await channel.awaitMessages(m => m.author.id == msg.author.id, { maxProcessed: 1, time: 300000 }).then(async _m => {
				const m = _m.first();
				if (m.deletable) m.delete();
				let subject_name = m.content;

				sub = (await getSubjectFromName(subject_name, msg.author, <TextChannel>msg.channel));
				console.log('subid: ', sub?.subID)
				while (!sub) {
					refmsg.edit(new MessageEmbed({
						title: 'Homework Creation Session',
						description: `**ขออภัย, ไม่พบวิชา "${subject_name}"**\nกรุณาเช็คการสะกดคำหรือดูชื่อวิชาจากตารางสอน`,
						color: CONFIG.color.yellow
					}))
					await channel.awaitMessages(m => m.author.id == msg.author.id, { maxProcessed: 1, time: 300000 }).then(_innerm => {
						const innerm = _innerm.first();
						subject_name = innerm.content;
						if (innerm.deletable) innerm.delete();
					})
					sub = await getSubjectFromName(subject_name, msg.author, <TextChannel>msg.channel);
				}

			})

			// input description
			refmsg.edit(new MessageEmbed({
				title: 'Homework Creation Session',
				description: `หัวข้อการบ้าน: "${title}"\n**วิชา**:"${sub.name} (${sub.subID})" \n\n**กรุณาใส่ __ข้อมูลเพิ่มเติม__ ลงในแชท** (กดลูกศรเพื่อข้ามได้)`,
				color: CONFIG.color.blue
			}))
			const reaction = refmsg.react('845520716715917314');

			let received_desc = false;
			const desc_reply_promise = channel.awaitMessages(m => m.author.id == msg.author.id, { maxProcessed: 1, time: 300000 }).then(_m => {
				if (received_desc) return;
				const m = _m.first();
				description = m.content;
				if (m.deletable) m.delete();
			})
			const desc_reaction_promise = refmsg.awaitReactions((r: MessageReaction, u: User) => r.emoji.id == '845520716715917314' && u.id == msg.author.id, { maxEmojis: 1, time: 300000 }).then(_r => {
				if (received_desc) return;
				description = null;
			})
			await Promise.race([desc_reply_promise, desc_reaction_promise]);
			if (msg.member.hasPermission('MANAGE_MESSAGES'))
				refmsg.reactions.removeAll();

			// ------------------------- Input Done yayyyy !!! -------------------------

			HomeworkRepository.insert({ name: title, subID: sub.subID, description: description, author: msg.author.id }).then(() => {
				refmsg.edit(new MessageEmbed({
					title: '<:checkmark:849685283459825714> Homework Creation Success',
					description: `**หัวข้อการบ้าน**: "${title}"\n**วิชา**:"${sub.name} (${sub.subID})"\n${description ? `**ข้อมูลเพิ่มเติม**: ${description}` : ''}`,
					color: CONFIG.color.green
				}))
			})

			/*
			refmsg.edit(new MessageEmbed({
				title: 'Homework Creation Session',
				description: `หัวข้อการบ้าน: "${title}"\nวิชา:"${sub.name} (${sub.subID})"\nข้อมูลเพิ่มเติม:"${description}" \n\n**กรุณาใส่ __วันส่ง__ ลงในแชท**`,
				color: CONFIG.color.blue
			}))
			await channel.awaitMessages(m => m.author.id == msg.author.id, { maxProcessed: 1 }).then(_m => {
				const m = _m.first();
				// subID = m.content;
				if (m.deletable) m.delete();
			})
			*/

			break;
		}
		case 'remove': {
			if (args[0]) {
				if (isNaN(+args[0]) || await HomeworkRepository.count({ id: +args[0] }) < 1)
					channel.send(new MessageEmbed({
						title: 'Not Found',
						description: `Cannot find homework with ID: \`${args[0]}\``,
						color: CONFIG.color.red
					}))
				else {
					const hw = await HomeworkRepository.findOne({ id: +args[0] });
					await HomeworkRepository.remove(hw);
					console.log(`deleted ${args[0]}`)
					channel.send(new MessageEmbed({
						title: '🗑️ Homework Deleted',
						description: `__**${hw.name}**__\n\n📋 **Subject**: ${subjects.filter(s => s.subID == hw.subID)[0].name}\n\n**Description**:\n${hw.description ? `${hw.description}` : '*none*'}\n\n**Due**: ${hw.dueDate ? `${hw.dueDate}` : '*none*'}`,
						color: CONFIG.color.green
					}))
				}
			} else {
				channel.send(new MessageEmbed({
					title: 'Please provide homework ID',
					description: `Usage: \`${prefix}remove ID\``,
					color: CONFIG.color.red
				}))
			}


			break;
		}
		default: {

			channel.send(new MessageEmbed({
				title: 'ไม่รู้จักคำสั่งนี้',
				description: `คำสั่งที่ใช้ได้ ได้แก่:\n\`${prefix}list\`\n\`${prefix}add\`\n\`${prefix}remove ID\``,
				color: CONFIG.color.red
			}))
		}
	}

})





async function initilize() {
	guild = await bot.guilds.fetch(CONFIG.guildId);
	channel = guild.channels.cache.get(CONFIG.channelId) as TextChannel;
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