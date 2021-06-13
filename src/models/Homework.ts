import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity({ synchronize: true })
export class Homework {

	@PrimaryGeneratedColumn()
	id: number;

	@Column({ type: "varchar", length: 7 })
	subID: string

	@Column()
	name: string;

	@Column({ nullable: true })
	detail: string;

	@Column({ type: 'date', nullable: true })
	dueDate: Date;

	@Column({ type: 'time', nullable: true })
	dueTime: string;

	@Column({ type: "varchar", length: 18 })
	author: string; // Discord user id

	@CreateDateColumn()
	createdAt: Date;

}