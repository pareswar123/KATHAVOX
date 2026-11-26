import { MigrationInterface, QueryRunner } from "typeorm";

export class StorySubmittedAt1795700000000 implements MigrationInterface {
    name = 'StorySubmittedAt1795700000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "stories" ADD "submitted_at" TIMESTAMP WITH TIME ZONE`);
        // Stories already past draft were visible to the admin, so keep them visible.
        await queryRunner.query(`UPDATE "stories" SET "submitted_at" = "updated_at" WHERE "publication_status" <> 'DRAFT'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "stories" DROP COLUMN "submitted_at"`);
    }

}
