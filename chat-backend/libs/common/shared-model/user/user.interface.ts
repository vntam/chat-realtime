export interface IUser {
  user_id: number;
  username: string;
  email: string;
  avatar_url?: string;
  status?: string;
  created_at: Date;
}

export interface IRole {
  role_id: number;
  name: string;
  description?: string;
}

export interface IUserRole {
  user_id: number;
  role_id: number;
  assigned_at: Date;
}

export interface IGroup {
  group_id: number;
  name: string;
  description?: string;
  created_by: number;
  created_at: Date;
}

export interface IUserGroup {
  user_id: number;
  group_id: number;
  role: string;
  joined_at: Date;
}

export interface IToken {
  token_id: number;
  user_id: number;
  access_token: string;
  refresh_token: string;
  expired_at: Date;
}
