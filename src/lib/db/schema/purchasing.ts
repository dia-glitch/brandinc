import { pgTable, text, integer, uuid, numeric, date } from "drizzle-orm/pg-core";
import { baseColumns } from "./_shared";
import { suppliers, materials } from "./masterdata";

/**
 * Purchase Order (PO) bahan baku.
 * code = PO-{KodeBrand}-{NoUrut per brand}, mis. PO-BRE-001.
 * Alur: buat Material → buat PO ke supplier → terima bahan (dari PO) → stok RM.
 * status: open (dipesan) | received (sudah diterima) | cancelled.
 */
export const purchaseOrders = pgTable("purchase_orders", {
  ...baseColumns,
  code: text("code").notNull(),
  poNo: integer("po_no"),
  poDate: date("po_date"),
  expectedDate: date("expected_date"),
  supplierId: uuid("supplier_id").references(() => suppliers.id),
  notes: text("notes"),
  ppnPercent: numeric("ppn_percent", { precision: 6, scale: 2 }).notNull().default("0"), // 11 bila supplier PKP
  ppnAmount: numeric("ppn_amount", { precision: 18, scale: 4 }).notNull().default("0"),
  status: text("status").notNull().default("open"),
  // Invoice Reference (dibuat SETELAH penerimaan) — lembar tagih supplier & lampiran finance.
  invoiceNo: text("invoice_no"),
  invoiceDate: date("invoice_date"),
});

/** Baris PO: material + qty pesan + harga satuan. received_qty diisi saat penerimaan. */
export const purchaseOrderLines = pgTable("purchase_order_lines", {
  ...baseColumns,
  poId: uuid("po_id").notNull().references(() => purchaseOrders.id),
  materialId: uuid("material_id").references(() => materials.id),
  materialName: text("material_name"),   // snapshot nama saat PO dibuat
  unit: text("unit"),                     // snapshot satuan
  qty: numeric("qty", { precision: 18, scale: 4 }).notNull().default("0"),
  unitPrice: numeric("unit_price", { precision: 18, scale: 4 }).notNull().default("0"),
  receivedQty: numeric("received_qty", { precision: 18, scale: 4 }).notNull().default("0"),
});
