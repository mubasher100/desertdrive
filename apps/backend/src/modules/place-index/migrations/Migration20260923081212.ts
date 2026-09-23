import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260923081212 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "place" drop constraint if exists "place_osm_type_osm_id_unique";`);
    this.addSql(`create table if not exists "place" ("id" text not null, "osm_type" text not null, "osm_id" text not null, "name_en" text not null, "name_ar" text null, "kind" text not null, "context" text null, "lat" real not null, "lng" real not null, "search" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "place_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_place_deleted_at" ON "place" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_place_osm_type_osm_id_unique" ON "place" ("osm_type", "osm_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_place_search" ON "place" ("search") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_place_kind" ON "place" ("kind") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "place" cascade;`);
  }

}
