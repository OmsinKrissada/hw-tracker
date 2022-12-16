import express from 'express';
import { validationResult } from 'express-validator';
import cors from 'cors';
import path from 'path';

import { logger } from './Logger';
import { PrismaClient } from '@prisma/client';
import ConfigManager from './ConfigManager';


export const prisma = new PrismaClient({ errorFormat: 'minimal' });
export const app = express();
export const myValidationResult = validationResult.withDefaults({
	formatter: error => {
		return {
			message: error.msg,
			field: error.param,
			value: error.value
		};
	}
});

app.use((req, res, next) => {
	logger.debug(`HTTP: ${req.method} ${req.url}`);
	next();
});

// CORS
// app.use((req, res, next) => {
// 	const origin = req.get('origin');
// 	const allowedOrigins = ['https://hw.krissada.com', 'http://192.168.1.39:8080', 'https://homework.krissada.com'];
// 	if (allowedOrigins.includes(origin)) {
// 		cors({ origin: origin })(req, res, next);
// 	} else {
// 		cors({ origin: '*' })(req, res, next);
// 	}
// });
app.use(cors());

// Check Content-Type
app.use((req, res, next) => {
	if ((req.method.toUpperCase() == 'POST' || req.method.toUpperCase() == 'PUT' || req.method.toUpperCase() == 'PATCH') && !req.is('application/json')) {
		res.status(415).send({ message: 'only accepts application/json in POST, PUT and PATCH method' });
	} else {
		express.json()(req, res, next);
	}
	return;
});

app.use((err: any, _req: any, res: any, _next: any) => {
	if (err) {
		res.status(400).send({ message: 'received malformed JSON' });
	}
});

// Documentation
app.use('/docs', express.static(path.join(process.cwd(), 'docs/.vitepress/dist')));

const port = process.env.PORT ?? ConfigManager.web.port ?? 3000;
export function listenAPI() {
	app.listen(port, () => logger.info(`HTTP: listening on port ${port}`));
}