import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity()
export class WebData {

	@PrimaryColumn({ length: 18 })
	discord_id: string;

	@Column()
	access_token: string;

	@Column()
	refresh_token: string;

	@Column()
	expires_in: number;

	@CreateDateColumn()
	created_at: Date;

	@UpdateDateColumn()
	updated_at: Date;
}