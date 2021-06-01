import { createConnection, getConnection, Repository } from "typeorm";
import { Homework } from "./models/Homework";
;
export let HomeworkRepository: Repository<Homework> = null;
export const HomeworkConnection = createConnection({
	"type": "mysql",
	"host": "omsinkrissada.sytes.net",
	"port": 3306,
	"username": "HWTracker",
	"password": "Homeworkpasswordatubunsin",
	"database": "Homework",
	"synchronize": true,
	"logging": false,
	"entities": [Homework],
}).then(connection => {
	HomeworkRepository = connection.getRepository(Homework);
})