import { Connection, createConnection, getConnection, Repository } from "typeorm";
import ConfigManager from "./ConfigManager";
import { logger } from "./Logger";
import { Homework } from "./models/Homework";

export let HomeworkRepository: Repository<Homework> = null;

export async function connectDB() {
	let DBConnection: Connection;
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