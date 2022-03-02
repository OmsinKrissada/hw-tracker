import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, DeleteDateColumn } from "typeorm";

@Entity({ name: 'homework' })
export class Homework_Default {

	@PrimaryGeneratedColumn()
	id: number;

	@Column({ length: 7 })
	subID: string;

	@Column()
	title: string;

	@Column({ length: 300, nullable: true })
	detail: string;

	@Column({ nullable: true, precision: 3 })
	dueDate: Date;

	@Column({ length: 18 })
	author: string; // Discord user id

	@Column({ length: 18, default: 'GLOBAL' })
	guild: string | 'GLOBAL';

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
	title: string;

	@Column({ nullable: true })
	detail: string;

	@Column({ nullable: true, precision: 3 })
	dueDate: Date;

	@Column({ length: 18 })
	author: string; // Discord user id

	@Column({ length: 18, default: 'GLOBAL' })
	guild: string | 'GLOBAL';

	@CreateDateColumn()
	createdAt: Date;

	@DeleteDateColumn()
	deletedAt: Date;

}

export type Homework = Homework_MySQL | Homework_Default;