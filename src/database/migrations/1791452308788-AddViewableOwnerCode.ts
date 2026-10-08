import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddViewableOwnerCode1791452308788 implements MigrationInterface {
  name = 'AddViewableOwnerCode1791452308788';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "nfc_cards" ADD "owner_code_encrypted" character varying(255)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "nfc_cards" DROP COLUMN "owner_code_encrypted"`,
    );
  }
}
