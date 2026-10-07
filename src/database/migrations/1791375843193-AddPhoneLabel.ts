import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPhoneLabel1791375843193 implements MigrationInterface {
  name = 'AddPhoneLabel1791375843193';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "card_profiles" ADD "phone_label" character varying(30)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "card_profiles" DROP COLUMN "phone_label"`,
    );
  }
}
