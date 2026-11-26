import { MigrationInterface, QueryRunner } from "typeorm";

export class Phase4Reader1795618730297 implements MigrationInterface {
    name = 'Phase4Reader1795618730297'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "reader_bookmarks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "story_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_reader_bookmarks_user_story" UNIQUE ("user_id", "story_id"), CONSTRAINT "PK_d2d30abedde7c67c31a28bf8f15" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "reader_bookmarks" ADD CONSTRAINT "FK_aeb6f7de3221a69f777a7acfae0" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reader_bookmarks" ADD CONSTRAINT "FK_1302b8378f8d86e50097e80b9f1" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reader_bookmarks" DROP CONSTRAINT "FK_1302b8378f8d86e50097e80b9f1"`);
        await queryRunner.query(`ALTER TABLE "reader_bookmarks" DROP CONSTRAINT "FK_aeb6f7de3221a69f777a7acfae0"`);
        await queryRunner.query(`DROP TABLE "reader_bookmarks"`);
    }

}
