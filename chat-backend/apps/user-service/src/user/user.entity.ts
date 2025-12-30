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

  @Column({
    type: 'integer',
    array: true,
    default: [],
  })
  blocked_users: number[]; // Danh sách user IDs bị chặn

  @Column({
    type: 'jsonb',
    default: {},
  })
  conversation_settings: Record<string, {
    muted?: boolean;          // Tắt thông báo
    muted_until?: Date;      // Tắt đến khi nào (optional)
    pinned?: boolean;         // Đã ghim
    pinned_order?: number;   // Thứ tự ghim
    hidden?: boolean;         // Đã ẩn
    hidden_at?: Date;        // Thời gian ẩn
    last_message_cleared?: Date; // Thời gian clear messages lần cuối
  }>;

  @Column({ type: 'timestamp', default: () => 'NOW()' })
  created_at: Date;

  @OneToMany(() => UserRole, (ur) => ur.user)
  roles: UserRole[];

  @OneToMany(() => Token, (t) => t.user)
  tokens: Token[];
}
