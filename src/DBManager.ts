import { Connection, createConnection, getConnection, Repository } from "typeorm";
import ConfigManager from "./ConfigManager";
import { logger } from "./Logger";
import { Homework } from "./models/Homework";

export let HomeworkRepository: Repository<Homework> = null;

async function connectMySQL() {
	const name = 'MySQL';
	logger.info(`Connecting to ${name} server ...`);
	let DBConnection: Connection;
	try {
		DBConnection = await createConnection({
			"type": "mysql",
			"host": ConfigManager.mysql.hostname,
			"port": ConfigManager.mysql.port,
			"username": ConfigManager.mysql.username,
			"password": ConfigManager.mysql.password,
			"database": ConfigManager.mysql.dbname,
			"synchronize": true,
			"logging": false,
			"charset": "utf8mb4",
			"entities": [Homework],
		});
		logger.info(`Successfully connected to ${name} server.`);
		HomeworkRepository = DBConnection.getRepository(Homework);
	} catch (err) {
		logger.error(`Failed to connect to ${name} server: ` + err.message);
		logger.error('Exiting . . .');
		process.exit(1);
	}
}

async function connectSQLite() {
	const name = 'SQLite';
	logger.info(`Connecting to ${name} database ...`);
	let DBConnection: Connection;
	try {
		DBConnection = await createConnection({
			"type": "sqlite",
			"database": ConfigManager.sqlite.dbpath,
			"synchronize": true,
			"logging": false,
			"entities": [Homework],
		});
		logger.info(`Successfully connected to ${name} database.`);
		HomeworkRepository = DBConnection.getRepository(Homework);
	} catch (err) {
		logger.error(`Failed to connect to ${name} database: ` + err.message);
		logger.error('Exiting . . .');
		process.exit(1);
	}
}

async function connectPostgreSQL() {
	const name = 'PostgreSQL';
	logger.info(`Connecting to ${name} server ...`);
	let DBConnection: Connection;
	try {
		DBConnection = await createConnection({
			"type": "postgres",
			"host": ConfigManager.postgres.hostname,
			"port": ConfigManager.postgres.port,
			"username": ConfigManager.postgres.username,
			"password": ConfigManager.postgres.password,
			"database": ConfigManager.postgres.dbname,
			"synchronize": true,
			"logging": false,
			"entities": [Homework],
		});
		logger.info(`Successfully connected to ${name} server.`);
		HomeworkRepository = DBConnection.getRepository(Homework);
	} catch (err) {
		logger.error(`Failed to connect to ${name} server: ` + err.message);
		logger.error('Exiting . . .');
		process.exit(1);
	}
}

export async function connectDB() {

	if (ConfigManager.database == 'mysql') await connectMySQL();
	else if (ConfigManager.database == 'sqlite') await connectSQLite();
	else if (ConfigManager.database == 'postgres') await connectPostgreSQL();
	else {
		logger.error(`Unknown database type: '${ConfigManager.database}', possible values are 'mysql', 'sqlite' or 'postgres'. If you have no idea about this, use 'sqlite'.`);
		logger.error('Exiting . . .');
		process.exit(1);
	}
}

