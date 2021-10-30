import { ButtonInteraction, CommandInteraction, InteractionUpdateOptions, Message, MessageEmbedOptions, MessageOptions, MessagePayload, TextChannel, User, WebhookEditMessageOptions } from 'discord.js';
import moment from 'moment-timezone';
import fs from 'fs';

import { appendTime, condenseArrayByLengthLimit, confirm_type, sendPage } from './Helper';
import { deleteJobs, remind10mJobs, remind1dJobs, remind1hJobs, remind5mJobs, scheduleDeleteJobs, subjects } from './Main';
import { GuildDataRepository, HomeworkRepository } from './DBManager';
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
	let useLocal: boolean;
	try {
		useLocal = (await GuildDataRepository.findOne({ id: interaction.guild.id }))?.useLocal;
		const targetGuild = (useLocal ? `${interaction.guild.id}` : `GLOBAL`);
		hws = await HomeworkRepository.find({ where: { guild: targetGuild }, withDeleted: showDeleted });
		hws.sort((a, b) => {
			if (!a.dueDate && !b.dueDate) return 0;
			if (!a.dueDate) return 1;
			if (!b.dueDate) return -1;
			return a.dueDate?.valueOf() - b.dueDate?.valueOf();
		});
	} catch (err) {
		logger.warn('Failed to read from database');
		const embed: MessageEmbedOptions = {
			description: `**Cannot read from database**:\n${err}`,
			color: ConfigManager.color.red
		};
		if (interaction.isCommand())
			interaction.reply({ embeds: [embed] });
		else (<Message>interaction.message).edit({ embeds: [embed], components: [] });
		return;
	}

	// Case there's no homework
	if (hws.length == 0) {
		if (interaction.isCommand()) {
			interaction.reply({
				embeds: [{
					title: `📚 Homework List ${useLocal ? '(LOCAL MODE)' : ''}`,
					description: 'The list is empty!'
				}]
			});
		} else if (interaction.message instanceof Message) {
			interaction.message.edit({
				embeds: [{
					title: `📚 Homework List ${useLocal ? '(LOCAL MODE)' : ''}`,
					description: 'The list is empty!'
				}],
				components: []
			});
		}
		return;
	}

	let i = 0;
	const condensed = condenseArrayByLengthLimit(hws.map(hw => {
		i++;
		let format;
		hw.dueDate = new Date(hw.dueDate);
		hw.createdAt = new Date(hw.createdAt);
		if (hw.dueDate.valueOf() != moment(hw.dueDate).endOf('date').valueOf()) {
			format = {
				sameDay: '[Today at] H.mm',
				nextDay: '[Tomorrow at] H.mm',
				nextWeek: 'dddd [at] H.mm',
				lastDay: '[Yesterday at] H.mm',
				lastWeek: '[Last] dddd [at] H.mm',
				sameElse: 'DD/MM/YYYY [at] H.mm'
			};
		} else {
			format = {
				sameDay: '[Today]',
				nextDay: '[Tomorrow]',
				nextWeek: 'dddd',
				lastDay: '[Yesterday]',
				lastWeek: '[Last] dddd',
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
		return `-------------------------------------------\n` +
			`${new Date().valueOf() - hw.createdAt.valueOf() < 86400000 ? '<:new5:854041576442560523> ' : ''}${getBookIcon(hw.dueDate)} **${hw.title}**${showID ? ` | \`${hw.id}\`` : ''}\n\n` +
			` ${hw.detail ? `**Detail**: ${hw.detail}\n` : ''}` +
			` **Subject**: ${subjects.filter(s => s.subID == hw.subID)[0].name}` +
			`${hw.dueDate && new Date(hw.dueDate).valueOf() !== 0 ? `\n\n**Due**: __${moment(hw.dueDate).calendar(format)}__ **(${moment(hw.dueDate).fromNow(true)})** ⏰` : ''}`;
	}), 1050);
	const pages = condensed.map((c): MessageOptions => { return { embeds: [{ title: `📚 Homework List ${useLocal ? '(LOCAL MODE)' : ''}`, description: c }] }; });

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
	if (interaction.isCommand())
		interaction.reply({ content: 'Please visit https://omsinkrissada.sytes.net/homework/dashboard#creation-form', ephemeral: true });


	// Insert to database
	// if (isCanceled) return;
	// HomeworkRepository.insert({ name: title, subID: sub.subID, detail: detail, dueDate: dueDate, dueTime: dueTime, author: user.id, guild: useLocal ? interaction.guild.id : 'GLOBAL' }).then(async result => {
	// 	editPrompt({
	// 		embeds: [{
	// 			title: `<:checkmark:849685283459825714> Creation Successful ${useLocal ? '(LOCAL MODE)' : ''}`,
	// 			description: `**หัวข้อการบ้าน**: "${title}"\n**วิชา**: "${sub.name} (${sub.subID})"\n${detail ? `**ข้อมูลเพิ่มเติม**: ${detail}\n` : ''}${dueDate ? `**Date**: ${moment(dueDate).format('LL')}\n` : ''}${dueTime ? `**Time**: ${dueTime}` : ''}`,
	// 			color: ConfigManager.color.green
	// 		}],
	// 		components: []
	// 	});
	// 	const id = result.identifiers[0].id;
	// 	if (!useLocal) {
	// 		const hw = await HomeworkRepository.findOne(id);
	// 		scheduleDeleteJobs(hw);
	// 	}
	// });

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

	const useLocal = (await GuildDataRepository.findOne({ id: interaction.guild.id }))?.useLocal;

	const editPrompt = (options: (string | MessagePayload | WebhookEditMessageOptions) & (InteractionUpdateOptions & { fetchReply?: true; })) => {
		if (interaction.isCommand()) interaction.reply(options);
		else if (interaction.isButton()) (interaction.message as Message).edit(options);
	};

	const hw = await HomeworkRepository.findOne({ id: id, guild: useLocal ? interaction.guild.id : 'GLOBAL' });
	if (!hw)
		editPrompt({
			embeds: [{
				title: `Not Found ${useLocal ? '(LOCAL MODE)' : ''}`,
				description: `Cannot find homework with ID: \`${id}\``,
				color: ConfigManager.color.red
			}],
			components: []
		});
	else {
		await HomeworkRepository.delete(hw.id);
		logger.debug(`deleted ${id}`);
		const format = hw.dueDate.valueOf() != moment(hw.dueDate).endOf('date').valueOf() ? 'lll' : 'll';
		editPrompt({
			embeds: [{
				title: `🗑️ Homework Deleted ${useLocal ? '(LOCAL MODE)' : ''}`,
				description: `📋 **${hw.title}** | ID: \`${hw.id}\`\n\n**Subject**: ${subjects.filter(s => s.subID == hw.subID)[0].name}${hw.detail ? `**\nDetail**: ${hw.detail}` : ''}${hw.dueDate ? `**\n\nDue**: ${moment(hw.dueDate).format(format)} ‼` : ''}`,
				color: ConfigManager.color.green
			}],
			components: []
		});
		if (deleteJobs.has(hw.id)) {
			deleteJobs.get(hw.id).cancel();
			remind1dJobs.get(hw.id).cancel();
			remind1hJobs.get(hw.id).cancel();
			remind10mJobs.get(hw.id).cancel();
			remind5mJobs.get(hw.id).cancel();
			deleteJobs.delete(hw.id);
			remind1dJobs.delete(hw.id);
			remind1hJobs.delete(hw.id);
			remind10mJobs.delete(hw.id);
			remind5mJobs.delete(hw.id);
		}

	};
};