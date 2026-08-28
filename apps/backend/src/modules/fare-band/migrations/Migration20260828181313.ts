import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260828181313 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "fare_band" drop constraint if exists "fare_band_code_unique";`);
    this.addSql(`create table if not exists "fare_band" ("id" text not null, "code" text not null, "name_en" text not null, "name_ar" text not null, "max_km" real null, "rank" integer not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "fare_band_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_fare_band_code_unique" ON "fare_band" ("code") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_fare_band_deleted_at" ON "fare_band" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "fare_band" cascade;`);
  }

}
