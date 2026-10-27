import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserBlocks1793073086784 implements MigrationInterface {
  name = 'CreateUserBlocks1793073086784';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "user_blocks" ("id" SERIAL NOT NULL, "blockerId" integer NOT NULL, "blockedUserId" integer NOT NULL, "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_user_blocks_blocker_target" UNIQUE ("blockerId", "blockedUserId"), CONSTRAINT "CHK_user_blocks_not_self" CHECK ("blockerId" <> "blockedUserId"), CONSTRAINT "PK_0bae5f5cab7574a84889462187c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_blocks_blocker_created_id" ON "user_blocks" ("blockerId", "createdAt", "id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "user_blocks" ADD CONSTRAINT "FK_eae09d4f95afa5ae30c28384607" FOREIGN KEY ("blockerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_blocks" ADD CONSTRAINT "FK_91f00e71d2c6caa9e15bca2b1fe" FOREIGN KEY ("blockedUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_blocks" DROP CONSTRAINT "FK_91f00e71d2c6caa9e15bca2b1fe"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_blocks" DROP CONSTRAINT "FK_eae09d4f95afa5ae30c28384607"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_blocks_blocker_created_id"`,
    );
    await queryRunner.query(`DROP TABLE "user_blocks"`);
  }
}
