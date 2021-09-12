import express from 'express';
import path from 'path';
import jwt from 'jsonwebtoken';
import moment from 'moment';

import ConfigManager from './ConfigManager';
import { logger } from './Logger';
import { scheduleDeleteJobs, subjects } from './Main';
import { bot } from './Main';
import { HomeworkRepository } from './DBManager';

const app = express();
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));

app.use('/assets/:file', (req, res) => {
	res.sendFile(path.join(__dirname, 'assets', req.params.file));
});

app.use('/favicon.ico', (req, res) => {
	res.sendFile(path.join(__dirname, 'assets', 'favicon.ico'));
});

app.get('/', (req, res) => {
	const { token } = req.query;
	const decoded = function () {
		try {
			return jwt.verify(<string>token, ConfigManager.web.jwt_secret);
		} catch (err) {
			logger.debug(`root reject cause: ${err}`);
			res.status(401).render('no_access', { endpoint: ConfigManager.web.endpoint });
			return null;
		}
	}() as any;
	if (decoded == null) return;

	const [username, discriminator] = decoded.issuer.tag.split('#');
	res.render('form', {
		username: username,
		discriminator: discriminator,
		avatarURL: decoded.issuer.avatarURL,
		endpoint: ConfigManager.web.endpoint,
		token: encodeURIComponent(<string>token),
		subjects: subjects.sort((s1, s2) => s1.name.localeCompare(s2.name))
	});
});


app.post('/add/:token', (req, res) => {
	const token = req.params.token;
	const decoded = function () {
		try {
			return jwt.verify(<string>token, ConfigManager.web.jwt_secret);
		} catch (err) {
			logger.debug(`add reject cause: ${err}`);
			res.status(401).render('no_access', { endpoint: ConfigManager.web.endpoint });
			return null;
		}
	}() as any;
	if (decoded == null) return;

	const title = req.body.title.trim();
	const detail = req.body.detail.trim();
	const { subject, date, time } = req.body;

	if (!title || !subject) {
		res.status(400).send('Malformed form data');
		return;
	}

	try {
		const channel = bot.channels.resolve(decoded.channel);

		const hw = {
			name: title,
			subID: subject,
			detail: detail,
			dueDate: date,
			dueTime: time,
			author: decoded.issuer.id,
			guild: decoded.isLocal ? decoded.guild : 'GLOBAL'
		};

		// Copied from Logic.ts ... I have reasons not to implement this as a function
		HomeworkRepository.insert(hw).then(async result => {
			if (!channel.isText()) return;
			channel.send({
				embeds: [{
					author: { name: decoded.issuer.tag, iconURL: decoded.issuer.avatarURL },
					title: `<:checkmark:849685283459825714> Creation Successful ${decoded.isLocal ? '(LOCAL MODE)' : ''}`,
					description: `**หัวข้อการบ้าน**: "${title}"\n**วิชา**: "${subjects.filter(s => s.subID == subject)[0].name} (${subject})"\n${detail ? `**ข้อมูลเพิ่มเติม**: ${detail}\n` : ''}${date ? `**Date**: ${moment(date).format('LL')}\n` : ''}${time ? `**Time**: ${time}` : ''}`,
					color: ConfigManager.color.green
				}],
				components: []
			});
			const id = result.identifiers[0].id;
			if (!decoded.isLocal) {
				const hw = await HomeworkRepository.findOne(id);
				scheduleDeleteJobs(hw);
			}
		});
		res.render('success', { endpoint: ConfigManager.web.endpoint });
	} catch (err) {
		res.status(500).send(`an error occured, please report this back to omsin: \n${err}`);
	}

});


app.listen(ConfigManager.web.port, () => logger.info(`Listening on port ${ConfigManager.web.port}`));