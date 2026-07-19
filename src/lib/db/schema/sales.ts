import { pgTable, text, uuid, numeric, date } from "drizzle-orm/pg-core";
import { baseColumns } from "./_shared";
import { salesChannels } from "./saleschannel";
import { productVariants, warehouses } from "./masterdata";

/**
 * Penjualan (Sales Order) — per produk (SKU).
 * settlement: ar (offline/konsinyasi, ditagih) | marketplace (kas menyusul via pencairan).
 * Mengurangi stok barang jadi & mencatat COGS (snapshot COGM). Feed revenue+COGS ke P&L per brand.
 * code = SO-xxxx.
 */
export const salesOrders = pgTable("sales_orders", {
  ...baseColumns,
  code: text("code").notNull(),
  channelId: uuid("channel_id").references(() => salesChannels.id),
  settlement: text("settlement").notNull().default("ar"), // ar | marketplace
  extOrderId: text("ext_order_id"), // No. Order Marketplace (untuk rekon pembayaran)
  customer: text("customer"),
  orderDate: date("order_date"),
  discount: numeric("discount", { precision: 18, scale: 4 }).notNull().default("0"),
  commission: numeric("commission", { precision: 18, scale: 4 }).notNull().default("0"), // komisi konsinyasi (dipotong dari penjualan; beban di P&L, kurangi AR)
  ppn: numeric("ppn", { precision: 18, scale: 4 }).notNull().default("0"),
  notes: text("notes"),
});

export const salesOrderLines = pgTable("sales_order_lines", {
  ...baseColumns,
  orderId: uuid("order_id").notNull().references(() => salesOrders.id),
  extOrderId: text("ext_order_id"), // No. Order Marketplace per baris (untuk bulk rekon)
  variantId: uuid("variant_id").references(() => productVariants.id),
  warehouseId: uuid("warehouse_id").references(() => warehouses.id),
  sku: text("sku"),
  size: text("size"),
  productName: text("product_name"),
  qty: numeric("qty", { precision: 18, scale: 4 }).notNull().default("0"),
  retail: numeric("retail", { precision: 18, scale: 4 }).notNull().default("0"), // harga retail (normal) — data mati dari SKU
  price: numeric("price", { precision: 18, scale: 4 }).notNull().default("0"),   // harga jual / sale at price (terjual saat itu)
  cogm: numeric("cogm", { precision: 18, scale: 4 }).notNull().default("0"),
});
