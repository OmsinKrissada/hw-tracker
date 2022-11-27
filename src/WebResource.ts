import { body, param, query } from 'express-validator';
import { Prisma } from '@prisma/client';


import { logger } from './Logger';
import { deleteJobs, remindJobs, scheduleDeleteJobs, subjects } from './Main';
import { includeDeletedCondition, stringToBoolean } from './Helper';
import { app, myValidationResult, prisma } from './WebManager';
import { auth, refreshToken } from './WebAuth';
import { addSeconds } from 'date-fns';
import axios from 'axios';

const user_select_public = {
	select: {
		id: true,
		email: true,
		discord_id: true,
		nickname: true,
		created_at: true,
		updated_at: true
	}
};

// ----- Real logic -----

// Resource provider

app.get('/subjects', auth, async (req, res) => {
	res.send(subjects);
});

// retrieve homework
app.get('/homeworks',
	auth,
	query('includeUser').optional().isBoolean().withMessage('Must be a boolean'),
	query('withDeleted').optional().isBoolean().withMessage('Must be a boolean'),
	async (req, res) => {
		const errors = myValidationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json(errors.array({ onlyFirstError: true })[0]);
		}

		const hws = await prisma.homework.findMany({
			where: { deletedAt: includeDeletedCondition(stringToBoolean(<any>req.query.withDeleted)) },
			select: {
				authorId: true,
				createdAt: true,
				deletedAt: true,
				detail: true,
				dueDate: true,
				id: true,
				subID: true,
				title: true,
				author: stringToBoolean(<any>req.query.includeUser) ? user_select_public : false
			},
		});
		return res.send(hws);
	}
);

app.get('/homeworks/:id',
	auth,
	param('id').isInt().withMessage('Must be an integer'),
	query('includeUser').optional().isBoolean().withMessage('Must be a boolean'),
	async (req, res) => {
		const errors = myValidationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json(errors.array({ onlyFirstError: true }));
		}
		const id = +req.params.id;

		const hw = await prisma.homework.findUnique({
			where: { id },
			select: {
				authorId: true,
				createdAt: true,
				deletedAt: true,
				detail: true,
				dueDate: true,
				id: true,
				subId: true,
				title: true,
				author: stringToBoolean(<string>req.query.includeUser) ? user_select_public : false
			},
		});
		if (hw)
			return res.send(hw);
		else
			return res.status(404).send({ message: 'Homework not found' });
	}
);

// add homework
app.post('/homeworks',
	auth,
	body('title').notEmpty().withMessage('Field is required').isString().withMessage('Must be a string'),
	body('detail').isLength({ max: 300 }).withMessage('Cannot exceed 300 characters'),
	body('subject').notEmpty().withMessage('Field is required').isString().withMessage('Must be a string'),
	body('dueDate').optional({ checkFalsy: true }).isISO8601().withMessage('Must be a Date string'),
	async (req, res) => {
		const errors = myValidationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json(errors.array({ onlyFirstError: true })[0]);
		}

		const { title, detail, subject, dueDate } = req.body;
		const date = new Date(dueDate);

		// Probably not needed

		// if (dueDate) {
		// 	if (isNaN(date.getTime())) {
		// 		res.status(400).send({ message: 'Invalid Date', field: 'dueDate' });
		// 		return;
		// 	}
		// }

		let create_result;
		try {
			create_result = await prisma.homework.create({
				data: { title, subId: subject, detail, dueDate: date, author: (<any>req)['user_id'] },
			});
			logger.info(`Created homework with following data: ${JSON.stringify(create_result, null, '\t')}`);
		} catch (err: any) {
			return res.status(500).send({ message: `Error: ${err.message}` });
		}
		const create_result_with_author = await prisma.homework.findUnique({
			where: { id: create_result.id },
			include: { author: true }
		});
		if (create_result.dueDate) scheduleDeleteJobs(create_result_with_author);
		return res.status(201).send(create_result);
	}
);


// edit homework
app.patch('/homeworks/:id',
	auth,
	param('id').isInt().withMessage('Must be an integer'),
	body('title').isString(),
	body('detail').isString(),
	body('subject').isString(),
	body('dueDate').isString(),
	async (req, res) => {
		const errors = myValidationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json(errors.array({ onlyFirstError: true })[0]);
		}
		const { title, detail, subject, dueDate } = req.body;
		const date = new Date(dueDate);
		if (isNaN(date.getTime())) {
			res.status(400).send({ message: 'Invalid Date', field: 'dueDate' });
			return;
		}
		const id = +req.params.id;

		// prisma.update
		let update_result;
		try {
			update_result = await prisma.homework.update({
				where: { id: id },
				data: { title, detail, subId: subject, dueDate }
			});
			logger.info(`Updated homework [${id}] with following data: ${JSON.stringify(update_result, null, '\t')}`);
		} catch (err: any) {
			return res.status(500).send({ message: `Error: ${err.message}` });
		}
		return res.send(update_result);
	}
);


// delete homework
app.delete('/homeworks/:id',
	auth,
	param('id').isInt().withMessage('Must be an integer'),
	async (req, res) => {
		const errors = myValidationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json(errors.array({ onlyFirstError: true })[0]);
		}
		const id = +req.params.id;

		const hw = await prisma.homework.findFirst({ where: { id: id, deletedAt: includeDeletedCondition(<any>req.query.withDeleted) } });
		if (!hw) res.sendStatus(404);
		else {
			await prisma.homework.delete({ where: { id: hw.id } });
			logger.debug(`deleted ${id}`);
			res.status(200).send(hw);
			if (deleteJobs.has(hw.id)) {
				deleteJobs.get(hw.id).cancel();
				remindJobs.get(hw.id).forEach(({ job }) => job.cancel());
				deleteJobs.delete(hw.id);
				remindJobs.delete(hw.id);
			}
		}
	}
);


// fallbacks

app.patch('/homeworks', (req, res) => {
	res.send({ message: 'Please use PATCH /homeworks/:id' });
});

app.delete('/homeworks', (req, res) => {
	res.send({ message: 'Please use DELETE /homeworks/:id' });
});


// external resources

app.get('/users/:id', async (req, res) => {
	let { discordId, discordAccessToken: token, discordExpiresIn: expiresIn, discordRefreshedAt: refreshedAt } = await prisma.user.findUnique({
		select: {
			discordId: true,
			discordAccessToken: true,
			updatedAt: true,
			discordExpiresIn: true,
			discordRefreshedAt: true,
		},
		where: {
			id: req.params.id
		}
	});
	if (addSeconds(refreshedAt, expiresIn) < new Date()) {
		({ discordAccessToken: token } = await refreshToken(discordId));
	}
	const { data } = await axios.get('https://discord.com/api/users/@me', {
		headers: {
			Authorization: `Bearer ${token}`
		}
	});

	res.send({
		discordId: discordId,
		tag: `${data.username}#${data.discriminator}`,
		banner: data.banner,
		bannerColor: data.banner_color,
		accentColor: data.accent_color,
		avatarURL: `https://cdn.discordapp.com/avatars/${discordId}/${data.avatar}.png?size=1024`
	});
});