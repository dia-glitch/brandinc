import { pgTable, text, integer, uuid, numeric, date } from "drizzle-orm/pg-core";
import { baseColumns } from "./_shared";
import { productionPos } from "./production";
import { warehouses } from "./masterdata";

/**
 * Penerimaan barang jadi (incoming) dari PO Produksi + hasil QC.
 * Satu PO bisa punya beberapa batch incoming (incoming_no 1,2,...) untuk repair.
 * code = GRN-{Kode PO}-{incoming_no}.
 */
export const fgReceipts = pgTable("fg_receipts", {
  ...baseColumns,
  code: text("code").notNull(),
  poId: uuid("po_id").references(() => productionPos.id),
  spkId: uuid("spk_id"),
  supplierId: uuid("supplier_id"),
  incomingNo: integer("incoming_no").notNull().default(1),
  receiptDate: date("receipt_date"),
  goodWarehouseId: uuid("good_warehouse_id").references(() => warehouses.id),
  damageWarehouseId: uuid("damage_warehouse_id").references(() => warehouses.id),
  notes: text("notes"),
  status: text("status").notNull().default("done"),
  // Invoice jasa per GRN (dari Good batch ini) — tidak perlu menunggu repair loop selesai.
  invoiceNo: text("invoice_no"),
  invoiceDate: date("invoice_date"),
});

/**
 * Baris QC per SKU: incoming dipecah jadi Good / Repair (retur vendor) / Damage (final).
 * Good -> gudang jadi brand (available). Damage -> gudang damage brand (damaged).
 * Repair -> tidak jadi stok, dasar untuk incoming batch berikutnya.
 */
export const fgReceiptLines = pgTable("fg_receipt_lines", {
  ...baseColumns,
  receiptId: uuid("receipt_id").notNull().references(() => fgReceipts.id),
  variantId: uuid("variant_id"),
  sku: text("sku"),
  size: text("size"),
  productName: text("product_name"),
  qtyIncoming: numeric("qty_incoming", { precision: 18, scale: 4 }).notNull().default("0"),
  qtyGood: numeric("qty_good", { precision: 18, scale: 4 }).notNull().default("0"),
  qtyRepair: numeric("qty_repair", { precision: 18, scale: 4 }).notNull().default("0"),
  qtyDamage: numeric("qty_damage", { precision: 18, scale: 4 }).notNull().default("0"),
  unitCost: numeric("unit_cost", { precision: 18, scale: 4 }).notNull().default("0"),
});
