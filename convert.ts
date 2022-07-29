import sub from './subjects_old_format.json';
import fs from 'fs';

const converted = sub.map(({ classes, msteam, ...rest }) => {
	return {
		...rest,
		classes: classes.map(c => {
			const [dayOfWeek, period, length] = c.split(' ');
			return { DoW: +dayOfWeek, period: +period, span: +length || 1 };
		})
	};
});

console.log(JSON.stringify(converted, null, '\t'));
fs.writeFileSync('./converted.json', JSON.stringify(converted, null, '\t'));