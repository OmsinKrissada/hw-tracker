import { ButtonInteraction, CommandInteraction, InteractionUpdateOptions, Message, MessageEmbedOptions, MessageOptions, MessagePayload, TextChannel, User, WebhookEditMessageOptions } from 'discord.js';

import { condenseArrayByLengthLimit, confirm_type, includeDeletedCondition as deletedWhereCondition, sendPage } from './Helper';
import { deleteJobs, remindJobs, subjects } from './Main';
import { logger } from './Logger';
import ConfigManager from './ConfigManager';
import { PrismaClient, Homework } from '@prisma/client';
import { endOfDay, format, formatDistanceToNow } from 'date-fns';
import { th, enUS } from 'date-fns/locale';

const prisma = new PrismaClient();

type ConsideringInteraction = CommandInteraction | ButtonInteraction;

export const list = async (interaction: ConsideringInteraction, options?: { showID?: boolean, showDeleted?: boolean; }) => {
	const showID = options?.showID ?? false;
	const showDeleted = options?.showDeleted ?? false;

	const { channel } = interaction;
	if (!channel.isText()) return;

	let hws: Homework[];
	try {
		// hws = await prisma.homework.findMany(showDeleted ? { where: { deletedAt: { not: null } } } : undefined);
		hws = await prisma.homework.findMany({ where: { deletedAt: deletedWhereCondition(showDeleted) } });
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
					title: `📚 Homework List`,
					description: 'The list is empty!'
				}]
			});
		} else if (interaction.message instanceof Message) {
			interaction.message.edit({
				embeds: [{
					title: `📚 Homework List`,
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
		hw.dueDate = new Date(hw.dueDate);
		hw.createdAt = new Date(hw.createdAt);
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
			`${hw.detail ? `**Detail**: ${hw.detail}\n` : ''}` +
			`**Subject**: ${subjects.filter(s => s.subID == hw.subId)[0].name}` +
			`${hw.dueDate && new Date(hw.dueDate).valueOf() !== 0 ? `\n\n**Due**: __${format(hw.dueDate, 'EEEEE d MMM yyyy HH:mm น.', { locale: th })}__ **(${formatDistanceToNow(hw.dueDate, { locale: th })})** ⏰` : ''}`;
	}), 1050);
	const pages = condensed.map((c): MessageOptions => ({ embeds: [{ title: `📚 Homework List`, description: c }] }));

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
		interaction.reply({ content: 'Please visit https://hw.krissada.com/', ephemeral: true });
};
