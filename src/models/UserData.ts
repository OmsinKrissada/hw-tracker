import { Entity, PrimaryGeneratedColumn, Column, PrimaryColumn, ManyToOne } from "typeorm";

@Entity({ synchronize: true })
export class UserData {

	@PrimaryColumn({ type: "varchar", length: 18 })
	id: string;

	// @ManyToOne()
	@Column()
	homework_id: number;




}