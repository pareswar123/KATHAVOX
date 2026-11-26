import { MigrationInterface, QueryRunner } from "typeorm";

export class Books1795800000000 implements MigrationInterface {
    name = 'Books1795800000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."books_access_type_enum" AS ENUM('FREE', 'PREMIUM')`);
        await queryRunner.query(`CREATE TYPE "public"."books_status_enum" AS ENUM('DRAFT', 'PUBLISHED', 'UNPUBLISHED')`);
        await queryRunner.query(`CREATE TABLE "books" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "slug" character varying(220) NOT NULL, "title" character varying(200) NOT NULL, "description" text NOT NULL DEFAULT '', "cover_image_url" character varying(500), "access_type" "public"."books_access_type_enum" NOT NULL DEFAULT 'FREE', "price_paise" integer NOT NULL DEFAULT 0, "status" "public"."books_status_enum" NOT NULL DEFAULT 'DRAFT', "published_snapshot" jsonb, "published_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_books_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_books_slug" ON "books" ("slug")`);

        await queryRunner.query(`CREATE TABLE "book_stories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "book_id" uuid NOT NULL, "story_id" uuid NOT NULL, "position" integer NOT NULL, CONSTRAINT "UQ_book_stories_book_story" UNIQUE ("book_id", "story_id"), CONSTRAINT "PK_book_stories_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_book_stories_book" ON "book_stories" ("book_id")`);
        await queryRunner.query(`ALTER TABLE "book_stories" ADD CONSTRAINT "FK_book_stories_book" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "book_stories" ADD CONSTRAINT "FK_book_stories_story" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

        await queryRunner.query(`CREATE TYPE "public"."book_purchases_status_enum" AS ENUM('ACTIVE', 'REVOKED')`);
        await queryRunner.query(`CREATE TABLE "book_purchases" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "book_id" uuid NOT NULL, "payment_id" uuid, "status" "public"."book_purchases_status_enum" NOT NULL DEFAULT 'ACTIVE', "purchased_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_book_purchases_user_book" UNIQUE ("user_id", "book_id"), CONSTRAINT "PK_book_purchases_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "book_purchases" ADD CONSTRAINT "FK_book_purchases_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "book_purchases" ADD CONSTRAINT "FK_book_purchases_book" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

        await queryRunner.query(`ALTER TYPE "public"."payments_purchase_type_enum" ADD VALUE IF NOT EXISTS 'BOOK_PURCHASE'`);
        await queryRunner.query(`ALTER TABLE "payments" ADD "book_id" uuid`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "book_id"`);
        await queryRunner.query(`ALTER TABLE "book_purchases" DROP CONSTRAINT "FK_book_purchases_book"`);
        await queryRunner.query(`ALTER TABLE "book_purchases" DROP CONSTRAINT "FK_book_purchases_user"`);
        await queryRunner.query(`DROP TABLE "book_purchases"`);
        await queryRunner.query(`DROP TYPE "public"."book_purchases_status_enum"`);
        await queryRunner.query(`ALTER TABLE "book_stories" DROP CONSTRAINT "FK_book_stories_story"`);
        await queryRunner.query(`ALTER TABLE "book_stories" DROP CONSTRAINT "FK_book_stories_book"`);
        await queryRunner.query(`DROP TABLE "book_stories"`);
        await queryRunner.query(`DROP TABLE "books"`);
        await queryRunner.query(`DROP TYPE "public"."books_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."books_access_type_enum"`);
        // Postgres cannot remove an enum value; BOOK_PURCHASE stays in the type after a revert.
    }

}
