import { TextChannel, MessageEmbed, MessageReaction, User, Message } from "discord.js";
import ConfigManager from "./ConfigManager";


export function inlineCodeBlock(content: string) {
	return `\`\`${content.replace(/`/g, '‎`‎')}\`\``;
}

export async function sendEmbedPage(textChannel: TextChannel, prototype: MessageEmbed, name: string, value: string[], inline = false) {
	let pages: MessageEmbed[] = [];
	while (value.length > 0) {
		let page = new MessageEmbed(prototype);
		let val = '';

		if (value[0].length > 1024) { // Catch when value tooooo long
			console.error(`Cannot split value in page feature: length exceeds 1024 (${value[0].length})`);
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


	let current_page = 0;
	const message = await textChannel.send(pages[0]);

	if (pages.length > 1) {
		if (pages.length > 2) message.react('⏮').catch(() => { });
		message.react('◀').catch(() => { });
		message.react('▶').catch(() => { });
		if (pages.length > 2) message.react('⏭').catch(() => { });
		if (pages.length > 4) message.react('📝').catch(() => { })
	}


	const collector = message.createReactionCollector((_reaction: MessageReaction, user: User) => !user.bot, { time: 1000000 })
	collector.on('collect', (reaction, user) => {
		if (reaction.emoji.name == '◀') {
			message.reactions.resolve('◀')!.users.remove(user);
			if (current_page + 1 > 1) {
				message.edit(pages[--current_page]);
			}
		}
		else if (reaction.emoji.name == '▶') {
			message.reactions.resolve('▶')!.users.remove(user);
			if (current_page + 1 < pages.length) {
				message.edit(pages[++current_page]);
			}
		}
		else if (reaction.emoji.name == '⏮') {
			message.reactions.resolve('⏮')!.users.remove(user);
			if (current_page + 1 > 1) {
				message.edit(pages[0]);
				current_page = 0;
			}
		}
		else if (reaction.emoji.name == '⏭') {
			reaction.remove();
			if (current_page + 1 < pages.length) {
				message.edit(pages[pages.length - 1]);
				current_page = pages.length - 1;
			}
		}
		else if (reaction.emoji.name == '📝') {
			message.reactions.resolve('📝')!.users.remove(user);
			message.channel.send(new MessageEmbed({ author: { name: 'Type page number in chat >>>', iconURL: user.displayAvatarURL() } })).then(ask4pagemsg => {
				message.channel.awaitMessages((responsemsg: Message) => responsemsg.author.id == user.id, { max: 1, time: 60000 }).then(msg => {
					const text = msg.first().content;
					if (!isNaN(+text) && +text >= 1 && +text <= pages.length) {
						message.edit(pages[+text - 1])
					} else {
						msg.first().reply('Unknown page').then(unknownmsg => unknownmsg.delete({ timeout: 5000 }));
					}
					(<TextChannel>message.channel).bulkDelete([ask4pagemsg, msg.first()])
					msg.first().delete();
				}).finally(() => {
					if (!ask4pagemsg.deleted) ask4pagemsg.delete();
				});
			});
		}
		else {
			message.reactions.resolve(reaction.emoji.name).users.remove(user);
		}
	})
	collector.on('end', () => {
		message.reactions.removeAll().catch(() => { });
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