import { TextChannel, MessageEmbed, User, Message, MessageActionRowComponentResolvable, DMChannel, NewsChannel, ThreadChannel, MessageOptions, SelectMenuInteraction } from "discord.js";
import ConfigManager from "./ConfigManager";
import { logger } from "./Logger";


export function inlineCodeBlock(content: string) {
	return `\`\`${content.replace(/`/g, '‎`‎')}\`\``;
}

/**
 * @param separator Defaults to "\n" if not provided.
 */
export function condenseArrayByLengthLimit(list: string[], limit: number, separator: string = '\n') {
	let condensed: string[] = [];
	while (list.length > 0) {
		if (list[0].length > limit) { // Catch when value is tooooo long
			logger.error(`Cannot split value in page feature: length exceeds ${limit} (${list[0].length})`);
			throw (`Cannot split value in page feature: length exceeds ${limit} (${list[0].length})`);
		}
		let buffer = '';
		for (let i = 0; list.length > 0 && buffer.length + list[0].length <= limit; i++) {
			buffer += list.shift() + separator;
		}
		condensed.push(buffer);
	}
	return condensed;
}


export async function sendPage(options: { textChannel: TextChannel | DMChannel | NewsChannel | ThreadChannel, pages?: MessageOptions[], appendPageNumber?: boolean, preMessage?: Message; }) {
	const { textChannel, pages, appendPageNumber, preMessage } = options;

	// if (value.length == 0) value.push('*Empty*');

	if (appendPageNumber) {
		let pagenum = 1;
		pages.forEach(page => {
			try {
				page.embeds[0].footer = { text: page.embeds[0].footer?.text ?? '' + `\nPage ${pagenum++} / ${pages.length}`, iconURL: page.embeds[0].footer?.iconURL };
			} catch (err) {
				logger.warn('Please make sure to provide an embed. ' + err);
			}
		});
	}

	let current_page = 1;
	const page_components: MessageActionRowComponentResolvable[] = [];

	if (pages.length > 1) {
		if (pages.length > 2) page_components.push({
			type: 2,
			style: 2,
			label: '◀ First',
			customId: 'page_first',
			disabled: true
		});
		page_components.push({
			type: 2,
			style: 2,
			label: '◀',
			customId: 'page_previous',
			disabled: true
		});
		page_components.push({
			type: 2,
			style: 2,
			label: '▶',
			// emoji: { name: 'join_arrow', id: '845520716715917314' },
			customId: 'page_next'
		});
		if (pages.length > 2) page_components.push({
			type: 2,
			style: 2,
			label: 'Last ▶',
			customId: 'page_last'
		});
		if (pages.length > 4) page_components.push({
			type: 2,
			style: 2,
			label: '📝 Custom page',
			customId: 'page_choose'
		});
	}

	pages[0].components = page_components.length > 1 ? [{
		type: 1,
		components: page_components
	}] : [];
	let message: Message;
	if (preMessage) {
		message = preMessage;
		message.edit(pages[0]);
	} else {
		message = await textChannel.send(pages[0]);
	}

	const collector = message.createMessageComponentCollector({ filter: interaction => interaction.customId.startsWith('page'), });//, { idle: 900000 }
	collector.on('collect', async interaction => {
		const customID = interaction.customId;
		const user = interaction.user;
		if (customID === 'page_previous') {
			if (current_page > 1) current_page--;
		}
		else if (customID === 'page_next') {
			if (current_page < pages.length) current_page++;
		}
		else if (customID === 'page_first') {
			if (current_page > 1) current_page = 1;
		}
		else if (customID === 'page_last') {
			if (current_page < pages.length) current_page = pages.length;
		}
		else if (customID === 'page_choose') {
			// interaction.defer();
			let page_num = 1;
			const reply = await interaction.reply({
				embeds: [{
					author: {
						name: 'Choose a page to navigate.',
						iconURL: user.displayAvatarURL()
					}
				}],
				components: [{
					type: 'ACTION_ROW',
					components: [{
						type: 'SELECT_MENU',
						placeholder: 'Pick a page',
						customId: JSON.stringify({ type: 'CHOOSE_PAGE', allowedUserId: interaction.user.id, controlMessageId: interaction.message.id }),
						options: pages.map(() => { return { label: `Page ${page_num}`, value: `${page_num++}` }; })
					}]
				}],
				fetchReply: true
			}) as Message;

			let selection: SelectMenuInteraction;
			try {
				selection = await reply.awaitMessageComponent({
					componentType: 'SELECT_MENU', time: 30000, // wait for 5 mins max
					filter: i => {
						const obj = JSON.parse(i.customId);
						return obj.allowedUserId === i.user.id && obj.controlMessageId === interaction.message.id;
					},
				}) as SelectMenuInteraction;
				reply.delete();
			} catch (err) {
				reply.delete();
				return;
			}
			current_page = +selection.values[0];

			selection.deferUpdate();
			// await message.channel.awaitMessages({ filter: (responsemsg: Message) => responsemsg.author.id == user.id, max: 1, time: 60000 }).then(msg => {
			// 	const text = msg.first().content;
			// 	if (!isNaN(+text) && +text >= 1 && +text <= pages.length) {
			// 		current_page = +text;
			// 	} else {
			// 		msg.first().reply('Unknown page').then(unknownmsg => {
			// 			setTimeout(() => {
			// 				unknownmsg.delete();
			// 			}, 5000);
			// 		});
			// 	}
			// 	message.channel.messages.delete(msg.first());
			// 	interaction.deleteReply();
			// }).catch(() => {
			// 	interaction.deleteReply();
			// });
		}

		const previous_index = page_components.findIndex(c => c.customId == 'page_previous');
		const first_index = page_components.findIndex(c => c.customId == 'page_first');
		const next_index = page_components.findIndex(c => c.customId == 'page_next');
		const last_index = page_components.findIndex(c => c.customId == 'page_last');
		if (current_page == 1) {
			if (previous_index != -1) page_components[previous_index].disabled = true;
			if (first_index != -1) page_components[first_index].disabled = true;
			if (next_index != -1) page_components[next_index].disabled = false;
			if (last_index != -1) page_components[last_index].disabled = false;
		} else if (current_page == pages.length) {
			if (previous_index != -1) page_components[previous_index].disabled = false;
			if (first_index != -1) page_components[first_index].disabled = false;
			if (next_index != -1) page_components[next_index].disabled = true;
			if (last_index != -1) page_components[last_index].disabled = true;
		} else {
			if (previous_index != -1) page_components[previous_index].disabled = false;
			if (first_index != -1) page_components[first_index].disabled = false;
			if (next_index != -1) page_components[next_index].disabled = false;
			if (last_index != -1) page_components[last_index].disabled = false;
		}
		pages[current_page - 1].components = page_components.length > 1 ? [{
			type: 1,
			components: page_components
		}] : [];
		message.edit(pages[current_page - 1]);
		if (!interaction?.deferred && !interaction?.replied) interaction.deferUpdate();
	});
	collector.on('end', () => {
		message.components;
	});
	return message;
}

export async function confirm_type<T extends Object>(title: string, list: T[], caller: User, channel: TextChannel, displayingFunction: (_: T) => string): Promise<T | null> {
	const embed = new MessageEmbed({ author: { name: title, iconURL: caller.displayAvatarURL() } });
	if (list.length <= 1) {
		return list[0];
	}
	if (!embed.color) embed.setColor(ConfigManager.color.blue);
	if (!embed.footer) embed.setFooter(`Type "cancel" to cancel.`);

	let items: string[] = [];
	let i = 1;
	list.forEach((item) => {
		if (displayingFunction) {
			items.push(`\`${i}\` - ${displayingFunction(item)}`);
		} else {
			items.push(`\`${i}\` - ${item}`);
		}
		i++;
	});
	const confirm_msg = await sendPage({
		textChannel: channel,
		pages: condenseArrayByLengthLimit(items, 1024).map(i => { return { embeds: [embed.setDescription(i)] }; })
	});
	const collected = await channel.awaitMessages({ filter: response => response.author.id == caller.id, max: 1 });

	const answer_msg = collected.first()!;

	if (channel instanceof TextChannel) {
		if (confirm_msg.deletable && answer_msg.deletable) channel.bulkDelete([confirm_msg, answer_msg]);
		else if (confirm_msg.deletable) confirm_msg.delete();
		else if (answer_msg.deletable) answer_msg.delete();
	}

	if (answer_msg.content.toLowerCase() == 'cancel') {
		channel.send({
			embeds: [{
				title: `Canceled`,
				color: ConfigManager.color.red
			}]
		});
		return null;
	}
	else if (!(Number(answer_msg.content) >= 1 && Number(answer_msg.content) <= list.length)) {
		channel.send({
			embeds: [{
				description: `Invalid index (${inlineCodeBlock(answer_msg.content)}), aborted.`,
				color: ConfigManager.color.red
			}]
		});
		return null;
	}
	else {
		const result = list[Number(answer_msg.content) - 1];
		return result;
	}
}

export function appendTime(date: Date, time: string) {
	if (!time.match(/\d{1,2}:\d{1,2}/g)) throw (`Invalid time string format, provided ${time}`);
	const [hours, mins] = time.split(':');
	date.setHours(+hours, +mins);
	return date;
}