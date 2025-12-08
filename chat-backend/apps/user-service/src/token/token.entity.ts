import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../user/user.entity';

@Entity({ name: 'tokens' })
export class Token {
  @PrimaryGeneratedColumn()
  token_id: number;

  @Column()
  user_id: number;

  @Column('text')
  access_token: string;

  @Column('text')
  refresh_token: string;

  @Column({ type: 'timestamp' })
  expired_at: Date;

  @ManyToOne(() => User, (u) => u.tokens)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
