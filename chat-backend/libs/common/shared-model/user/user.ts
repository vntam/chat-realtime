import { IUser, IRole, IGroup } from './user.interface';

export class User implements IUser {
  user_id: number;
  username: string;
  email: string;
  avatar_url?: string;
  status?: string;
  created_at: Date;

  constructor(data: IUser) {
    this.user_id = data.user_id;
    this.username = data.username;
    this.email = data.email;
    this.avatar_url = data.avatar_url;
    this.status = data.status;
    this.created_at = data.created_at ?? new Date();
  }
}

export class Role implements IRole {
  role_id: number;
  name: string;
  description?: string;

  constructor(data: IRole) {
    this.role_id = data.role_id;
    this.name = data.name;
    this.description = data.description;
  }
}

export class Group implements IGroup {
  group_id: number;
  name: string;
  description?: string;
  created_by: number;
  created_at: Date;

  constructor(data: IGroup) {
    this.group_id = data.group_id;
    this.name = data.name;
    this.description = data.description;
    this.created_by = data.created_by;
    this.created_at = data.created_at ?? new Date();
  }
}

export class TokenPair {
  access_token: string;
  refresh_token: string;

  constructor(at: string, rt: string) {
    this.access_token = at;
    this.refresh_token = rt;
  }
}
