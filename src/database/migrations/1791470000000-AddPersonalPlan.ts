import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds the "personal" package (personal business card) to the card_plan enum. */
export class AddPersonalPlan1791470000000 implements MigrationInterface {
  name = 'AddPersonalPlan1791470000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL 12+ allows this inside the migration transaction.
    await queryRunner.query(
      `ALTER TYPE "card_plan" ADD VALUE IF NOT EXISTS 'personal' BEFORE 'business'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL can't drop an enum value; move any cards to Starter (the
    // closest package that still exists) so the value is simply unused.
    await queryRunner.query(
      `UPDATE "nfc_cards" SET "plan" = 'starter' WHERE "plan" = 'personal'`,
    );
  }
}
