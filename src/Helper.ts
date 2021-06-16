import { TextChannel, MessageEmbed, MessageReaction, User, Message, MessageActionRowComponentResolvable, MessageComponent, MessageComponentInteraction } from "discord.js";
import ConfigManager from "./ConfigManager";
import { logger } from "./Logger";


export function inlineCodeBlock(content: string) {
	return `\`\`${content.replace(/`/g, '‎`‎')}\`\``;
}

export async function sendEmbedPage(textChannel: TextChannel, prototype: MessageEmbed, name: string, value: string[], inline = false) {
	let pages: MessageEmbed[] = [];
	if (value.length == 0) value.push('*Empty*');
	while (value.length > 0) {
		let page = new MessageEmbed(prototype);
		page.setTimestamp();
		let val = '';

		if (value[0].length > 1024) { // Catch when value tooooo long
			logger.error(`Cannot split value in page feature: length exceeds 1024 (${value[0].length})`);
			break;
		}

		for (let i = 0; value.length > 0 && val.length + value[0].length <= 1024; i++) {
			val += value.shift() + (inline ? '' : '\n');
		}

		if (val.length > 0) page.addFields({ name: name, value: val });
		pages.push(page);
	}

	let pagenum = 1;
	pages.forEach(page => {
		page.setFooter(page.footer ? page.footer.text + `\nPage ${pagenum++} / ${pages.length}` : `Page ${pagenum++} / ${pages.length} `);
	})


	let current_page = 1;
	const page_components: MessageActionRowComponentResolvable[] = [];

	if (pages.length > 1) {
		if (pages.length > 2) page_components.push({
			type: 2,
			style: 2,
			label: '◀ First',
			customID: 'page_first'
		})
		page_components.push({
			type: 2,
			style: 2,
			label: '◀',
			customID: 'page_previous'
		})
		page_components.push({
			type: 2,
			style: 2,
			label: '▶',
			// emoji: { name: 'join_arrow', id: '845520716715917314' },
			customID: 'page_next'
		})
		if (pages.length > 2) page_components.push({
			type: 2,
			style: 2,
			label: 'Last ▶',
			customID: 'page_last'
		})
		if (pages.length > 4) page_components.push({
			type: 2,
			style: 2,
			label: '📝 Custom page',
			customID: 'page_choose'
		})
	}

	const message = await textChannel.send({
		embed: pages[0],
		components: page_components.length > 1 ? [{
			type: 1,
			components: page_components
		}] : []
	});

	const collector = message.createMessageComponentInteractionCollector(interaction => interaction.customID.startsWith('page'))//, { idle: 900000 }
	collector.on('collect', async interaction => {
		const customID = interaction.customID;
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
			await interaction.reply(new MessageEmbed({ author: { name: 'Type page number in chat >>>', iconURL: user.displayAvatarURL() } }));
			await message.channel.awaitMessages((responsemsg: Message) => responsemsg.author.id == user.id, { max: 1, time: 60000 }).then(msg => {
				const text = msg.first().content;
				if (!isNaN(+text) && +text >= 1 && +text <= pages.length) {
					current_page = +text;
				} else {
					msg.first().reply('Unknown page').then(unknownmsg => {
						setTimeout(() => {
							unknownmsg.delete()
						}, 5000);
					});
				}
				message.channel.messages.delete(msg.first());
				interaction.deleteReply();
			}).catch(() => {
				interaction.deleteReply();
			});
		}

		const previous_index = page_components.findIndex(c => c.customID == 'page_previous');
		const first_index = page_components.findIndex(c => c.customID == 'page_first');
		const next_index = page_components.findIndex(c => c.customID == 'page_next');
		const last_index = page_components.findIndex(c => c.customID == 'page_last');
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
		message.edit({ embed: pages[current_page - 1], components: [{ type: 1, components: page_components }] })
		if (!interaction?.deferred && !interaction?.replied) interaction.deferUpdate();
	})
	collector.on('end', () => {
		message.components
	})
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
	})
	const confirm_msg = await sendEmbedPage(<TextChannel>channel, embed, '​', items)
	const collected = await channel.awaitMessages(response => response.author.id == caller.id, { max: 1 });

	const answer_msg = collected.first()!;

	if (channel instanceof TextChannel) {
		if (confirm_msg.deletable && answer_msg.deletable) channel.bulkDelete([confirm_msg, answer_msg]);
		else if (confirm_msg.deletable) confirm_msg.delete();
		else if (answer_msg.deletable) answer_msg.delete();
	}

	if (answer_msg.content.toLowerCase() == 'cancel') {
		channel.send(new MessageEmbed({
			title: `Canceled`,
			color: ConfigManager.color.red
		}));
		return null;
	}
	else if (!(Number(answer_msg.content) >= 1 && Number(answer_msg.content) <= list.length)) {
		channel.send(new MessageEmbed({
			description: `Invalid index (${inlineCodeBlock(answer_msg.content)}), aborted.`,
			color: ConfigManager.color.red
		}));
		return null;
	}
	else {
		const result = list[Number(answer_msg.content) - 1];
		return result;
	}
}