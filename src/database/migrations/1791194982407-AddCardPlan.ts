import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCardPlan1791194982407 implements MigrationInterface {
  name = 'AddCardPlan1791194982407';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."card_plan" AS ENUM('starter', 'business')`,
    );
    await queryRunner.query(
      `ALTER TABLE "nfc_cards" ADD "plan" "public"."card_plan" NOT NULL DEFAULT 'business'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_93046e7bc3c5f412a7b1879641" ON "nfc_cards"  ("plan") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_93046e7bc3c5f412a7b1879641"`,
    );
    await queryRunner.query(`ALTER TABLE "nfc_cards" DROP COLUMN "plan"`);
    await queryRunner.query(`DROP TYPE "public"."card_plan"`);
  }
}
