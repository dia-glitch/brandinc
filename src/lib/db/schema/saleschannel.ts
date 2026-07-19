import { pgTable, text, boolean, uuid } from "drizzle-orm/pg-core";
import { baseColumns } from "./_shared";

/**
 * Akun Penjualan (sales channel) — master data channel penjualan.
 * grup: online | offline. Mis. Online: Shopee/Tiktok/Website; Offline: Store A/B.
 * Dipakai untuk Cash In marketplace & modul Sales ke depan.
 */
export const salesChannels = pgTable("sales_channels", {
  ...baseColumns,
  name: text("name").notNull(),
  grup: text("grup").notNull().default("online"), // online | offline
  code: text("code"),
  warehouseId: uuid("warehouse_id"), // gudang sumber stok penjualan channel ini
  isActive: boolean("is_active").notNull().default(true),
});
