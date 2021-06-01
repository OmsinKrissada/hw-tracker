import * as fs from 'fs';
import yaml from 'js-yaml';
import YamlValidator from 'yaml-validator';



/*
 * Please sync structure in IConfig and validator
 * Hope you won't miss it :)
 */


interface ConfigOption {
	token: string;
	guildId: string;
	channelId: string;
}

const validator = new YamlValidator({
	log: false,
	structure: {
		token: 'string'
	},
	onWarning: undefined,
	writeJson: false
});
validator.validate(['./config.yml']);
if (validator.report()) {
	console.error('ERROR: Bad Configuration Format');
	process.exit();
}

export default <ConfigOption>(yaml.safeLoad(fs.readFileSync('./config.yml', 'utf8')));
