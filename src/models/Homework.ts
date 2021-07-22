import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, DeleteDateColumn } from "typeorm";

@Entity({ name: 'homework' })
export class Homework_Default {

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

@Entity({ name: 'homework' })
export class Homework_MySQL {

	@PrimaryGeneratedColumn()
	id: number;

	@Column({ length: 7 })
	subID: string;

	@Column()
	name: string;

	@Column({ nullable: true })
	detail: string;

	@Column({ type: 'date', nullable: true })
	dueDate: Date;

	@Column({ type: 'time', nullable: true })
	dueTime: string;

	@Column({ length: 18 })
	author: string; // Discord user id

	@CreateDateColumn()
	createdAt: Date;

	@DeleteDateColumn()
	deletedAt: Date;

}

export type Homework = Homework_MySQL | Homework_Default;