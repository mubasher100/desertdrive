import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260922203625 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "fare_zone" drop constraint if exists "fare_zone_code_unique";`);
    this.addSql(`create table if not exists "fare_zone" ("id" text not null, "code" text not null, "name_en" text not null, "name_ar" text not null, "polygon" jsonb not null, "rank" integer not null, "active" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "fare_zone_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_fare_zone_code_unique" ON "fare_zone" ("code") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_fare_zone_deleted_at" ON "fare_zone" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_fare_zone_code" ON "fare_zone" ("code") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_fare_zone_rank" ON "fare_zone" ("rank") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "fare_zone" cascade;`);
  }

}
