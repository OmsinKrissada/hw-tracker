import * as fs from 'fs';
import yaml from 'js-yaml';
// import YamlValidator from 'yaml-validator';



/*
 * Please sync structure in IConfig and validator
 * Hope you won't miss it :)
 */


interface ConfigOption {
	token: string;
	guildId: `${bigint}`;
	channelId: `${bigint}`;
	subscriber_role: `${bigint}`;
	source_link: string;
	database: 'mysql' | 'sqlite' | 'postgres';
	mysql: {
		dbname: string;
		hostname: string;
		port: number;
		username: string;
		password: string;
	};
	postgres: {
		dbname: string;
		hostname: string;
		port: number;
		username: string;
		password: string;
	};
	sqlite: {
		dbpath: string;
	};
	color: {
		red: number;
		blue: number;
		green: number;
		yellow: number;
		aqua: number;
		pink: number;
	};
	pause_announce: boolean;
	dev_mode: boolean;
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
