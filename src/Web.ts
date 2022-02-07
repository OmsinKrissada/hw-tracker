import express, { RequestHandler } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import moment from 'moment';
import qs from 'qs';
import cors from 'cors';

import ConfigManager from './ConfigManager';
import { logger } from './Logger';
import { deleteJobs, remind10mJobs, remind1dJobs, remind1hJobs, remind5mJobs, scheduleDeleteJobs, subjects } from './Main';
import { bot } from './Main';
import { HomeworkRepository, WebDataRepository } from './DBManager';
import { Homework } from './models/Homework';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

const app = express();

// CORS
app.use((req, res, next) => {
	const origin = req.get('origin');
	const allowedOrigins = ['https://omsinkrissada.sytes.net', 'http://192.168.1.39:8080', 'https://homework.krissada.com'];
	if (allowedOrigins.includes(origin)) {
		cors({ origin: origin })(req, res, next);
	} else {
		cors({ origin: 'https://homework.krissada.com' })(req, res, next);
	}
});

// Check Content-Type
app.use((req, res, next) => {
	if (req.method.toUpperCase() == 'POST' && !req.is('application/json')) {
		res.status(415).send('only accepts application/json in POST method');
	} else {
		express.json()(req, res, next);
	}
	return;
});

app.use((err, req, res, next) => {
	if (err) {
		res.status(400).send('received malformed JSON');
	}
});

// Real logic

async function refreshToken(user_id: string) {
	logger.debug(`Refresh token for ${user_id}`);
	const { refresh_token } = await WebDataRepository.findOne(user_id);
	const { access_token: new_access_token, refresh_token: new_refresh_token, expires_in: new_expires_in } = (await axios.post('https://discord.com/api/oauth2/token',
		qs.stringify({
			'client_id': bot.application.id,
			'client_secret': ConfigManager.discord.client_secret,
			'grant_type': 'refresh_token',
			'refresh_token': refresh_token
		}), {
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		}
	})).data;
	logger.debug(`${new_access_token} ${new_refresh_token}`);
	return await WebDataRepository.save({ discord_id: user_id, access_token: new_access_token, refresh_token: new_refresh_token, expires_in: new_expires_in });

}

const access_cache = new Set<string>();
async function isAllowedAccess(user_id: string) {
	// Check in cache first
	if (access_cache.has(user_id)) return true;

	let { access_token, expires_in, updated_at } = await WebDataRepository.findOne(user_id);

	if (moment(updated_at).add(expires_in, 'second').isBefore(moment())) {
		({ access_token } = await refreshToken(user_id));
	}

	const bot_guilds = bot.guilds.cache.map(g => g.id);
	const user_guilds: string[] = (await axios.get('https://discord.com/api/users/@me/guilds', {
		headers: {
			'Authorization': `Bearer ${access_token}`
		}
	})).data.map(g => g.id);

	if (user_guilds.some(g => bot_guilds.includes(g))) {
		logger.debug(`added access cache for ${user_id}`);
		access_cache.add(user_id);
		setTimeout(() => {
			access_cache.delete(user_id);
			logger.debug(`removed access cache for ${user_id}`);
		}, 300000);
		return true;
	}
	return false;
}

// my jwt auth
const auth: RequestHandler = function (req, res, next) {
	// return next();
	jwt.verify(req.headers.authorization, ConfigManager.web.jwt_secret, null, (err, decoded) => {
		if (err) {
			res.status(401).send(`jwt: ${err.message}`);
			return;
		}
		console.log(decoded['user_id']);
		const user_id = decoded['user_id'];
		req['user_id'] = user_id;
		if (isAllowedAccess(user_id)) return next();
		return res.status(403).send(`user must share server with the bot`);
	});
};

app.post('/auth/discord', async (req, res) => {
	const { code, state } = req.body;
	if (!code || !state) {
		res.status(400).send('code and state must be provided');
		return;
	}

	// request access token via oauth2
	let access_token: string, refresh_token: string, expires_in: number;
	try {
		({ access_token, refresh_token, expires_in } = (await axios.post('https://discord.com/api/oauth2/token',
			qs.stringify({
				'client_id': bot.application.id,
				'client_secret': ConfigManager.discord.client_secret,
				'grant_type': 'authorization_code',
				'code': code,
				'redirect_uri': ConfigManager.web.redirect_uri
			}), {
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			}
		})).data);
	} catch (err) {
		res.status(500).send(`Discord OAuth: ${err}`);
		return;
	}
	console.log(access_token, refresh_token);
	const user = (await axios.get('https://discord.com/api/users/@me', {
		headers: {
			'Authorization': `Bearer ${access_token}`
		}
	})).data;
	await WebDataRepository.save({ discord_id: user.id, access_token: access_token, refresh_token: refresh_token, expires_in: expires_in });

	if (await isAllowedAccess(user.id)) {
		// 	// const avatarURL = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=1024`;
		const jwt_token = jwt.sign({ user_id: user.id }, ConfigManager.web.jwt_secret, { expiresIn: '1y' });
		return res.send({ access_token: jwt_token, user_id: user.id, user_avatar: user.avatar, user_tag: `${user.username}#${user.discriminator}` });
	} else {
		return res.status(403).send(`user must share server with the bot`);
	}

});


// Resource provider

app.get('/homeworks', auth, async (req, res) => {
	const hws = await HomeworkRepository.find({ where: { guild: 'GLOBAL' }, withDeleted: !req.query.current });
	res.send(hws);
});

app.get('/homeworks/:guild', auth, async (req, res) => {
	res.sendStatus(501);
});

app.get('/subjects', auth, async (req, res) => {
	res.send(subjects);
});

// on form submit (add)
app.post('/homeworks', auth, (req, res) => {
	const { title, detail, subject, dueDate } = req.body;

	if (!title || !subject) {
		res.status(400).send('Malformed data: missing field(s)');
		return;
	}

	console.log(dueDate);

	const hw: QueryDeepPartialEntity<Homework> = {
		title: title,
		subID: subject,
		detail: detail,
		dueDate: dueDate,
		author: req['user_id'],
		guild: 'GLOBAL'
	};

	HomeworkRepository.insert(hw).then(async result => {
		const id = result.identifiers[0].id;
		const hw = await HomeworkRepository.findOne(id);
		if (hw.dueDate) scheduleDeleteJobs(hw);
		return res.sendStatus(201);
	});
});

// on delete
app.delete('/homeworks/:id', auth, async (req, res) => {
	if (isNaN(+req.params.id)) return res.status(400).send('id must be a number');
	const id = +req.params.id;
	const hw = await HomeworkRepository.findOne({ id: id });
	if (!hw) res.sendStatus(404);
	else {
		await HomeworkRepository.delete(hw.id);
		logger.debug(`deleted ${id}`);
		res.status(200).send('deleted');
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
	}
});

const port = process.env.PORT ?? ConfigManager.web.port;
export function listenAPI() {
	app.listen(port, () => logger.info(`Listening on port ${port}`));
}