import winston from 'winston';
import fs from 'fs';
import { createGzip } from 'zlib';

// Checks if file directory exists, if not, create them.
if (!fs.existsSync('./logs')) {
	fs.mkdirSync('./logs');
}

// Renames latest.log to its datetime name, then compressses it.
if (fs.existsSync('./logs/latest.log')) {
	const newFilename = `./logs/${fs.statSync('./logs/latest.log').ctime.toISOString().replace(/:/g, '_')}.log`;
	fs.renameSync('./logs/latest.log', newFilename);
	const gzip = createGzip();
	fs.createReadStream(newFilename).pipe(gzip).pipe(fs.createWriteStream(newFilename + '.gz')).once('finish', () => fs.rmSync(newFilename));
}

class LoggerClass {
	private readonly internal_logger: winston.Logger;

	constructor() {
		// const coloredLevelString = (level: string) => {
		// 	if (level == 'info') return 'INFO';
		// 	if (level == 'warn') return 'WARN';
		// 	if (level == 'error') return 'ERROR';
		// 	if (level == 'debug') return 'DEBUG';
		// 	return level;
		// };
		const console_format = winston.format.combine(
			winston.format.colorize(),
			winston.format.timestamp({
				format: "HH:mm:ss"
			}),
			winston.format.printf(
				log => `${log.level} ${(log.message)}`
			));
		const file_format = winston.format.combine(
			winston.format.timestamp({
				format: "isoDateTime",
			}),
			winston.format.printf(
				log => `${log.timestamp} ${log.level.toUpperCase()} ${(log.message)}`
			));

		this.internal_logger = winston.createLogger({
			transports: [
				new winston.transports.Console({ level: 'debug', format: console_format, handleExceptions: true }),
				new winston.transports.File({ level: 'debug', filename: './logs/latest.log', format: file_format, handleExceptions: true }),
			],
			exitOnError: true,
		});
	}


	info(message: any) {
		this.internal_logger.info(message.toString());
	}
	warn(message: any) {
		this.internal_logger.warn(message.toString());
	}
	error(message: any) {
		this.internal_logger.error(message.toString());
	}
	debug(message: any) {
		this.internal_logger.debug(message.toString());
	}
}

export const logger = new LoggerClass();