import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds "google_reviews" to the social_platform enum (Social links). */
export class AddGoogleReviewsPlatform1791380000000 implements MigrationInterface {
  name = 'AddGoogleReviewsPlatform1791380000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL 12+ allows this inside the migration transaction.
    await queryRunner.query(
      `ALTER TYPE "social_platform" ADD VALUE IF NOT EXISTS 'google_reviews' BEFORE 'other'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL can't drop an enum value; move any rows to "other" so the
    // value is simply unused.
    await queryRunner.query(
      `UPDATE "social_links" SET "platform" = 'other' WHERE "platform" = 'google_reviews'`,
    );
  }
}
