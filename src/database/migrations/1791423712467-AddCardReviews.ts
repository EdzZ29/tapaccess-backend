import { MigrationInterface, QueryRunner } from 'typeorm';

/** Owner reviews of TapAccess, shown on the homepage (one per card). */
export class AddCardReviews1791423712467 implements MigrationInterface {
  name = 'AddCardReviews1791423712467';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "card_reviews" ("card_id" uuid NOT NULL, "token_hash" character varying(64), "link_created_at" TIMESTAMP WITH TIME ZONE, "rating" smallint, "comment" character varying(500), "author_name" character varying(80), "author_role" character varying(80), "hidden" boolean NOT NULL DEFAULT false, "submitted_at" TIMESTAMP WITH TIME ZONE, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_01d9ee89c2aeb126879376d5b40" PRIMARY KEY ("card_id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_fdb84cde2a87245deac1b49781" ON "card_reviews"  ("token_hash") `,
    );
    await queryRunner.query(
      `ALTER TABLE "card_reviews" ADD CONSTRAINT "FK_01d9ee89c2aeb126879376d5b40" FOREIGN KEY ("card_id") REFERENCES "nfc_cards"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    // Same lock-down as every other table (see EnableRowLevelSecurity):
    // invisible to Supabase's public Data API roles.
    await queryRunner.query(
      `ALTER TABLE "card_reviews" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(`
      DO $$
      DECLARE r text;
      BEGIN
        FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('REVOKE ALL ON TABLE "card_reviews" FROM %I', r);
          END IF;
        END LOOP;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "card_reviews" DROP CONSTRAINT "FK_01d9ee89c2aeb126879376d5b40"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fdb84cde2a87245deac1b49781"`,
    );
    await queryRunner.query(`DROP TABLE "card_reviews"`);
  }
}
