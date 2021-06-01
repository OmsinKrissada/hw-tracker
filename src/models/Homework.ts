import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity({ synchronize: false })
export class Homework {

	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	subject: number //subject id

	@Column()
	name: string;

	@Column()
	duedate: Date;

}