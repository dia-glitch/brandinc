import { pgTable, text, uuid, numeric, date, jsonb } from "drizzle-orm/pg-core";
import { baseColumns } from "./_shared";
import { materials, warehouses } from "./masterdata";

/**
 * Pembelian Tunai bahan baku (nota, bukan invoice supplier resmi).
 * Sumber dana = Cash Advance (payment_requests.type = cash_advance yang sudah paid).
 * Material MASUK stok lewat material_movements + moving average (sama seperti penerimaan),
 * tapi TIDAK membuat hutang (AP) karena sudah dibayar via cash advance.
 * Nilainya otomatis mengisi realisasi saat settlement cash advance.
 * code = CP-{NoUrut}.
 */
export const cashPurchases = pgTable("cash_purchases", {
  ...baseColumns,
  code: text("code").notNull(),
  prId: uuid("pr_id"),                 // cash advance sumber dana
  purchaseDate: date("purchase_date"),
  vendor: text("vendor"),             // toko / penjual di nota
  notaNo: text("nota_no"),
  warehouseId: uuid("warehouse_id").references(() => warehouses.id),
  total: numeric("total", { precision: 18, scale: 4 }).notNull().default("0"),
  notes: text("notes"),
  attachments: jsonb("attachments"),  // foto nota [{name,url,kind}]
});

export const cashPurchaseLines = pgTable("cash_purchase_lines", {
  ...baseColumns,
  purchaseId: uuid("purchase_id").notNull().references(() => cashPurchases.id),
  materialId: uuid("material_id").references(() => materials.id),
  materialName: text("material_name"),
  unit: text("unit"),
  qty: numeric("qty", { precision: 18, scale: 4 }).notNull().default("0"),
  unitPrice: numeric("unit_price", { precision: 18, scale: 4 }).notNull().default("0"),
});
