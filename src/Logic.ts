import { ButtonInteraction, CommandInteraction, InteractionUpdateOptions, Message, MessageEmbedOptions, MessagePayload, TextChannel, User, WebhookEditMessageOptions } from 'discord.js';
import schedule from 'node-schedule';
import moment from 'moment-timezone';

import { appendTime, condenseArrayByLengthLimit, confirm_type, sendPage } from './Helper';
import subjects from './subjects.json';
import { announce_channel, autoDeleteJobs } from './Main';
import { HomeworkRepository } from './DBManager';
import { Homework } from './models/Homework';
import { logger } from './Logger';
import ConfigManager from './ConfigManager';
import { SelectQueryBuilder } from 'typeorm';

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

type ConsideringInteraction = CommandInteraction | ButtonInteraction;

export const list = async (interaction: ConsideringInteraction, options?: { showID?: boolean, showDeleted?: boolean; }) => {
	const showID = options?.showID ?? false;
	const showDeleted = options?.showDeleted ?? false;

	const { channel } = interaction;
	if (!channel.isText()) return;

	let hws: Homework[];
	try {
		let builder: SelectQueryBuilder<Homework> = HomeworkRepository
			.createQueryBuilder()
			.select('*')
			.addOrderBy('-dueDate', 'DESC')
			.addOrderBy('-dueTime', 'DESC');
		if (showDeleted) builder.withDeleted();
		hws = await builder.getRawMany();
	} catch (err) {
		const embed: MessageEmbedOptions = {
			description: `**Cannot read from database**:\n${err}`,
			color: ConfigManager.color.red
		};
		if (interaction.isCommand())
			interaction.reply({ embeds: [embed] });
		else (<Message>interaction.message).edit({ embeds: [embed] });
		return;
	}

	let i = 0;
	const condensed = condenseArrayByLengthLimit(hws.map(hw => {
		i++;
		let format;
		hw.dueDate = new Date(hw.dueDate);
		hw.createdAt = new Date(hw.createdAt);
		if (hw.dueTime) {
			hw.dueDate = appendTime(hw.dueDate, hw.dueTime);
			format = {
				sameDay: '[วันนี้ เวลา] HH:mm น.',
				nextDay: '[พรุ่งนี้ เวลา] HH:mm น.',
				nextWeek: 'dddd[นี้ เวลา] HH:mm น.',
				lastDay: '[เมื่อวานนี้ เวลา] HH:mm น.',
				lastWeek: 'dddd[ที่แล้ว เวลา] HH:mm น.',
				sameElse: 'DD/MM/YYYY [เวลา] HH:mm น.'
			};
		} else {
			if (hw.dueDate.valueOf() != 0) hw.dueDate = moment(hw.dueDate).endOf('date').toDate();
			format = {
				sameDay: '[วันนี้]',
				nextDay: '[พรุ่งนี้]',
				nextWeek: 'dddd[นี้]',
				lastDay: '[เมื่อวานนี้]',
				lastWeek: 'dddd[ที่แล้ว]',
				sameElse: 'DD/MM/YYYY'
			};
		}
		// console.log(hw.dueDate);
		const getBookIcon = (date: Date) => {
			if (date?.valueOf() == 0) return '📘';
			const diff_ms = date.valueOf() - new Date().valueOf();
			if (diff_ms < 86400000) return '📕'; // less than a day
			if (diff_ms < 259200000) return '📙'; // less than 3 days
			return '📗';
		};
		return `**-------------------------------------------**\n` +
			`${new Date().valueOf() - hw.createdAt.valueOf() < 86400000 ? '<:new5:854041576442560523> ' : ''}${getBookIcon(hw.dueDate)} **${hw.name}**${showID ? ` | \`${hw.id}\`` : ''}\n\n` +
			`**Subject**: ${subjects.filter(s => s.subID == hw.subID)[0].name}` +
			`${hw.detail ? `**\nDetail**: ${hw.detail}` : ''} ` +
			`${hw.dueDate && new Date(hw.dueDate).valueOf() !== 0 ? `**\n\nDue**: ${moment(hw.dueDate).calendar(format)} ⏰` : ''}`;
	}), 1024);
	const pages = condensed.map(c => { return { embeds: [{ title: '📚 Homework List', description: c }] }; });

	if (interaction.isCommand()) {
		const prompt = await interaction.reply({
			embeds: pages[0].embeds, components: [{
				type: 'ACTION_ROW',
				components: [{
					type: 'BUTTON',
					label: 'Loading ...',
					style: 'SECONDARY',
					customId: 'thisshouldntbeused',
					disabled: true
				}]
			}], fetchReply: true
		}) as Message;
		sendPage({ textChannel: channel, pages: pages, appendPageNumber: true, preMessage: prompt });
	} else if (interaction.message instanceof Message) {
		// const prompt = await interaction.message.edit({ embeds: [{ title: '<a:loading:845534883396583435>' }], components: [] });
		sendPage({ textChannel: channel, pages: pages, appendPageNumber: true, preMessage: interaction.message });
	}
};

export const add = async (interaction: ConsideringInteraction) => {
	const { user, channel } = interaction;
	if (!channel.isText()) return;

	let title: string, sub: typeof subjects[0], detail: string, dueDate: Date, dueTime: string;
	let isCanceled = false;


	const editPrompt = (options: (string | MessagePayload | WebhookEditMessageOptions) & (InteractionUpdateOptions & { fetchReply?: true; })) => {
		if (interaction.isCommand()) { interaction.editReply(options); return; }
		if (interaction.isButton()) { (interaction.message as Message).edit(options); }
	};

	let prompt_msg: Message;
	// input topic
	if (interaction.isCommand()) {
		prompt_msg = await interaction.reply({
			embeds: [{
				title: 'Homework Creation Session',
				description: `กรุณาใส่ __หัวข้อการบ้าน__ ลงในแชท`,
				color: ConfigManager.color.pink
			}], components: [{
				type: 'ACTION_ROW',
				components: [{
					type: 'BUTTON',
					label: 'Cancel',
					style: 'DANGER',
					customId: 'cancel_add'
				}]
			}],
			fetchReply: true
		}) as Message;
	} else {
		prompt_msg = interaction.message as Message;
		editPrompt({
			embeds: [{
				title: 'Homework Creation Session',
				description: `กรุณาใส่ __หัวข้อการบ้าน__ ลงในแชท`,
				color: ConfigManager.color.pink
			}], components: [{
				type: 'ACTION_ROW',
				components: [{
					type: 'BUTTON',
					label: 'Cancel',
					style: 'DANGER',
					customId: 'cancel_add'
				}]
			}]
		});
	}

	prompt_msg.awaitMessageComponent({ filter: i => i.user.id == user.id && i.isMessageComponent() && i.customId == 'cancel_add' }).then(() => {
		isCanceled = true;
		editPrompt({ content: `You've canceled homework creation.`, embeds: [], components: [] });
	});
	if (isCanceled) return;
	await channel.awaitMessages({ filter: m => m.author.id == user.id, maxProcessed: 1, time: 300000 }).then(_m => {
		if (isCanceled) return;
		const m = _m.first();
		title = m.content;
		if (m?.deletable) m.delete();
	});

	// input subject
	if (isCanceled) return;
	editPrompt({
		embeds: [{
			title: 'Homework Creation Session',
			description: `**หัวข้อการบ้าน**: "${title}"\n-----------------------------------\nกรุณาใส่ __ชื่อวิชา__ ลงในแชท`,
			color: ConfigManager.color.pink
		}], components: [{
			type: 1,
			components: [{
				type: 2,
				label: 'Cancel',
				style: 4,
				customId: 'cancel_add',
			}]
		}]
	});
	await channel.awaitMessages({ filter: m => m.author.id == user.id, maxProcessed: 1, time: 300000 }).then(async _m => {
		if (isCanceled) return;
		const m = _m.first();
		if (m?.deletable) m.delete();
		let subject_name = m.content;

		sub = (await getSubjectFromName(subject_name, user, <TextChannel>channel));
		logger.debug(`SubID in creation session: ${sub?.subID}`);
		while (!sub && !isCanceled) {
			editPrompt({
				embeds: [{
					title: 'Homework Creation Session',
					description: `**ขออภัย, ไม่พบวิชา "${subject_name}"**\nกรุณาเช็คการสะกดคำหรือดูชื่อวิชาจากตารางสอน`,
					color: ConfigManager.color.yellow
				}]
			});
			await channel.awaitMessages({ filter: m => m.author.id == user.id, max: 1, time: 300000 }).then(_innerm => {
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
	editPrompt({
		embeds: [{
			title: 'Homework Creation Session',
			description: `**หัวข้อการบ้าน**: "${title}"\n**วิชา**: "${sub.name} (${sub.subID})" \n---------------------------------------------------\nกรุณาใส่ __ข้อมูลเพิ่มเติม__ ลงในแชท (กดข้ามได้)`,
			color: ConfigManager.color.pink
		}],
		components: [{
			type: 1,
			components: [{
				type: 2,
				label: 'Skip',
				style: 2,
				customId: 'skip_section'
			},
			{
				type: 2,
				label: 'Cancel',
				style: 4,
				customId: 'cancel_add'
			}]
		}]
	});

	let received_desc = false;
	const desc_reply_promise = channel.awaitMessages({ filter: m => m.author.id == user.id, max: 1, time: 300000 }).then(collected => {
		if (received_desc || isCanceled) return;
		received_desc = true;
		const m = collected.first();
		detail = m.content;
		if (m?.deletable) m.delete();
	});
	const desc_skip_promise = prompt_msg.awaitMessageComponent({ filter: interaction => interaction.customId == 'skip_section' && interaction.user.id == user.id, componentType: 'BUTTON', time: 300000 }).then(button => {
		button.deferUpdate();
		if (received_desc || isCanceled) return;
		received_desc = true;
		logger.debug('skipped');
		detail = null;
	});
	await Promise.race([desc_reply_promise, desc_skip_promise]);

	// input date
	if (isCanceled) return;
	editPrompt({
		embeds: [{
			title: 'Homework Creation Session',
			description: `**หัวข้อการบ้าน**: "${title}"\n**วิชา**: "${sub.name} (${sub.subID})"\n**Detail**: ${detail} \n---------------------------------------------------\nกรุณาใส่ __วันส่ง__ ลงในแชท (กดข้ามได้)\nรูปแบบคือ วัน/เดือน/ปีค.ศ. เช่น \`12/6/2021\``,
			color: ConfigManager.color.pink
		}],
		components: [{
			type: 1,
			components: [{
				type: 2,
				label: 'Skip',
				style: 2,
				customId: 'skip_section'
			},
			{
				type: 2,
				label: 'Cancel',
				style: 4,
				customId: 'cancel_add'
			}]
		}]
	});

	let received_date = false;
	const date_reply_promise = channel.awaitMessages({ filter: m => m.author.id == user.id && m.content != null, max: 1, time: 300000 }).then(async collected => {
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
		while (isNaN(dueDate?.valueOf())) {
			if (received_date || isCanceled) return;
			editPrompt({
				embeds: [{
					title: 'Homework Creation Session',
					description: `รูปแบบวันไม่ถูกต้อง กรุณาใส่วันในรูปแบบ วัน/เดือน/ปีค.ศ. เช่น \`12/6/2021\``,
					color: ConfigManager.color.yellow
				}]
			});
			await channel.awaitMessages({ filter: m => m.author.id == user.id, max: 1, time: 300000 }).then(innerCollected => {
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
	const date_skip_promise = prompt_msg.awaitMessageComponent({ filter: interaction => interaction.customId == 'skip_section' && interaction.user.id == user.id, componentType: 'BUTTON', time: 300000 }).then(button => {
		button.deferUpdate();
		if (received_date || isCanceled) return;
		received_date = true;
		logger.debug('skipped date');
		dueDate = null;
	});
	await Promise.race([date_reply_promise, date_skip_promise]);

	// input time only if provide date
	if (dueDate) {
		if (isCanceled) return;
		editPrompt({
			embeds: [{
				title: 'Homework Creation Session',
				description: `**หัวข้อการบ้าน**: "${title}"\n**วิชา**: "${sub.name} (${sub.subID})"\n**Detail**: ${detail}\n**Due Date:**: ${moment(dueDate).format('ll')} \n---------------------------------------------------\nกรุณาใส่ __เวลาส่ง__ ลงในแชท (กดข้ามได้ ถ้าข้ามจะนับเป็นตอนจบวัน)\nรูปแบบคือ hh:mm เช่น \`18:00\``,
				color: ConfigManager.color.pink
			}],
			components: [{
				type: 1,
				components: [{
					type: 2,
					label: 'Skip',
					style: 2,
					customId: 'skip_section'
				},
				{
					type: 2,
					label: 'Cancel',
					style: 4,
					customId: 'cancel_add'
				}]
			}]
		});

		let received_time = false;
		const time_reply_promise = channel.awaitMessages({ filter: m => m.author.id == user.id && m.content != null, max: 1, time: 300000 }).then(async collected => {
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
				editPrompt({
					embeds: [{
						title: 'Homework Creation Session',
						description: `รูปแบบเวลาไม่ถูกต้อง กรุณาใส่วันในรูปแบบ hh:mm เช่น \`18:00\``,
						color: ConfigManager.color.yellow
					}]
				});
				await channel.awaitMessages({ filter: m => m.author.id == user.id, max: 1, time: 300000 }).then(innerCollected => {
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
		const time_skip_promise = prompt_msg.awaitMessageComponent({ filter: interaction => interaction.customId == 'skip_section' && interaction.user.id == user.id, componentType: 'BUTTON', time: 300000 }).then(button => {
			button.deferUpdate();
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
		editPrompt({
			embeds: [{
				title: '<:checkmark:849685283459825714> Creation Successful',
				description: `**หัวข้อการบ้าน**: "${title}"\n**วิชา**:"${sub.name} (${sub.subID})"\n${detail ? `**ข้อมูลเพิ่มเติม**: ${detail}\n` : ''}${dueDate ? `**Date**: ${moment(dueDate).format('ll')}\n` : ''}${dueTime ? `**Time**: ${dueTime}` : ''}`,
				color: ConfigManager.color.green
			}],
			components: []
		});
		const id = result.identifiers[0].id;
		const hw = await HomeworkRepository.findOne(id);
		if (hw.dueDate) {
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
						title: 'Auto-deleted due to hitting deadline.',
						description: `📋 **${hw.name}** | ID: \`${hw.id}\`\n\n**Subject**: ${subjects.filter(s => s.subID == hw.subID)[0].name}${hw.detail ? `**\nDetail**: ${hw.detail}` : ''}${hw.dueDate ? `**\n\nDue**: ${moment(hw.dueDate).format(hw.dueTime ? 'lll' : 'll')} ‼` : ''}`,
						color: ConfigManager.color.yellow
					}]
				});
			});
			autoDeleteJobs.set(hw.id, job);
		}
	});

	/*
	refmsg.edit(new MessageEmbed({
		title: 'Homework Creation Session',
		description: `หัวข้อการบ้าน: "${title}"\nวิชา:"${sub.name} (${sub.subID})"\nข้อมูลเพิ่มเติม:"${description}" \n\n**กรุณาใส่ __วันส่ง__ ลงในแชท**`,
		color: ConfigManager.color.blue
	}))
	await channel.awaitMessages(m => m.author.id == msg.author.id, { maxProcessed: 1 }).then(_m => {
		const m = _m.first();
		// subID = m.content;
		if (m.deletable) m.delete();
	})
	*/
};

export const remove = async (interaction: ConsideringInteraction, id: number) => {
	const { channel } = interaction;
	if (!channel.isText()) return;

	const editPrompt = (options: (string | MessagePayload | WebhookEditMessageOptions) & (InteractionUpdateOptions & { fetchReply?: true; })) => {
		if (interaction.isCommand()) interaction.reply(options);
		else if (interaction.isButton()) (interaction.message as Message).edit(options);
	};

	if (await HomeworkRepository.count({ id: id }) < 1)
		editPrompt({
			embeds: [{
				title: 'Not Found',
				description: `Cannot find homework with ID: \`${id}\``,
				color: ConfigManager.color.red
			}],
			components: []
		});
	else {
		const hw = await HomeworkRepository.findOne({ id: id });
		await HomeworkRepository.softDelete(hw.id);
		logger.debug(`deleted ${id}`);
		if (hw.dueTime) {
			hw.dueDate = appendTime(hw.dueDate, hw.dueTime);
		}
		const format = hw.dueTime ? 'lll' : 'll';
		editPrompt({
			embeds: [{
				title: '🗑️ Homework Deleted',
				description: `📋 **${hw.name}** | ID: \`${hw.id}\`\n\n**Subject**: ${subjects.filter(s => s.subID == hw.subID)[0].name}${hw.detail ? `**\nDetail**: ${hw.detail}` : ''}${hw.dueDate ? `**\n\nDue**: ${moment(hw.dueDate).format(format)} ‼` : ''}`,
				color: ConfigManager.color.green
			}],
			components: []
		});
		if (autoDeleteJobs.has(hw.id)) {
			autoDeleteJobs.get(hw.id).cancel();
			autoDeleteJobs.delete(hw.id);
		}

	};
};