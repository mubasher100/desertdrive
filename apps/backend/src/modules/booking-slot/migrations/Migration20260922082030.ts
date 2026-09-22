import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260922082030 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "booking_slot" ("id" text not null, "product_id" text not null, "vehicle_handle" text not null, "pickup_at" timestamptz not null, "cart_id" text null, "order_id" text null, "expires_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "booking_slot_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_booking_slot_deleted_at" ON "booking_slot" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_booking_slot_product_id_pickup_at" ON "booking_slot" ("product_id", "pickup_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_booking_slot_cart_id" ON "booking_slot" ("cart_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_booking_slot_order_id" ON "booking_slot" ("order_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "booking_slot" cascade;`);
  }

}
