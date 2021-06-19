import { Connection, createConnection, getConnection, Repository } from "typeorm";
import ConfigManager from "./ConfigManager";
import { logger } from "./Logger";
import { Homework } from "./models/Homework";

export let HomeworkRepository: Repository<Homework> = null;



export async function connectDB() {
	let DBConnection: Connection;
	if (ConfigManager.database == 'mysql') {
		logger.info('Connecting to MySQL server ...');
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
			logger.info('Successfully connected to MySQL server.');
			HomeworkRepository = DBConnection.getRepository(Homework);
		} catch (err) {
			logger.error('Failed to connect to MySQL server: ' + err.message);
			logger.error('Exiting . . .');
			process.exit(1);
		}
	}

	else if (ConfigManager.database == 'sqlite') {
		logger.info('Connecting to SQLite database ...');
		try {
			DBConnection = await createConnection({
				"type": "sqlite",
				"database": ConfigManager.sqlite.dbpath,
				"synchronize": true,
				"logging": false,
				"entities": [Homework],
			});
			logger.info('Successfully connected to SQLite database.');
			HomeworkRepository = DBConnection.getRepository(Homework);
		} catch (err) {
			logger.error('Failed to connect to SQLite database: ' + err.message);
			logger.error('Exiting . . .');
			process.exit(1);
		}
	}

	else {
		logger.error(`Unknown database type: '${ConfigManager.database}', possible values are 'mysql' or 'sqlite'.`);
		logger.error('Exiting . . .');
		process.exit(1);
	}
}

