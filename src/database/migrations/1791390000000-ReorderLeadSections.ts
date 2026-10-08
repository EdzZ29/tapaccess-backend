import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * One-time reorder of every existing card: Quick Actions (contact), Social
 * Media, Gallery and Products move to the top in that order; the other
 * sections follow in the order the card already had. Only positions change,
 * never visibility or content, and the editor can rearrange afterwards.
 */
export class ReorderLeadSections1791390000000 implements MigrationInterface {
  name = 'ReorderLeadSections1791390000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "card_sections" AS cs
      SET "position" = ranked.new_position
      FROM (
        SELECT "id",
               ROW_NUMBER() OVER (
                 PARTITION BY "card_id"
                 ORDER BY
                   CASE "type"::text
                     WHEN 'contact' THEN 0
                     WHEN 'social' THEN 1
                     WHEN 'gallery' THEN 2
                     WHEN 'products' THEN 3
                     ELSE 4
                   END,
                   "position",
                   "id"
               ) - 1 AS new_position
        FROM "card_sections"
      ) AS ranked
      WHERE cs."id" = ranked."id"
    `);
  }

  public async down(): Promise<void> {
    // The previous per-card order isn't stored, so there is nothing to
    // restore; reverting leaves the cards in the new order.
  }
}
