import { Entity, Column, ManyToOne, PrimaryColumn, JoinColumn } from 'typeorm';
import { User } from '../user/user.entity';
import { Role } from '../role/role.entity';

@Entity({ name: 'user_role' })
export class UserRole {
  @PrimaryColumn()
  user_id: number;

  @PrimaryColumn()
  role_id: number;

  @Column({ type: 'timestamp', default: () => 'NOW()' })
  assigned_at: Date;

  @ManyToOne(() => User, (u) => u.roles)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Role, (r) => r.users)
  @JoinColumn({ name: 'role_id' })
  role: Role;
}
