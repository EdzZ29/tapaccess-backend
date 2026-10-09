import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the "Always open" switch to opening hours and "messenger" to the
 * social_platform enum (Social links).
 */
export class AddAlwaysOpenAndMessenger1791460000000 implements MigrationInterface {
  name = 'AddAlwaysOpenAndMessenger1791460000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "card_profiles" ADD "always_open" boolean NOT NULL DEFAULT false`,
    );
    // PostgreSQL 12+ allows this inside the migration transaction.
    await queryRunner.query(
      `ALTER TYPE "social_platform" ADD VALUE IF NOT EXISTS 'messenger' BEFORE 'pinterest'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL can't drop an enum value; move any rows to "other" so the
    // value is simply unused.
    await queryRunner.query(
      `UPDATE "social_links" SET "platform" = 'other' WHERE "platform" = 'messenger'`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_profiles" DROP COLUMN "always_open"`,
    );
  }
}
