import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTapAction1791212418837 implements MigrationInterface {
  name = 'AddTapAction1791212418837';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."tap_action" AS ENUM('profile', 'save_contact', 'call')`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_profiles" ADD "tap_action" "public"."tap_action" NOT NULL DEFAULT 'profile'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "card_profiles" DROP COLUMN "tap_action"`,
    );
    await queryRunner.query(`DROP TYPE "public"."tap_action"`);
  }
}
