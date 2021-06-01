import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity({ synchronize: false })
export class Subject {

	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	username: string;

	@Column()
	realname: string;

	@Column()
	password: string;

}