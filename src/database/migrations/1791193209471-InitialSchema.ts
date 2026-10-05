import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1791193209471 implements MigrationInterface {
  name = 'InitialSchema1791193209471';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Feeds auto-generated internal card codes (TA-000001, TA-000002, ...).
    await queryRunner.query(`CREATE SEQUENCE "card_code_seq" START 1`);
    await queryRunner.query(
      `CREATE TYPE "public"."admin_role" AS ENUM('super_admin')`,
    );
    await queryRunner.query(
      `CREATE TABLE "admins" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "email" character varying(254) NOT NULL, "name" character varying(120) NOT NULL, "password_hash" character varying(255) NOT NULL, "role" "public"."admin_role" NOT NULL DEFAULT 'super_admin', "token_version" integer NOT NULL DEFAULT '0', "last_login_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e3b38270c97a854c48d2e80874e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_051db7d37d478a69a7432df147" ON "admins"  ("email") `,
    );
    await queryRunner.query(
      `CREATE TABLE "card_profiles" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "card_id" uuid NOT NULL, "business_name" character varying(120) NOT NULL, "tagline" character varying(160), "description" text, "category" character varying(80), "logo_url" character varying(1024), "cover_url" character varying(1024), "phone" character varying(40), "whatsapp" character varying(40), "email" character varying(254), "website" character varying(2048), "address" character varying(500), "maps_url" character varying(2048), "reviews_url" character varying(2048), "opening_hours" jsonb NOT NULL, "hours_note" character varying(200), "theme" jsonb NOT NULL, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "REL_54c32fd76fc9c1299bc06833c7" UNIQUE ("card_id"), CONSTRAINT "PK_e504d2f8f193c47c38c212c180d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5e39ec60f32a7dab2f7f62f7f3" ON "card_profiles"  ("business_name") `,
    );
    await queryRunner.query(
      `CREATE TABLE "section_items" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "section_id" uuid NOT NULL, "title" character varying(160) NOT NULL, "description" text, "price" character varying(40), "image_url" character varying(1024), "link_url" character varying(2048), "link_label" character varying(40), "badge" character varying(40), "starts_at" TIMESTAMP WITH TIME ZONE, "ends_at" TIMESTAMP WITH TIME ZONE, "position" integer NOT NULL, "enabled" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_0161908452a05657335b53afe16" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_359a92596855f3dd03d4e15b28" ON "section_items"  ("section_id", "position") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."section_type" AS ENUM('about', 'actions', 'contact', 'social', 'hours', 'services', 'products', 'promotions', 'gallery', 'announcements', 'location')`,
    );
    await queryRunner.query(
      `CREATE TABLE "card_sections" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "card_id" uuid NOT NULL, "type" "public"."section_type" NOT NULL, "title" character varying(120), "position" integer NOT NULL, "enabled" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_ae41564341d5791cc42856ce7cf" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_2a0e2f654746aaaadc1b71bb34" ON "card_sections"  ("card_id", "type") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."social_platform" AS ENUM('facebook', 'instagram', 'tiktok', 'youtube', 'x', 'linkedin', 'whatsapp', 'telegram', 'pinterest', 'threads', 'other')`,
    );
    await queryRunner.query(
      `CREATE TABLE "social_links" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "card_id" uuid NOT NULL, "platform" "public"."social_platform" NOT NULL, "url" character varying(2048) NOT NULL, "label" character varying(40), "position" integer NOT NULL, "enabled" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_50d32c67ddd71c09d372b02167f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5b914aa7f173af8f881ce16eb8" ON "social_links"  ("card_id", "position") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."card_status" AS ENUM('active', 'inactive', 'archived')`,
    );
    await queryRunner.query(
      `CREATE TABLE "nfc_cards" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "card_code" character varying(32) NOT NULL, "slug" character varying(64) NOT NULL, "status" "public"."card_status" NOT NULL DEFAULT 'inactive', "notes" text, "first_activated_at" TIMESTAMP WITH TIME ZONE, "archived_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_9cdf2a86e7f93e10face898dfea" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_a7f0cf3e87b0039cd4f8fe11be" ON "nfc_cards"  ("card_code") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_493a52221cadb86a2be0641bbf" ON "nfc_cards"  ("slug") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2d358d9500d7ee1b495a056058" ON "nfc_cards"  ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a967a8d0986aafcfb569bb720f" ON "nfc_cards"  ("created_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "card_buttons" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "card_id" uuid NOT NULL, "label" character varying(60) NOT NULL, "url" character varying(2048) NOT NULL, "icon" character varying(32) NOT NULL DEFAULT 'link', "position" integer NOT NULL, "enabled" boolean NOT NULL DEFAULT true, "highlighted" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_2a63e6bf8b1bcd1bd4dbc2fcd09" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_91cff292b6624a763767090931" ON "card_buttons"  ("card_id", "position") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."click_kind" AS ENUM('button', 'social', 'contact', 'item')`,
    );
    await queryRunner.query(
      `CREATE TABLE "button_clicks" ("id" BIGSERIAL NOT NULL, "card_id" uuid NOT NULL, "button_id" uuid, "kind" "public"."click_kind" NOT NULL, "target" character varying(64) NOT NULL, "label" character varying(80) NOT NULL, "clicked_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "visitor_hash" character(32) NOT NULL, CONSTRAINT "PK_576cf3cdb6cf641f266da0a63d2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f44917da95d129fd9e008088db" ON "button_clicks"  ("button_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ca0ba0bf26e67e0c55a73dec20" ON "button_clicks"  ("card_id", "clicked_at") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."device_type" AS ENUM('mobile', 'tablet', 'desktop', 'unknown')`,
    );
    await queryRunner.query(
      `CREATE TABLE "card_visits" ("id" BIGSERIAL NOT NULL, "card_id" uuid NOT NULL, "visited_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "visitor_hash" character(32) NOT NULL, "device_type" "public"."device_type" NOT NULL DEFAULT 'unknown', "referrer_host" character varying(255), CONSTRAINT "PK_51fe6d8abff9f894a226b717cb5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3892b9fab8b608c1dd1bfea4e6" ON "card_visits"  ("card_id", "visited_at") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."media_kind" AS ENUM('logo', 'cover', 'gallery', 'item', 'background', 'other')`,
    );
    await queryRunner.query(
      `CREATE TABLE "media_assets" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "card_id" uuid, "kind" "public"."media_kind" NOT NULL DEFAULT 'other', "provider" character varying(16) NOT NULL, "storage_key" character varying(512) NOT NULL, "url" character varying(1024) NOT NULL, "mime_type" character varying(64) NOT NULL, "width" integer NOT NULL, "height" integer NOT NULL, "size_bytes" integer NOT NULL, "original_name" character varying(255), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ca47e9f67a5e5d8af1e75d66ee6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_17965386e11ee3c6b585e2bf01" ON "media_assets"  ("card_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_8519ae0d2926772a395d110a1a" ON "media_assets"  ("storage_key") `,
    );
    await queryRunner.query(
      `ALTER TABLE "card_profiles" ADD CONSTRAINT "FK_54c32fd76fc9c1299bc06833c76" FOREIGN KEY ("card_id") REFERENCES "nfc_cards"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "section_items" ADD CONSTRAINT "FK_941a36988414f88e07e2a599ae0" FOREIGN KEY ("section_id") REFERENCES "card_sections"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_sections" ADD CONSTRAINT "FK_9684650644fc5263c8cc6a6ae9d" FOREIGN KEY ("card_id") REFERENCES "nfc_cards"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "social_links" ADD CONSTRAINT "FK_e22b9dcbe08ed59242bd8b8458c" FOREIGN KEY ("card_id") REFERENCES "nfc_cards"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_buttons" ADD CONSTRAINT "FK_6e549fd430b4b416d64f46f63bd" FOREIGN KEY ("card_id") REFERENCES "nfc_cards"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "button_clicks" ADD CONSTRAINT "FK_3e02a969c9f725bde40a081fd24" FOREIGN KEY ("card_id") REFERENCES "nfc_cards"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "button_clicks" ADD CONSTRAINT "FK_f44917da95d129fd9e008088db1" FOREIGN KEY ("button_id") REFERENCES "card_buttons"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_visits" ADD CONSTRAINT "FK_5d5bbc266cb100f23c273e5ab94" FOREIGN KEY ("card_id") REFERENCES "nfc_cards"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "media_assets" ADD CONSTRAINT "FK_17965386e11ee3c6b585e2bf01a" FOREIGN KEY ("card_id") REFERENCES "nfc_cards"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media_assets" DROP CONSTRAINT "FK_17965386e11ee3c6b585e2bf01a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_visits" DROP CONSTRAINT "FK_5d5bbc266cb100f23c273e5ab94"`,
    );
    await queryRunner.query(
      `ALTER TABLE "button_clicks" DROP CONSTRAINT "FK_f44917da95d129fd9e008088db1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "button_clicks" DROP CONSTRAINT "FK_3e02a969c9f725bde40a081fd24"`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_buttons" DROP CONSTRAINT "FK_6e549fd430b4b416d64f46f63bd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "social_links" DROP CONSTRAINT "FK_e22b9dcbe08ed59242bd8b8458c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_sections" DROP CONSTRAINT "FK_9684650644fc5263c8cc6a6ae9d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "section_items" DROP CONSTRAINT "FK_941a36988414f88e07e2a599ae0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_profiles" DROP CONSTRAINT "FK_54c32fd76fc9c1299bc06833c76"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8519ae0d2926772a395d110a1a"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_17965386e11ee3c6b585e2bf01"`,
    );
    await queryRunner.query(`DROP TABLE "media_assets"`);
    await queryRunner.query(`DROP TYPE "public"."media_kind"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3892b9fab8b608c1dd1bfea4e6"`,
    );
    await queryRunner.query(`DROP TABLE "card_visits"`);
    await queryRunner.query(`DROP TYPE "public"."device_type"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ca0ba0bf26e67e0c55a73dec20"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f44917da95d129fd9e008088db"`,
    );
    await queryRunner.query(`DROP TABLE "button_clicks"`);
    await queryRunner.query(`DROP TYPE "public"."click_kind"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_91cff292b6624a763767090931"`,
    );
    await queryRunner.query(`DROP TABLE "card_buttons"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a967a8d0986aafcfb569bb720f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2d358d9500d7ee1b495a056058"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_493a52221cadb86a2be0641bbf"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a7f0cf3e87b0039cd4f8fe11be"`,
    );
    await queryRunner.query(`DROP TABLE "nfc_cards"`);
    await queryRunner.query(`DROP TYPE "public"."card_status"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5b914aa7f173af8f881ce16eb8"`,
    );
    await queryRunner.query(`DROP TABLE "social_links"`);
    await queryRunner.query(`DROP TYPE "public"."social_platform"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2a0e2f654746aaaadc1b71bb34"`,
    );
    await queryRunner.query(`DROP TABLE "card_sections"`);
    await queryRunner.query(`DROP TYPE "public"."section_type"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_359a92596855f3dd03d4e15b28"`,
    );
    await queryRunner.query(`DROP TABLE "section_items"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5e39ec60f32a7dab2f7f62f7f3"`,
    );
    await queryRunner.query(`DROP TABLE "card_profiles"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_051db7d37d478a69a7432df147"`,
    );
    await queryRunner.query(`DROP TABLE "admins"`);
    await queryRunner.query(`DROP TYPE "public"."admin_role"`);
    await queryRunner.query(`DROP SEQUENCE "card_code_seq"`);
  }
}
