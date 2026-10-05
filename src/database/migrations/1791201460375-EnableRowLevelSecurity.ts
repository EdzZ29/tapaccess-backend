import { MigrationInterface, QueryRunner } from 'typeorm';

const TABLES = [
  'admins',
  'nfc_cards',
  'card_profiles',
  'card_sections',
  'section_items',
  'card_buttons',
  'social_links',
  'media_assets',
  'card_visits',
  'button_clicks',
  'typeorm_migrations',
];

/**
 * Locks the tables to the API's own database user.
 *
 * Supabase automatically publishes every table in the `public` schema through
 * its REST "Data API" to the `anon` and `authenticated` roles, guarded only by
 * Row Level Security. Enabling RLS with no policies means those roles can read
 * and write nothing, while the API (which connects as the tables' owner) is
 * unaffected. Grants to those roles are revoked as a second layer.
 *
 * On a plain PostgreSQL server the Supabase roles don't exist; the revokes are
 * skipped and enabling RLS is harmless.
 */
export class EnableRowLevelSecurity1791201460375 implements MigrationInterface {
  name = 'EnableRowLevelSecurity1791201460375';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`,
      );
    }
    await queryRunner.query(`
      DO $$
      DECLARE r text;
      BEGIN
        FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
            EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
            EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
            EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
          END IF;
        END LOOP;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`,
      );
    }
  }
}
