import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSourceOptions } from 'typeorm';
import { parse as parseConnectionString } from 'pg-connection-string';

import { User } from '../user/user.entity';
import { Role } from '../role/role.entity';
import { UserRole } from '../role/user-role.entity';
import { Token } from '../token/token.entity';

const entities = [User, Role, UserRole, Token];

const baseOptions = (): DataSourceOptions => {
  const {
    DB_HOST,
    DB_PORT,
    DB_USERNAME,
    DB_PASSWORD,
    DB_NAME,
    DB_SSL,
    USER_DB_URL,
  } = process.env;

  let connection: Partial<ReturnType<typeof parseConnectionString>> = {};

  if (USER_DB_URL) {
    connection = parseConnectionString(USER_DB_URL);
  }

  const host = DB_HOST ?? connection.host ?? 'localhost';
  const port = Number(DB_PORT ?? connection.port ?? 5432);
  const username = DB_USERNAME ?? connection.user ?? 'postgres';
  const password = DB_PASSWORD ?? connection.password ?? 'postgres';
  const database = DB_NAME ?? connection.database ?? 'chat_user_service';

  const sslFromUrl =
    typeof connection.ssl === 'boolean'
      ? connection.ssl
      : connection.ssl === 'true';
  const sslEnv = DB_SSL ?? (sslFromUrl ? 'true' : undefined);
  const ssl =
    sslEnv === 'true' || sslEnv === '1' ? { rejectUnauthorized: false } : false;

  return {
    type: 'postgres',
    host,
    port,
    username,
    password,
    database,
    entities,
    synchronize: false,
    logging: process.env.TYPEORM_LOGGING === 'true',
    migrationsRun: process.env.TYPEORM_MIGRATIONS_RUN === 'true',
    ssl,
  };
};

export const typeOrmModuleOptions: TypeOrmModuleOptions = {
  ...baseOptions(),
  migrations: ['dist/apps/user-service/migrations/*.js'],
};

export const typeOrmDataSourceOptions: DataSourceOptions = {
  ...baseOptions(),
  migrations: ['apps/user-service/migrations/*.ts'],
};
