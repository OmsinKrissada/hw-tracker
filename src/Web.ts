import express from 'express';
import path from 'path';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import moment from 'moment';
import qs from 'qs';

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

// Real logic

app.get('/add/redirect', async (req, res) => {
	const { code, state } = req.query;
	if (!code || !state) {
		res.status(401).render('no_access', { endpoint: ConfigManager.web.endpoint, cause: `Missing code/state query` });
		return;
	}

	const parsed = function () {
		try {
			return JSON.parse(Buffer.from(<string>state, 'base64url').toString());
		} catch (err) {
			logger.debug(`error decoding parsed state`);
			res.status(401).render('no_access', { endpoint: ConfigManager.web.endpoint, cause: `${err}` });
			return null;
		}
	}() as any;

	const { guild, channel, isLocal } = parsed;
	if (!guild || !channel || isLocal == undefined) {
		res.status(400).render('no_access', { endpoint: ConfigManager.web.endpoint, cause: `Malformed state query, try re-running the command or contact me.` });
		return;
	}

	// request access token via oauth2
	try {
		const accessToken = (await axios.post('https://discord.com/api/oauth2/token',
			qs.stringify({
				'client_id': bot.application.id,
				'client_secret': ConfigManager.discord.client_secret,
				'grant_type': 'authorization_code',
				'code': code,
				'redirect_uri': ConfigManager.web.endpoint + '/add/redirect'
			}), {
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			}
		})).data.access_token;

		const user = (await axios.get('https://discord.com/api/users/@me', {
			headers: {
				'Authorization': `Bearer ${accessToken}`
			}
		})).data;

		// check access permission
		let isPresent;
		try {
			await bot.guilds.resolve(guild).members.fetch({ user: user.id, force: true });
			isPresent = true;
		} catch (err) {
			isPresent = false;
		}
		if (isPresent) {
			const avatarURL = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=1024`;
			const jwt_token = jwt.sign({ guild: guild, channel: channel, issuer: { id: user.id, username: user.username, discriminator: user.discriminator, avatarURL: avatarURL }, isLocal: isLocal }, ConfigManager.web.jwt_secret, { expiresIn: '1h' });
			res.redirect(`${ConfigManager.web.endpoint}/add?token=${jwt_token}`);
			return;
		} else {
			res.status(403).render('no_access', { endpoint: ConfigManager.web.endpoint, cause: `You are not in the server this link was created in.` });
			return;
		}

	} catch (err) {
		res.status(401).render('no_access', { endpoint: ConfigManager.web.endpoint, cause: `Invalid code query. Remind that the link is for one-time use.\nIf this is not your fault, please send this to me: ${err}` });
		// logger.warn(`${err}`);
		return;
	}


});

app.get('/add', (req, res) => {
	try {
		const decoded = jwt.verify(req.query.token as string, ConfigManager.web.jwt_secret) as jwt.JwtPayload;
		res.render('form', {
			username: decoded.issuer.username,
			discriminator: decoded.issuer.discriminator,
			avatarURL: decoded.issuer.avatarURL,
			endpoint: ConfigManager.web.endpoint,
			token: encodeURIComponent(req.query.token as string),
			subjects: subjects.sort((s1, s2) => s1.name.localeCompare(s2.name))
		});
	} catch (err) {
		res.status(403).render('no_access', { endpoint: ConfigManager.web.endpoint, cause: `Invalid token.` });
		return;
	}
});

app.get('/add/success', (req, res) => {
	res.render('success', { endpoint: ConfigManager.web.endpoint });
});

// on form submit
app.post('/add/:token', (req, res) => {


	const title = req.body.title.trim();
	const detail = req.body.detail.trim();
	const { subject, date, time } = req.body;

	if (!title || !subject) {
		res.status(400).send('Malformed form data: missing field(s)');
		return;
	}

	try {
		const decoded = jwt.verify(req.params.token, ConfigManager.web.jwt_secret) as jwt.JwtPayload;
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
					author: { name: `${decoded.issuer.username}#${decoded.issuer.discriminator}`, iconURL: decoded.issuer.avatarURL },
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
		res.redirect(ConfigManager.web.endpoint + '/add/success');
	} catch (err) {
		res.status(500).send(`an error occured, please report this back to omsin: \n${err}`);
	}

});

const port = process.env.PORT ?? ConfigManager.web.port;
app.listen(port, () => logger.info(`Listening on port ${port}`));