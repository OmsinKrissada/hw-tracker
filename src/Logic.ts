import { Client, DMChannel, Guild, Interaction, MessageComponentInteraction, MessageEmbed, MessageReaction, NewsChannel, TextChannel, User } from 'discord.js';
import schedule from 'node-schedule';
import moment from 'moment';

import { confirm_type, sendEmbedPage } from './Helper';
import CONFIG from './ConfigManager';
import subjects from './subjects.json';
import { announce_channel, prefix } from './Main';
import { HomeworkRepository } from './DBManager';
import { Homework } from './models/Homework';
import { logger } from './Logger';

async function getSubjectFromName(partialName: string, caller: User, channel: TextChannel) {
	let matched: typeof subjects = [];
	let sub: typeof subjects[0];
	for (const key in subjects) {
		if (subjects[key].name.toLowerCase().includes(partialName.toLowerCase())) {
			matched.push(subjects[key]);
			logger.debug(`Found subject match: ${subjects[key].subID}`);
		}
	}

	if (matched.length > 1) {
		sub = await confirm_type('คุณหมายถึงวิชาใด', matched, caller, channel, m => `${m.name} (${m.subID})`);
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


				return `-------------------------------------------\n📋 ${new Date().valueOf() - hw.createdAt.valueOf() < 86400000 ? '<:new5:854041576442560523> ' : ''}**${hw.name}** | ID: \`${hw.id}\`\n\n**Subject**: ${subjects.filter(s => s.subID == hw.subID)[0].name}${hw.detail ? `**\nDetail**: ${hw.detail}` : ''}${hw.dueDate ? `**\n\nDue**: ${moment(hw.dueDate).calendar(format)} ‼` : ''}`;
			})
	);
};

export const add = async (user: User, channel: DMChannel | TextChannel | NewsChannel) => {
	let title: string, sub: typeof subjects[0], detail: string, dueDate: Date | string, dueTime: string;

	let isCanceled = false;

	// input topic
	const refmsg = await channel.send({
		embed: {
			title: 'Homework Creation Session',
			description: `กรุณาใส่ __หัวข้อการบ้าน__ ลงในแชท`,
			color: CONFIG.color.pink
		}, components: [{
			type: 1,
			components: [{
				type: 2,
				label: 'Cancel',
				style: 4,
				customID: 'cancel_add'
			}]
		}]
	});
	refmsg.awaitMessageComponentInteractions(i => i.user.id == user.id && i.isMessageComponent() && i.customID == 'cancel_add', { maxComponents: 1 }).then(() => {
		isCanceled = true;
		refmsg.edit({ embed: { title: 'Session Canceled', description: 'Homework Creation Session was canceled by user.', color: CONFIG.color.red }, components: [] });
	});
	if (isCanceled) return;
	await channel.awaitMessages(m => m.author.id == user.id, { maxProcessed: 1, time: 300000 }).then(_m => {
		if (isCanceled) return;
		const m = _m.first();
		title = m.content;
		if (m?.deletable) m.delete();
	});

	// input subject
	if (isCanceled) return;
	refmsg.edit({
		embed: {
			title: 'Homework Creation Session',
			description: `**หัวข้อการบ้าน**: "${title}"\n-----------------------------------\nกรุณาใส่ __ชื่อวิชา__ ลงในแชท`,
			color: CONFIG.color.pink
		}, components: [{
			type: 1,
			components: [{
				type: 2,
				label: 'Cancel',
				style: 4,
				customID: 'cancel_add'
			}]
		}]
	});
	await channel.awaitMessages(m => m.author.id == user.id, { maxProcessed: 1, time: 300000 }).then(async _m => {
		if (isCanceled) return;
		const m = _m.first();
		if (m?.deletable) m.delete();
		let subject_name = m.content;

		sub = (await getSubjectFromName(subject_name, user, <TextChannel>channel));
		logger.debug(`SubID in creation session: ${sub?.subID}`);
		while (!sub && !isCanceled) {
			refmsg.edit(new MessageEmbed({
				title: 'Homework Creation Session',
				description: `**ขออภัย, ไม่พบวิชา "${subject_name}"**\nกรุณาเช็คการสะกดคำหรือดูชื่อวิชาจากตารางสอน`,
				color: CONFIG.color.yellow
			}));
			await channel.awaitMessages(m => m.author.id == user.id, { max: 1, time: 300000 }).then(_innerm => {
				if (isCanceled) return;
				const innerm = _innerm.first();
				subject_name = innerm?.content;
				if (innerm?.deletable) innerm.delete();
			});
			sub = await getSubjectFromName(subject_name, user, <TextChannel>channel);
		}

	});

	// input description
	if (isCanceled) return;
	refmsg.edit({
		embed: {
			title: 'Homework Creation Session',
			description: `**หัวข้อการบ้าน**: "${title}"\n**วิชา**: "${sub.name} (${sub.subID})" \n---------------------------------------------------\nกรุณาใส่ __ข้อมูลเพิ่มเติม__ ลงในแชท (กดข้ามได้)`,
			color: CONFIG.color.pink
		},
		components: [{
			type: 1,
			components: [{
				type: 2,
				label: 'Skip',
				style: 2,
				customID: 'skip_section'
			},
			{
				type: 2,
				label: 'Cancel',
				style: 4,
				customID: 'cancel_add'
			}]
		}]
	});

	let received_desc = false;
	const desc_reply_promise = channel.awaitMessages(m => m.author.id == user.id, { max: 1, time: 300000 }).then(collected => {
		if (received_desc || isCanceled) return;
		received_desc = true;
		const m = collected.first();
		detail = m.content;
		if (m?.deletable) m.delete();
	});
	const desc_skip_promise = refmsg.awaitMessageComponentInteractions(interaction => interaction.customID == 'skip_section' && interaction.user.id == user.id && interaction.isMessageComponent(), { maxComponents: 1, time: 300000 }).then(collected => {
		collected.first().deferUpdate();
		if (received_desc || isCanceled) return;
		received_desc = true;
		logger.debug('skipped');
		detail = null;
	});
	await Promise.race([desc_reply_promise, desc_skip_promise]);

	// input date
	if (isCanceled) return;
	refmsg.edit({
		embed: {
			title: 'Homework Creation Session',
			description: `**หัวข้อการบ้าน**: "${title}"\n**วิชา**: "${sub.name} (${sub.subID})"\n**Detail**: ${detail} \n---------------------------------------------------\nกรุณาใส่ __วันส่ง__ ลงในแชท (กดข้ามได้)\nรูปแบบคือ วัน/เดือน/ปีค.ศ. เช่น \`12/6/2021\``,
			color: CONFIG.color.pink
		},
		components: [{
			type: 1,
			components: [{
				type: 2,
				label: 'Skip',
				style: 2,
				customID: 'skip_section'
			},
			{
				type: 2,
				label: 'Cancel',
				style: 4,
				customID: 'cancel_add'
			}]
		}]
	});

	let received_date = false;
	const date_reply_promise = channel.awaitMessages(m => m.author.id == user.id && m.content != null, { max: 1, time: 300000 }).then(async collected => {
		if (received_date || isCanceled) return;
		const msg = collected.first();
		try {
			const [day, month, year] = msg.content.split('/');
			if (day && month && year && !isNaN(+day) && !isNaN(+month) && !isNaN(+year)) {
				dueDate = new Date(`${year}-${month}-${day}`);
			}
		} catch (error) {
			logger.error(error);
		}
		if (msg?.deletable) msg.delete();
		while (!dueDate || dueDate == 'Invalid Date') {
			if (received_date || isCanceled) return;
			refmsg.edit(new MessageEmbed({
				title: 'Homework Creation Session',
				description: `รูปแบบวันไม่ถูกต้อง กรุณาใส่วันในรูปแบบ วัน/เดือน/ปีค.ศ. เช่น \`12/6/2021\``,
				color: CONFIG.color.yellow
			}));
			await channel.awaitMessages(m => m.author.id == user.id, { max: 1, time: 300000 }).then(innerCollected => {
				if (isCanceled) return;
				const innermsg = innerCollected.first();
				const [day, month, year] = innermsg.content.split('/');
				if (day && month && year && !isNaN(+day) && !isNaN(+month) && !isNaN(+year)) {
					dueDate = new Date(`${year}-${month}-${day}`);
				}
				if (innermsg?.deletable) innermsg.delete();
			});
		}
		received_date = true;
	});
	const date_skip_promise = refmsg.awaitMessageComponentInteractions(interaction => interaction.customID == 'skip_section' && interaction.user.id == user.id && interaction.isMessageComponent(), { maxComponents: 1, time: 300000 }).then(collected => {
		collected.first().deferUpdate();
		if (received_date || isCanceled) return;
		received_date = true;
		logger.debug('skipped date');
		dueDate = null;
	});
	await Promise.race([date_reply_promise, date_skip_promise]);

	// input time only if provide date
	if (dueDate) {
		if (isCanceled) return;
		refmsg.edit({
			embed: {
				title: 'Homework Creation Session',
				description: `**หัวข้อการบ้าน**: "${title}"\n**วิชา**: "${sub.name} (${sub.subID})"\n**Detail**: ${detail}\n**Due Date:**: ${moment(dueDate).format('ll')} \n---------------------------------------------------\nกรุณาใส่ __เวลาส่ง__ ลงในแชท (กดข้ามได้ ถ้าข้ามจะนับเป็นตอนจบวัน)\nรูปแบบคือ hh:mm เช่น \`18:00\``,
				color: CONFIG.color.pink
			},
			components: [{
				type: 1,
				components: [{
					type: 2,
					label: 'Skip',
					style: 2,
					customID: 'skip_section'
				},
				{
					type: 2,
					label: 'Cancel',
					style: 4,
					customID: 'cancel_add'
				}]
			}]
		});

		let received_time = false;
		const time_reply_promise = channel.awaitMessages(m => m.author.id == user.id && m.content != null, { max: 1, time: 300000 }).then(async collected => {
			if (received_time || isCanceled) return;
			const msg = collected.first();
			try {
				const [hour, min] = msg.content.split(':');
				if (hour && min && !isNaN(+hour) && !isNaN(+min) && +hour >= 0 && +hour <= 23 && +min >= 0 && +min <= 60) {
					dueTime = `${hour}:${min}`;
				}
			} catch (error) {
				logger.error(error);
			}
			if (msg?.deletable) msg.delete();
			while (!dueTime) {
				if (received_time || isCanceled) return;
				refmsg.edit(new MessageEmbed({
					title: 'Homework Creation Session',
					description: `รูปแบบเวลาไม่ถูกต้อง กรุณาใส่วันในรูปแบบ hh:mm เช่น \`18:00\``,
					color: CONFIG.color.yellow
				}));
				await channel.awaitMessages(m => m.author.id == user.id, { max: 1, time: 300000 }).then(innerCollected => {
					if (isCanceled) return;
					const innermsg = innerCollected.first();
					const [hour, min] = innermsg.content.split(':');
					if (hour && min && !isNaN(+hour) && !isNaN(+min) && +hour >= 0 && +hour <= 23 && +min >= 0 && +min <= 60) {
						dueTime = `${hour}:${min}`;
					}
					if (innermsg?.deletable) innermsg.delete();
				});
			}
			received_time = true;
		});
		const time_skip_promise = refmsg.awaitMessageComponentInteractions(interaction => interaction.customID == 'skip_section' && interaction.user.id == user.id && interaction.isMessageComponent(), { maxComponents: 1, time: 300000 }).then(collected => {
			collected.first().deferUpdate();
			if (received_time || isCanceled) return;
			received_time = true;
			logger.debug('skipped time');
			dueTime = null;
		});
		await Promise.race([time_reply_promise, time_skip_promise]);
	}



	// Insert to database
	if (isCanceled) return;
	HomeworkRepository.insert({ name: title, subID: sub.subID, detail: detail, dueDate: dueDate, dueTime: dueTime, author: user.id }).then(async result => {
		refmsg.edit({
			embed: {
				title: '<:checkmark:849685283459825714> Creation Successful',
				description: `**หัวข้อการบ้าน**: "${title}"\n**วิชา**:"${sub.name} (${sub.subID})"\n${detail ? `**ข้อมูลเพิ่มเติม**: ${detail}\n` : ''}${dueDate ? `**Date**: ${moment(dueDate).format('ll')}\n` : ''}${dueTime ? `**Time**: ${dueTime}` : ''}`,
				color: CONFIG.color.green
			},
			components: []
		});
		const id = result.identifiers[0].id;
		const hw = await HomeworkRepository.findOne(id);
		if (hw.dueDate) {
			hw.dueDate = new Date(hw.dueDate);
			if (hw.dueTime) {
				const [hours, mins, secs] = hw.dueTime.split(':');
				hw.dueDate.setHours(+hours, +mins, +secs);
			} else {
				hw.dueDate = moment(hw.dueDate).endOf('date').toDate();
			}
			schedule.scheduleJob(hw.dueDate, () => {
				HomeworkRepository.softDelete(hw.id);
				logger.debug(`Auto-deleted ${hw.id}`);
				announce_channel.send({
					embed: {
						title: 'Auto-deleted due to hitting deadline.',
						description: `📋 **${hw.name}** | ID: \`${hw.id}\`\n\n**Subject**: ${subjects.filter(s => s.subID == hw.subID)[0].name}${hw.detail ? `**\nDetail**: ${hw.detail}` : ''}${hw.dueDate ? `**\n\nDue**: ${moment(hw.dueDate).format(hw.dueTime ? 'lll' : 'll')} ‼` : ''}`,
						color: CONFIG.color.yellow
					}
				});
			});
		}
	});

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
};

export const remove = async (user: User, channel: DMChannel | TextChannel | NewsChannel, id: number) => {
	if (await HomeworkRepository.count({ id: id }) < 1)
		channel.send(new MessageEmbed({
			title: 'Not Found',
			description: `Cannot find homework with ID: \`${id}\``,
			color: CONFIG.color.red
		}));
	else {
		const hw = await HomeworkRepository.findOne({ id: id });
		await HomeworkRepository.softDelete(hw.id);
		logger.debug(`deleted ${id}`);
		if (hw.dueTime) {
			const [hours, mins, secs] = hw.dueTime.split(':');
			hw.dueDate = new Date(hw.dueDate);
			hw.dueDate.setHours(+hours, +mins, +secs);
		}
		const format = hw.dueTime ? 'lll' : 'll';
		channel.send(new MessageEmbed({
			title: '🗑️ Homework Deleted',
			description: `📋 **${hw.name}** | ID: \`${hw.id}\`\n\n**Subject**: ${subjects.filter(s => s.subID == hw.subID)[0].name}${hw.detail ? `**\nDetail**: ${hw.detail}` : ''}${hw.dueDate ? `**\n\nDue**: ${moment(hw.dueDate).format(format)} ‼` : ''}`,
			color: CONFIG.color.green
		}));
	}

};