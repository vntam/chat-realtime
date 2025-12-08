import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveGroupTables1733299200000 implements MigrationInterface {
  name = 'RemoveGroupTables1733299200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop user_group table first (has foreign keys to groups)
    await queryRunner.query(`DROP TABLE IF EXISTS "user_group" CASCADE`);

    // Drop groups table
    await queryRunner.query(`DROP TABLE IF EXISTS "groups" CASCADE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recreate groups table
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

    // Recreate user_group table
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
  }
}
