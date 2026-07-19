import { pgTable, text, uuid, numeric, date } from "drizzle-orm/pg-core";
import { baseColumns } from "./_shared";
import { salesOrders } from "./sales";
import { salesChannels } from "./saleschannel";
import { productVariants, warehouses } from "./masterdata";

/**
 * Return Penjualan (Sales Return).
 * Barang kembali → stok masuk lagi (Good / Damage), revenue & COGS dibalik di P&L,
 * dan (untuk AR) mengurangi tagihan ke store. code = SR-xxxx.
 */
export const salesReturns = pgTable("sales_returns", {
  ...baseColumns,
  code: text("code").notNull(),
  orderId: uuid("order_id").references(() => salesOrders.id),
  channelId: uuid("channel_id").references(() => salesChannels.id),
  settlement: text("settlement").notNull().default("ar"),
  returnDate: date("return_date"),
  reason: text("reason"),
  notes: text("notes"),
  // Refund ke customer — diproses Finance (transfer riil), tidak langsung jadi kas keluar.
  refundRequired: text("refund_required"),          // "1" bila perlu refund
  refundAmount: numeric("refund_amount", { precision: 18, scale: 4 }).notNull().default("0"),
  refundBankName: text("refund_bank_name"),
  refundAccountNo: text("refund_account_no"),
  refundAccountHolder: text("refund_account_holder"),
  refundStatus: text("refund_status").notNull().default("none"), // none | pending | paid
  refundPaidAt: date("refund_paid_at"),
});

export const salesReturnLines = pgTable("sales_return_lines", {
  ...baseColumns,
  returnId: uuid("return_id").notNull().references(() => salesReturns.id),
  variantId: uuid("variant_id").references(() => productVariants.id),
  warehouseId: uuid("warehouse_id").references(() => warehouses.id),
  restock: text("restock").notNull().default("available"), // available | damaged
  sku: text("sku"),
  size: text("size"),
  productName: text("product_name"),
  qty: numeric("qty", { precision: 18, scale: 4 }).notNull().default("0"),
  price: numeric("price", { precision: 18, scale: 4 }).notNull().default("0"),
  cogm: numeric("cogm", { precision: 18, scale: 4 }).notNull().default("0"),
});
