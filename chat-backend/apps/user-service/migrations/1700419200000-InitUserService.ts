import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitUserService1700419200000 implements MigrationInterface {
  name = 'InitUserService1700419200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "user_id" SERIAL PRIMARY KEY,
        "username" VARCHAR(50) NOT NULL,
        "email" VARCHAR(100) NOT NULL,
        "password_hash" VARCHAR(255) NOT NULL,
        "avatar_url" TEXT,
        "status" VARCHAR(20) NOT NULL DEFAULT 'active',
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_username" ON "users" ("username")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_email" ON "users" ("email")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "roles" (
        "role_id" SERIAL PRIMARY KEY,
        "name" VARCHAR(50) NOT NULL,
        "description" TEXT
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_roles_name" ON "roles" ("name")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_role" (
        "user_id" INT NOT NULL,
        "role_id" INT NOT NULL,
        "assigned_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_user_role" PRIMARY KEY ("user_id", "role_id"),
        CONSTRAINT "FK_user_role_user" FOREIGN KEY ("user_id") REFERENCES "users" ("user_id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_role_role" FOREIGN KEY ("role_id") REFERENCES "roles" ("role_id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "groups" (
        "group_id" SERIAL PRIMARY KEY,
        "name" VARCHAR(100) NOT NULL,
        "description" TEXT,
        "created_by" INT NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "FK_groups_creator" FOREIGN KEY ("created_by") REFERENCES "users" ("user_id") ON DELETE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_group" (
        "user_id" INT NOT NULL,
        "group_id" INT NOT NULL,
        "role" VARCHAR(20) NOT NULL DEFAULT 'member',
        "joined_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_user_group" PRIMARY KEY ("user_id", "group_id"),
        CONSTRAINT "FK_user_group_user" FOREIGN KEY ("user_id") REFERENCES "users" ("user_id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_group_group" FOREIGN KEY ("group_id") REFERENCES "groups" ("group_id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tokens" (
        "token_id" SERIAL PRIMARY KEY,
        "user_id" INT NOT NULL,
        "access_token" TEXT NOT NULL,
        "refresh_token" TEXT NOT NULL,
        "expired_at" TIMESTAMP NOT NULL,
        CONSTRAINT "FK_tokens_user" FOREIGN KEY ("user_id") REFERENCES "users" ("user_id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tokens_user" ON "tokens" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tokens_user"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tokens"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_group"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "groups"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_role"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_roles_name"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "roles"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_email"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_username"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
