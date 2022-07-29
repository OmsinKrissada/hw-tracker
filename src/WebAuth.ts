import express, { RequestHandler } from 'express';
import { body, check, param, validationResult } from 'express-validator';
import axios, { AxiosError } from 'axios';
import jwt from 'jsonwebtoken';
import qs from 'qs';
import cors from 'cors';
import bcrypt from 'bcrypt';

import ConfigManager from './ConfigManager';
import { logger } from './Logger';
import { deleteJobs, remindJobs, scheduleDeleteJobs, subjects } from './Main';
import { bot } from './Main';
import { PrismaClient } from '@prisma/client';
import { addSeconds } from 'date-fns';
import { includeDeletedCondition } from './Helper';
import { app, myValidationResult, prisma } from './WebManager';

const JWT_VERSION = 'v2';

async function refreshToken(user_id: string) {
	logger.debug(`Refresh token for ${user_id}`);
	const { discord_refresh_token } = await prisma.user.findUnique({ where: { discord_id: user_id } });
	const { access_token: new_access_token, refresh_token: new_refresh_token, expires_in: new_expires_in } = (await axios.post('https://discord.com/api/oauth2/token',
		qs.stringify({
			'client_id': bot.application.id,
			'client_secret': ConfigManager.discord.client_secret,
			'grant_type': 'refresh_token',
			'refresh_token': discord_refresh_token
		}), {
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		}
	})).data;
	logger.debug(`${new_access_token} ${new_refresh_token}`);
	return await prisma.user.update({ where: { discord_id: user_id }, data: { discord_access_token: new_access_token, discord_refresh_token: new_refresh_token, discord_expires_in: new_expires_in } });

}

const access_cache = new Set<string>();
async function isAllowedAccess(user_id: string) {
	// Check in cache first
	if (access_cache.has(user_id)) return true;

	let { discord_access_token, discord_expires_in, updated_at } = await prisma.user.findUnique({ where: { discord_id: user_id } });

	if (addSeconds(updated_at, discord_expires_in) < new Date()) {
		({ discord_access_token } = await refreshToken(user_id));
	}

	const bot_guilds = bot.guilds.cache.map(g => g.id);
	const user_guilds: string[] = (await axios.get('https://discord.com/api/users/@me/guilds', {
		headers: {
			'Authorization': `Bearer ${discord_access_token}`
		}
	})).data.map((g: any) => g.id);

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
export const auth: RequestHandler = function (req, res, next) {
	// return next();
	jwt.verify(req.headers.authorization, ConfigManager.web.jwt_secret, null, (err, decoded: any) => {
		if (err) {
			res.status(401).send(`jwt: ${err.message}`);
			return;
		}
		logger.debug(`Checking permission for ${decoded['id']}`);
		const user_id = decoded['id'];
		type Request = typeof req;
		interface ExtendedRequest extends Request {
			user_id: string;
		}
		(<ExtendedRequest>req).user_id = user_id;
		if (isAllowedAccess(user_id)) return next();
		return res.status(403).send({ message: `user must share server with the bot` });
	});
};

app.post('/auth/discord',
	body('code').notEmpty().withMessage('Field is required'),
	body('state').notEmpty().withMessage('Field is required'),
	async (req, res) => {
		const errors = myValidationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json(errors.array({ onlyFirstError: true }));
		}
		const { code, state } = req.body;

		// request access token via oauth2
		let access_token: string, refresh_token: string, expires_in: number;
		try {
			const oauth_response = await axios.post('https://discord.com/api/oauth2/token',
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
			});
			({ access_token, refresh_token, expires_in } = oauth_response.data);
		} catch (err) {
			if (err instanceof AxiosError) {
				logger.error(`Failed to contact Discord OAuth server: ${err.response.status} ${JSON.stringify(err.response.data)}`);
				res.status(500).send({ message: `Failed to contact Discord OAuth server`, response_status: err.response.status, response_data: err.response.data });
			}
			else {
				logger.error(`Failed to contact Discord OAuth server: ${err}`);
				res.status(500).send({ message: `Failed to contact Discord OAuth server: ${err}` });
			}
			return;
		}
		const user = (await axios.get('https://discord.com/api/users/@me', {
			headers: {
				'Authorization': `Bearer ${access_token}`
			}
		})).data;
		logger.info(`New web login (Discord OAuth): Nickname: unknown, Tag: ${user.username}#${user.discriminator}, ID: ${user.id}`);

		let updated_user;
		try {
			updated_user = await prisma.user.upsert({
				where: { discord_id: user.id },
				update: { discord_access_token: access_token, discord_refresh_token: refresh_token, discord_expires_in: expires_in },
				create: { email: user.email, discord_id: user.id, discord_access_token: access_token, discord_refresh_token: refresh_token, discord_expires_in: expires_in }
			});
		} catch (err) {
			return res.status(500).send({ message: `Failed to authenticate user: ${err}` });
		}

		// const avatarURL = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=1024`;
		const jwt_token = jwt.sign({ version: JWT_VERSION, id: updated_user.id }, ConfigManager.web.jwt_secret, { expiresIn: '1y' });
		return res.send({ access_token: jwt_token, id: updated_user.id });

	}
);

app.post('/auth/password/register',
	body('email').isEmail().withMessage('Field is required'),
	body('password').notEmpty().withMessage('Field is required'),
	async (req, res) => {
		const errors = myValidationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json(errors.array({ onlyFirstError: true }));
		}
		const { email, password } = req.body;

		const user = await prisma.user.findUnique({ where: { email } });
		if (user)
			return res.status(400).send({ message: `Email already registered` });
		const hash = bcrypt.hashSync(password, 10);
		const new_user = await prisma.user.create({
			data: {
				email,
				password: hash

			}
		});
		res.status(201).send({ id: new_user.id, email: new_user.email });
	}
);

app.post('/auth/password/change',
	auth,
	body('password').notEmpty().withMessage('Field is required'),
	async (req, res) => {
		const errors = myValidationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json(errors.array({ onlyFirstError: true }));
		}
		const { password } = req.body;

		const user = await prisma.user.findUnique({ where: { id: (<any>req).user_id } });
		if (!user)
			return res.status(500).send({ message: `User not found in database` }); // TODO: move this to new access check method
		const hash = bcrypt.hashSync(password, 10);
		await prisma.user.update({
			where: { id: user.id },
			data: {
				password: hash
			}
		});
		res.send({ message: `Password updated` });
	}
);

app.post('/auth/password/login',
	body('email').notEmpty().withMessage('Field is required').isEmail().withMessage('Field must be an email'),
	body('password').notEmpty().withMessage('Field is required'),
	async (req, res) => {
		const errors = myValidationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json(errors.array({ onlyFirstError: true }));
		}
		const { email, password } = req.body;

		// grab user from database
		let user;
		try {
			user = await prisma.user.findUnique({ where: { email } });
			if (!user)
				return res.status(404).send({ message: `user not found` });
		} catch (err) {
			return res.status(500).send({ message: `Failed to retrieve user from database` });
		}

		// check password
		try {
			const result = bcrypt.compareSync(password, user.password);
			if (!result) {
				return res.status(403).send({ message: `Invalid password` });
			}
			const payload = { version: JWT_VERSION, id: user.id };
			const jwt_token = jwt.sign(payload, ConfigManager.web.jwt_secret, { expiresIn: '1y' });
			return res.send({ access_token: jwt_token, id: user.id });
		} catch (err) {
			return res.status(500).send({ message: `Failed to validate password` });

		}
	}
);