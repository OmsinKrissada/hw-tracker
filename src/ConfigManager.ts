import * as fs from 'fs';
import yaml from 'js-yaml';
// import YamlValidator from 'yaml-validator';



/*
 * Please sync structure in IConfig and validator
 * Hope you won't miss it :)
 */


interface ConfigOption {
	readonly token: string;
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
}

// const validator = new YamlValidator({
// 	log: false,
// 	structure: {
// 		token: 'string',
// 		guildId: 'string',
// 		channelId: 'string'
// 	},
// 	onWarning: undefined,
// 	writeJson: false
// });
// validator.validate(['./config.yml']);
// if (validator.report()) {
// 	console.error('ERROR: Bad Configuration Format');
// 	process.exit();
// }

export default <ConfigOption>(yaml.safeLoad(fs.readFileSync('./config.yml', 'utf8')));
