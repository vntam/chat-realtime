import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { UserRole } from '../role/user-role.entity';
import { Token } from '../token/token.entity';
import { Exclude } from 'class-transformer';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn()
  user_id: number;

  @Column()
  username: string;

  @Column()
  @Exclude()
  password_hash: string;

  @Column()
  email: string;

  @Column({ nullable: true })
  avatar_url: string;

  @Column({ default: 'active' })
  status: string;

  @Column({ type: 'timestamp', default: () => 'NOW()' })
  created_at: Date;

  @OneToMany(() => UserRole, (ur) => ur.user)
  roles: UserRole[];

  @OneToMany(() => Token, (t) => t.user)
  tokens: Token[];
}
