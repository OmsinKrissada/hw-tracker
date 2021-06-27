import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, DeleteDateColumn } from "typeorm";

@Entity({ synchronize: true })
export class Homework {

	@PrimaryGeneratedColumn()
	id: number;

	@Column({ length: 7 })
	subID: string;

	@Column()
	name: string;

	@Column({ nullable: true })
	detail: string;

	@Column({ nullable: true })
	dueDate: Date;

	@Column({ nullable: true })
	dueTime: string;

	@Column({ length: 18 })
	author: string; // Discord user id

	@CreateDateColumn()
	createdAt: Date;

	@DeleteDateColumn()
	deletedAt: Date;

}