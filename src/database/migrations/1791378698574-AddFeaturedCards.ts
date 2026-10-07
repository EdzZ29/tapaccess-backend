import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFeaturedCards1791378698574 implements MigrationInterface {
  name = 'AddFeaturedCards1791378698574';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "nfc_cards" ADD "featured" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "nfc_cards" DROP COLUMN "featured"`);
  }
}
