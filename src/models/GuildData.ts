import { Entity, Column, PrimaryColumn } from "typeorm";

@Entity({ name: 'guild' })
export class GuildData {

	@PrimaryColumn({ length: 18 })
	id: string;

	@Column({ default: false })
	useLocal: boolean;

}