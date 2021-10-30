import * as fs from 'fs';
import yaml from 'js-yaml';
import { logger } from './Logger';
// import YamlValidator from 'yaml-validator';



/*
 * Please sync structure in IConfig and validator
 * Hope you won't miss it :)
 */


interface ConfigOption {
	readonly discord: {
		readonly token: string;
		readonly client_secret: string;
	};
	readonly remind1d: boolean;
	readonly remind1hr: boolean;
	readonly remind10m: boolean;
	readonly remind5m: boolean;
	readonly guildId: `${bigint}`;
	readonly channelId: `${bigint}`;
	readonly subscriber_role: `${bigint}`;
	readonly source_link: string;
	readonly database: 'mysql' | 'sqlite' | 'postgres';
	readonly mysql: {
		readonly dbname: string;
		readonly hostname: string;
		readonly port: number;
		readonly username: string;
		readonly password: string;
	};
	readonly postgres: {
		readonly dbname: string;
		readonly hostname: string;
		readonly port: number;
		readonly username: string;
		readonly password: string;
	};
	readonly sqlite: {
		readonly dbpath: string;
	};
	readonly color: {
		readonly red: number;
		readonly blue: number;
		readonly green: number;
		readonly yellow: number;
		readonly light_yellow: number;
		readonly aqua: number;
		readonly pink: number;
	};
	readonly update_commands: boolean;
	readonly pause_announce: boolean;
	readonly dev_mode: boolean;

	readonly web: {
		readonly enable: boolean;
		readonly port: number;
		readonly redirect_uri: string;
		readonly jwt_secret: string;
	};
}

let loaded;
try {
	loaded = yaml.safeLoad(fs.readFileSync('./config.yml', 'utf8'));
} catch (err) {
	logger.error(`Unable to load config file, this is probably caused by format error.\n${err}`);
}
export default <ConfigOption>(loaded);
