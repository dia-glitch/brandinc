import { pgTable, text, uuid, numeric, date } from "drizzle-orm/pg-core";
import { baseColumns } from "./_shared";
import { productVariants, warehouses } from "./masterdata";

/**
 * Distribusi / Pemindahan Stok barang jadi antar gudang.
 * Mis. Gudang Utama brand → Gudang Store konsinyasi (Store A - EE).
 * Penjualan dari store mengurangi stok gudang store tsb.
 * code = TF-xxxx.
 */
/**
 * Alur: requested (MD Sales) → packed (Outbound picking/packing + validasi stok)
 *       → completed (transfer lokasi/stok benar-benar pindah). Bisa cancelled.
 * Stok hanya berpindah saat completed.
 */
export const stockTransfers = pgTable("stock_transfers", {
  ...baseColumns,
  code: text("code").notNull(),
  fromWarehouseId: uuid("from_warehouse_id").references(() => warehouses.id),
  toWarehouseId: uuid("to_warehouse_id").references(() => warehouses.id),
  transferDate: date("transfer_date"),
  notes: text("notes"),
  status: text("status").notNull().default("requested"), // requested | packed | completed | cancelled
  requestedBy: text("requested_by"),   // nama peminta (MD Sales)
  packedBy: text("packed_by"),         // nama pemroses (Outbound)
  packedAt: date("packed_at"),
  completedAt: date("completed_at"),
});

export const stockTransferLines = pgTable("stock_transfer_lines", {
  ...baseColumns,
  transferId: uuid("transfer_id").notNull().references(() => stockTransfers.id),
  variantId: uuid("variant_id").references(() => productVariants.id),
  sku: text("sku"),
  size: text("size"),
  productName: text("product_name"),
  qty: numeric("qty", { precision: 18, scale: 4 }).notNull().default("0"),          // qty DIMINTA (request)
  qtyPacked: numeric("qty_packed", { precision: 18, scale: 4 }),                     // qty REAL dikirim (diisi Outbound saat proses)
  anomalyNote: text("anomaly_note"),                                                 // alasan bila qty real ≠ qty diminta
  unitCost: numeric("unit_cost", { precision: 18, scale: 4 }).notNull().default("0"),
});
