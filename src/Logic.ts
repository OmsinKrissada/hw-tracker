import { Client, DMChannel, Guild, Interaction, MessageComponentInteraction, MessageEmbed, MessageReaction, NewsChannel, TextChannel, User } from 'discord.js';
import schedule from 'node-schedule';
import moment from 'moment';

import { confirm_type, sendEmbedPage } from './Helper';
import CONFIG from './ConfigManager';
import subjects from './subjects.json';
import { prefix } from './Main';
import { HomeworkRepository } from './DBManager';
import { Homework } from './models/Homework';
import { logger } from './Logger';

async function getSubjectFromName(partialName: string, caller: User, channel: TextChannel) {
	let matched: typeof subjects = [];
	let sub: typeof subjects[0];
	for (const key in subjects) {
		if (subjects[key].name.toLowerCase().includes(partialName.toLowerCase())) {
			matched.push(subjects[key])
			logger.debug(`Found subject match: ${subjects[key].subID}`)
		}
	}

	if (matched.length > 1) {
		sub = await confirm_type('คุณหมายถึงวิชาใด', matched, caller, channel, m => `${m.name} (${m.subID})`)
	} else {
		sub = matched[0];
	}
	return sub;
}

export const list = async (channel: DMChannel | TextChannel | NewsChannel) => {
	const hws: Homework[] = await HomeworkRepository
		.createQueryBuilder()
		.select('*')
		.addOrderBy('-dueDate', 'DESC')
		.addOrderBy('-dueTime', 'DESC')
		.getRawMany();
	let i = 0;
	sendEmbedPage(<TextChannel>channel, new MessageEmbed({ color: CONFIG.color.blue }), 'Homework List',
		hws
			.map(hw => {
				i++;
				let format;
				let dueTimestamp: Date;
				if (hw.dueTime) {
					const [hours, mins, secs] = hw.dueTime.split(':');
					hw.dueDate.setHours(+hours, +mins, +secs);
					format = {
						sameDay: '[วันนี้ เวลา] HH:mm น.',
						nextDay: '[พรุ่งนี้ เวลา] HH:mm น.',
						nextWeek: 'dddd[นี้ เวลา] HH:mm น.',
						lastDay: '[เมื่อวานนี้ เวลา] HH:mm น.',
						lastWeek: 'dddd[ที่แล้ว เวลา] HH:mm น.',
						sameElse: 'DD/MM/YYYY [เวลา] HH:mm น.'
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


				return `-------------------------------------------\n📋 **${hw.name}** | ID: \`${hw.id}\`\n\n**Subject**: ${subjects.filter(s => s.subID == hw.subID)[0].name}${hw.detail ? `**\nDetail**: ${hw.detail}` : ''}${hw.dueDate ? `**\n\nDue**: ${moment(hw.dueDate).calendar(format)} ‼` : ''}`;
			})
	)
}

export const add = async (user: User, channel: DMChannel | TextChannel | NewsChannel) => {
	let title: string, sub: typeof subjects[0], detail: string, dueDate: Date;

	// input topic
	const refmsg = await channel.send(new MessageEmbed({
		title: 'Homework Creation Session',
		description: `**กรุณาใส่ __หัวข้อการบ้าน__ ลงในแชท**`,
		color: CONFIG.color.blue
	}))
	await channel.awaitMessages(m => m.author.id == user.id, { maxProcessed: 1, time: 300000 }).then(_m => {
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
	await channel.awaitMessages(m => m.author.id == user.id, { maxProcessed: 1, time: 300000 }).then(async _m => {
		const m = _m.first();
		if (m.deletable) m.delete();
		let subject_name = m.content;

		sub = (await getSubjectFromName(subject_name, user, <TextChannel>channel));
		logger.debug(`SubID in creation session: ${sub?.subID}`)
		while (!sub) {
			refmsg.edit(new MessageEmbed({
				title: 'Homework Creation Session',
				description: `**ขออภัย, ไม่พบวิชา "${subject_name}"**\nกรุณาเช็คการสะกดคำหรือดูชื่อวิชาจากตารางสอน`,
				color: CONFIG.color.yellow
			}))
			await channel.awaitMessages(m => m.author.id == user.id, { maxProcessed: 1, time: 300000 }).then(_innerm => {
				const innerm = _innerm.first();
				subject_name = innerm.content;
				if (innerm.deletable) innerm.delete();
			})
			sub = await getSubjectFromName(subject_name, user, <TextChannel>channel);
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
	const desc_reply_promise = channel.awaitMessages(m => m.author.id == user.id, { maxProcessed: 1, time: 300000 }).then(_m => {
		if (received_desc) return;
		const m = _m.first();
		detail = m.content;
		if (m.deletable) m.delete();
	})
	const desc_reaction_promise = refmsg.awaitReactions((r: MessageReaction, u: User) => r.emoji.id == '845520716715917314' && u.id == user.id, { maxEmojis: 1, time: 300000 }).then(_r => {
		if (received_desc) return;
		detail = null;
	})
	await Promise.race([desc_reply_promise, desc_reaction_promise]);
	// if (msg.member.permissions.has('MANAGE_MESSAGES'))
	// 	refmsg.reactions.removeAll();

	// Insert to database
	HomeworkRepository.insert({ name: title, subID: sub.subID, detail: detail, author: user.id }).then(() => {
		refmsg.edit(new MessageEmbed({
			title: '<:checkmark:849685283459825714> Homework Creation Success',
			description: `**หัวข้อการบ้าน**: "${title}"\n**วิชา**:"${sub.name} (${sub.subID})"\n${detail ? `**ข้อมูลเพิ่มเติม**: ${detail}` : ''}`,
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
}

export const remove = async (user: User, channel: DMChannel | TextChannel | NewsChannel, id: number) => {
	if (await HomeworkRepository.count({ id: id }) < 1)
		channel.send(new MessageEmbed({
			title: 'Not Found',
			description: `Cannot find homework with ID: \`${id}\``,
			color: CONFIG.color.red
		}))
	else {
		const hw = await HomeworkRepository.findOne({ id: id });
		await HomeworkRepository.softDelete(hw.id);
		logger.debug(`deleted ${id}`)
		const format = hw.dueTime ? 'lll' : 'll';
		channel.send(new MessageEmbed({
			title: '🗑️ Homework Deleted',
			description: `📋 **${hw.name}** | ID: \`${hw.id}\`\n\n**Subject**: ${subjects.filter(s => s.subID == hw.subID)[0].name}${hw.detail ? `**\nDetail**: ${hw.detail}` : ''}${hw.dueDate ? `**\n\nDue**: ${moment(hw.dueDate).format(format)} ‼` : ''}`,
			color: CONFIG.color.green
		}))
	}

}