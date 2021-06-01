import { Client, Guild, MessageEmbed, TextChannel } from 'discord.js';
import schedule from 'node-schedule';

import CONFIG from './ConfigManager';
import subjects from './subjects.json';

const bot = new Client();

let guild: Guild;
let channel: TextChannel;

async function initilize() {
	guild = await bot.guilds.fetch(CONFIG.guildId);
	channel = guild.channels.cache.get(CONFIG.channelId) as TextChannel;
}

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

async function announce(subject: typeof subjects[0], period: string) {
	let link = '';
	if (subject.msteam) link = `[Microsoft Teams Channel](${subject.msteam})`;
	const embed = new MessageEmbed({
		author: { name: 'Class Starting' },
		title: `${subject.name}` + subject.subid ? `(${subject.subid})` : '',
		description: `คาบ ${period} เริ่มแล้ว! (${periods_begin[period]} น. - ${periods_end[period]} น.)\n\n${link}`,
		color: Math.floor(Math.random() * (16777215 - 0 + 1)) + 0,
	})
	channel.send('<@&800971217908793384>', embed)
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
		})
	})

})








bot.login(CONFIG.token).then(() => {
	console.log(`Logged in as >> ${bot.user.tag} (${bot.user.id})`)
})