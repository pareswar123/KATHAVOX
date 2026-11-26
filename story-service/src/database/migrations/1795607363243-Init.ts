import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1795607363243 implements MigrationInterface {
    name = 'Init1795607363243'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "full_name" character varying(150) NOT NULL, "pen_name" character varying(150), "email" character varying(255) NOT NULL, "password_hash" character varying(255), "email_verified" boolean NOT NULL DEFAULT false, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_users_email" ON "users" ("email") `);
        await queryRunner.query(`CREATE TYPE "public"."user_roles_role_enum" AS ENUM('ADMIN', 'AUTHOR', 'READER')`);
        await queryRunner.query(`CREATE TABLE "user_roles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "role" "public"."user_roles_role_enum" NOT NULL, CONSTRAINT "UQ_user_roles_user_role" UNIQUE ("user_id", "role"), CONSTRAINT "PK_8acd5cf26ebd158416f477de799" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "auth_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "user_agent" character varying(300), "revoked_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_641507381f32580e8479efc36cd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "token_hash" character varying(64) NOT NULL, "session_id" uuid NOT NULL, "user_id" uuid NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, "replaced_by_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_refresh_tokens_hash" ON "refresh_tokens" ("token_hash") `);
        await queryRunner.query(`CREATE TYPE "public"."verification_tokens_type_enum" AS ENUM('EMAIL_VERIFICATION', 'PASSWORD_RESET', 'SET_PASSWORD')`);
        await queryRunner.query(`CREATE TABLE "verification_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "token_hash" character varying(64) NOT NULL, "type" "public"."verification_tokens_type_enum" NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "used_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_f2d4d7a2aa57ef199e61567db22" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_verification_tokens_hash" ON "verification_tokens" ("token_hash") `);
        await queryRunner.query(`CREATE TABLE "categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "slug" character varying(120) NOT NULL, "description" text, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_categories_slug" ON "categories" ("slug") `);
        await queryRunner.query(`CREATE TABLE "languages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "code" character varying(20) NOT NULL, "slug" character varying(120) NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b517f827ca496b29f4d549c631d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_languages_code" ON "languages" ("code") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_languages_slug" ON "languages" ("slug") `);
        await queryRunner.query(`CREATE TABLE "application_settings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "key" character varying(100) NOT NULL, "value" text NOT NULL, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_84c911c1d401de2adbc8060b6d2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_application_settings_key" ON "application_settings" ("key") `);
        await queryRunner.query(`CREATE TYPE "public"."stories_access_type_enum" AS ENUM('FREE', 'PREMIUM')`);
        await queryRunner.query(`CREATE TYPE "public"."stories_publication_status_enum" AS ENUM('DRAFT', 'PENDING_APPROVAL', 'REJECTED', 'PUBLISHED', 'ARCHIVED')`);
        await queryRunner.query(`CREATE TABLE "stories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "author_id" uuid NOT NULL, "category_id" uuid NOT NULL, "language_id" uuid NOT NULL, "title" character varying(200) NOT NULL, "slug" character varying(220) NOT NULL, "description" text NOT NULL DEFAULT '', "cover_image_url" character varying(500), "access_type" "public"."stories_access_type_enum" NOT NULL DEFAULT 'FREE', "price_paise" integer NOT NULL DEFAULT '0', "free_preview_pages" integer NOT NULL DEFAULT '2', "publication_status" "public"."stories_publication_status_enum" NOT NULL DEFAULT 'DRAFT', "rejection_reason" text, "is_featured" boolean NOT NULL DEFAULT false, "view_count" integer NOT NULL DEFAULT '0', "published_at" TIMESTAMP WITH TIME ZONE, "seo_title" character varying(255), "seo_description" character varying(320), "published_snapshot" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_bb6f880b260ed96c452b32a39f0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_stories_slug" ON "stories" ("slug") `);
        await queryRunner.query(`CREATE INDEX "IDX_stories_status_published" ON "stories" ("publication_status", "published_at") `);
        await queryRunner.query(`CREATE TABLE "story_pages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "story_id" uuid NOT NULL, "page_number" integer NOT NULL, "title" character varying(200) NOT NULL DEFAULT '', "content" text NOT NULL DEFAULT '', "display_order" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_story_pages_story_page" UNIQUE ("story_id", "page_number"), CONSTRAINT "PK_432a709517f03be108cc0e0335c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_story_pages_story" ON "story_pages" ("story_id") `);
        await queryRunner.query(`CREATE TYPE "public"."story_purchases_status_enum" AS ENUM('ACTIVE', 'REVOKED')`);
        await queryRunner.query(`CREATE TABLE "story_purchases" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "story_id" uuid NOT NULL, "payment_id" uuid, "purchase_price_paise" integer NOT NULL, "status" "public"."story_purchases_status_enum" NOT NULL DEFAULT 'ACTIVE', "purchased_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_story_purchases_user_story" UNIQUE ("user_id", "story_id"), CONSTRAINT "PK_ed51b935c9f8eb929a4f88247cf" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "subscription_plans" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "description" text NOT NULL DEFAULT '', "price_paise" integer NOT NULL, "duration_days" integer NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_9ab8fe6918451ab3d0a4fb6bb0c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."user_subscriptions_status_enum" AS ENUM('ACTIVE', 'EXPIRED', 'REVOKED')`);
        await queryRunner.query(`CREATE TABLE "user_subscriptions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "plan_id" uuid NOT NULL, "payment_id" uuid, "start_date" TIMESTAMP WITH TIME ZONE NOT NULL, "end_date" TIMESTAMP WITH TIME ZONE NOT NULL, "status" "public"."user_subscriptions_status_enum" NOT NULL DEFAULT 'ACTIVE', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_9e928b0954e51705ab44988812c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_user_subscriptions_user_end" ON "user_subscriptions" ("user_id", "end_date") `);
        await queryRunner.query(`CREATE TYPE "public"."payments_purchase_type_enum" AS ENUM('STORY_PURCHASE', 'SUBSCRIPTION')`);
        await queryRunner.query(`CREATE TYPE "public"."payments_payment_status_enum" AS ENUM('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED')`);
        await queryRunner.query(`CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid, "checkout_email" character varying(255) NOT NULL, "purchase_type" "public"."payments_purchase_type_enum" NOT NULL, "story_id" uuid, "plan_id" uuid, "amount_paise" integer NOT NULL, "currency" character varying(3) NOT NULL DEFAULT 'INR', "provider_order_id" character varying(100) NOT NULL, "provider_payment_id" character varying(100), "payment_status" "public"."payments_payment_status_enum" NOT NULL DEFAULT 'PENDING', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "paid_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_payments_provider_order" ON "payments" ("provider_order_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_payments_provider_payment" ON "payments" ("provider_payment_id") `);
        await queryRunner.query(`CREATE TABLE "reading_progress" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "story_id" uuid NOT NULL, "last_page_number" integer NOT NULL DEFAULT '1', "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_reading_progress_user_story" UNIQUE ("user_id", "story_id"), CONSTRAINT "PK_2360621825d1001b80d94996cbb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "story_views_daily" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "story_id" uuid NOT NULL, "day" date NOT NULL, "view_count" integer NOT NULL DEFAULT '0', CONSTRAINT "UQ_story_views_daily_story_day" UNIQUE ("story_id", "day"), CONSTRAINT "PK_5fce8af2163cf44273d8f17c818" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "user_roles" ADD CONSTRAINT "FK_87b8888186ca9769c960e926870" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "auth_sessions" ADD CONSTRAINT "FK_50ccaa6440288a06f0ba693ccc6" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_3bf308fa93da3966f9e76fcfba4" FOREIGN KEY ("session_id") REFERENCES "auth_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "verification_tokens" ADD CONSTRAINT "FK_31d2079dc4079b80517d31cf4f2" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "stories" ADD CONSTRAINT "FK_1e6ca6b1e366a7575873f2d1c30" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "stories" ADD CONSTRAINT "FK_dfe29d5949db7863ebb615e83aa" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "stories" ADD CONSTRAINT "FK_a876b4b023de53cf3d3b52af550" FOREIGN KEY ("language_id") REFERENCES "languages"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "story_pages" ADD CONSTRAINT "FK_8f0ba5844a6909741dae74f2d81" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "story_purchases" ADD CONSTRAINT "FK_84e64988fb35e76926c22588a6a" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "story_purchases" ADD CONSTRAINT "FK_11872d65a1b7c0ac73cb941c288" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_subscriptions" ADD CONSTRAINT "FK_0641da02314913e28f6131310eb" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_subscriptions" ADD CONSTRAINT "FK_fe0520c7b2c1c5792446086491f" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reading_progress" ADD CONSTRAINT "FK_8bf40a43a04f5f9831a82c1b30f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reading_progress" ADD CONSTRAINT "FK_84eb178ada5db66f6c6ae49aa17" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "story_views_daily" ADD CONSTRAINT "FK_9d6093e6c1f18f95f78674e126c" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "story_views_daily" DROP CONSTRAINT "FK_9d6093e6c1f18f95f78674e126c"`);
        await queryRunner.query(`ALTER TABLE "reading_progress" DROP CONSTRAINT "FK_84eb178ada5db66f6c6ae49aa17"`);
        await queryRunner.query(`ALTER TABLE "reading_progress" DROP CONSTRAINT "FK_8bf40a43a04f5f9831a82c1b30f"`);
        await queryRunner.query(`ALTER TABLE "user_subscriptions" DROP CONSTRAINT "FK_fe0520c7b2c1c5792446086491f"`);
        await queryRunner.query(`ALTER TABLE "user_subscriptions" DROP CONSTRAINT "FK_0641da02314913e28f6131310eb"`);
        await queryRunner.query(`ALTER TABLE "story_purchases" DROP CONSTRAINT "FK_11872d65a1b7c0ac73cb941c288"`);
        await queryRunner.query(`ALTER TABLE "story_purchases" DROP CONSTRAINT "FK_84e64988fb35e76926c22588a6a"`);
        await queryRunner.query(`ALTER TABLE "story_pages" DROP CONSTRAINT "FK_8f0ba5844a6909741dae74f2d81"`);
        await queryRunner.query(`ALTER TABLE "stories" DROP CONSTRAINT "FK_a876b4b023de53cf3d3b52af550"`);
        await queryRunner.query(`ALTER TABLE "stories" DROP CONSTRAINT "FK_dfe29d5949db7863ebb615e83aa"`);
        await queryRunner.query(`ALTER TABLE "stories" DROP CONSTRAINT "FK_1e6ca6b1e366a7575873f2d1c30"`);
        await queryRunner.query(`ALTER TABLE "verification_tokens" DROP CONSTRAINT "FK_31d2079dc4079b80517d31cf4f2"`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_3bf308fa93da3966f9e76fcfba4"`);
        await queryRunner.query(`ALTER TABLE "auth_sessions" DROP CONSTRAINT "FK_50ccaa6440288a06f0ba693ccc6"`);
        await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT "FK_87b8888186ca9769c960e926870"`);
        await queryRunner.query(`DROP TABLE "story_views_daily"`);
        await queryRunner.query(`DROP TABLE "reading_progress"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_payments_provider_payment"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_payments_provider_order"`);
        await queryRunner.query(`DROP TABLE "payments"`);
        await queryRunner.query(`DROP TYPE "public"."payments_payment_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."payments_purchase_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_user_subscriptions_user_end"`);
        await queryRunner.query(`DROP TABLE "user_subscriptions"`);
        await queryRunner.query(`DROP TYPE "public"."user_subscriptions_status_enum"`);
        await queryRunner.query(`DROP TABLE "subscription_plans"`);
        await queryRunner.query(`DROP TABLE "story_purchases"`);
        await queryRunner.query(`DROP TYPE "public"."story_purchases_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_story_pages_story"`);
        await queryRunner.query(`DROP TABLE "story_pages"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_stories_status_published"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_stories_slug"`);
        await queryRunner.query(`DROP TABLE "stories"`);
        await queryRunner.query(`DROP TYPE "public"."stories_publication_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."stories_access_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_application_settings_key"`);
        await queryRunner.query(`DROP TABLE "application_settings"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_languages_slug"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_languages_code"`);
        await queryRunner.query(`DROP TABLE "languages"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_categories_slug"`);
        await queryRunner.query(`DROP TABLE "categories"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_verification_tokens_hash"`);
        await queryRunner.query(`DROP TABLE "verification_tokens"`);
        await queryRunner.query(`DROP TYPE "public"."verification_tokens_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_refresh_tokens_hash"`);
        await queryRunner.query(`DROP TABLE "refresh_tokens"`);
        await queryRunner.query(`DROP TABLE "auth_sessions"`);
        await queryRunner.query(`DROP TABLE "user_roles"`);
        await queryRunner.query(`DROP TYPE "public"."user_roles_role_enum"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_users_email"`);
        await queryRunner.query(`DROP TABLE "users"`);
    }

}
