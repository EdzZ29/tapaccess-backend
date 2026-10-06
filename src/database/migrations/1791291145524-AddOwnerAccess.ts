import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOwnerAccess1791291145524 implements MigrationInterface {
  name = 'AddOwnerAccess1791291145524';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "nfc_cards" ADD "owner_access" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "nfc_cards" ADD "owner_code_hash" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "nfc_cards" ADD "owner_token_version" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "nfc_cards" ADD "owner_code_set_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "nfc_cards" ADD "owner_last_edit_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "nfc_cards" DROP COLUMN "owner_last_edit_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "nfc_cards" DROP COLUMN "owner_code_set_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "nfc_cards" DROP COLUMN "owner_token_version"`,
    );
    await queryRunner.query(
      `ALTER TABLE "nfc_cards" DROP COLUMN "owner_code_hash"`,
    );
    await queryRunner.query(
      `ALTER TABLE "nfc_cards" DROP COLUMN "owner_access"`,
    );
  }
}
