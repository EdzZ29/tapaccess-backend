import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExtraPhonesAndSlugRedirects1791374457204 implements MigrationInterface {
  name = 'AddExtraPhonesAndSlugRedirects1791374457204';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "card_slug_redirects" ("slug" character varying(64) NOT NULL, "card_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6de8e668dd3c26e6daf5fabd759" PRIMARY KEY ("slug"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_06460018627dad4f00aea23ddb" ON "card_slug_redirects"  ("card_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "card_profiles" ADD "extra_phones" jsonb NOT NULL DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_slug_redirects" ADD CONSTRAINT "FK_06460018627dad4f00aea23ddb4" FOREIGN KEY ("card_id") REFERENCES "nfc_cards"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    // Same lock-down as every other table (see EnableRowLevelSecurity):
    // invisible to Supabase's public Data API roles.
    await queryRunner.query(
      `ALTER TABLE "card_slug_redirects" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(`
      DO $$
      DECLARE r text;
      BEGIN
        FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('REVOKE ALL ON TABLE "card_slug_redirects" FROM %I', r);
          END IF;
        END LOOP;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "card_slug_redirects" DROP CONSTRAINT "FK_06460018627dad4f00aea23ddb4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_profiles" DROP COLUMN "extra_phones"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_06460018627dad4f00aea23ddb"`,
    );
    await queryRunner.query(`DROP TABLE "card_slug_redirects"`);
  }
}
