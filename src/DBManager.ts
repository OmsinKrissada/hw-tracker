import { createConnection, getConnection, Repository } from "typeorm";
import { Homework } from "./models/Homework";

export let HomeworkRepository: Repository<Homework> = null;
export const HomeworkConnection = createConnection({
	"type": "mysql",
	"host": "omsinkrissada.sytes.net",
	"port": 3306,
	"username": "hw_tracker",
	"password": "fioeioewfioewadfefw2432432323f3wf",
	"database": "hw_tracker",
	"synchronize": true,
	"logging": false,
	"charset": "utf8mb4",
	"entities": [Homework],
}).then(connection => {
	HomeworkRepository = connection.getRepository(Homework);
})