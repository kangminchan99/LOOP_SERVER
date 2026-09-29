import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCouponTables1790656113575 implements MigrationInterface {
  name = 'CreateCouponTables1790656113575';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "coupon_events" ("id" SERIAL NOT NULL, "title" character varying(100) NOT NULL, "totalQuantity" integer NOT NULL, "issuedCount" integer NOT NULL DEFAULT '0', "startsAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL, "endsAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL, "couponExpiresAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL, "isActive" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_coupon_events_expiration" CHECK ("endsAt" < "couponExpiresAt"), CONSTRAINT "CHK_coupon_events_period" CHECK ("startsAt" < "endsAt"), CONSTRAINT "CHK_coupon_events_issued_within_total" CHECK ("issuedCount" <= "totalQuantity"), CONSTRAINT "CHK_coupon_events_issued_nonnegative" CHECK ("issuedCount" >= 0), CONSTRAINT "CHK_coupon_events_total_positive" CHECK ("totalQuantity" > 0), CONSTRAINT "PK_3599632fdf6abf81d9a3d7345b4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_coupon_events_created_at_id" ON "coupon_events" ("createdAt", "id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "user_coupons" ("id" SERIAL NOT NULL, "eventId" integer NOT NULL, "userId" integer, "issuedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL, "expiresAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL, CONSTRAINT "UQ_user_coupons_event_user" UNIQUE ("eventId", "userId"), CONSTRAINT "CHK_user_coupons_expiration" CHECK ("expiresAt" > "issuedAt"), CONSTRAINT "PK_b9e7272f1f73463f57827b601ca" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_coupons_user_issued_id" ON "user_coupons" ("userId", "issuedAt", "id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "user_coupons" ADD CONSTRAINT "FK_421950d669cbfe30e6d9ae06a51" FOREIGN KEY ("eventId") REFERENCES "coupon_events"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_coupons" ADD CONSTRAINT "FK_8c358ab3b82c503b6c1c30350bf" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_coupons" DROP CONSTRAINT "FK_8c358ab3b82c503b6c1c30350bf"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_coupons" DROP CONSTRAINT "FK_421950d669cbfe30e6d9ae06a51"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_coupons_user_issued_id"`,
    );
    await queryRunner.query(`DROP TABLE "user_coupons"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_coupon_events_created_at_id"`,
    );
    await queryRunner.query(`DROP TABLE "coupon_events"`);
  }
}
