import { pgTable, text, integer, uuid, numeric, date, jsonb, type AnyPgColumn } from "drizzle-orm/pg-core";
import { baseColumns } from "./_shared";
import { suppliers } from "./masterdata";

/**
 * SPK / Surat Perintah Kerja (work order produksi).
 * code = SPK-{KodeBrand}-{NoUrut per brand}, mis. SPK-BRE-001.
 * Nomor ini menjadi acuan yang mengalir ke penerimaan barang & finance.
 */
export const workOrders = pgTable("work_orders", {
  ...baseColumns,
  code: text("code").notNull(),
  spkNo: integer("spk_no"),
  spkDate: date("spk_date"),
  supplierId: uuid("supplier_id"),           // vendor/maker
  supplierType: text("supplier_type"),        // CMT | FOB | Full Package | ...
  merchandiser: text("merchandiser"),
  dueDelivery: date("due_delivery"),
  buttonAccessories: text("button_accessories"),
  careLabel: text("care_label"),
  vendorComment: text("vendor_comment"),
  imageUrl: text("image_url"),
  notes: text("notes"),
  status: text("status").notNull().default("open"), // open | cancelled | done
});

/** Baris SPK: SKU (produk+ukuran) + jumlah yang diproduksi. */
export const workOrderLines = pgTable("work_order_lines", {
  ...baseColumns,
  spkId: uuid("spk_id").notNull().references(() => workOrders.id),
  productId: uuid("product_id"),
  variantId: uuid("variant_id"),
  sku: text("sku"),
  size: text("size"),
  productName: text("product_name"),
  ratio: integer("ratio"),                    // size run / ratio
  qty: numeric("qty", { precision: 18, scale: 4 }).notNull().default("0"),
});

/**
 * Size Specification (cm) — tabel ukuran jadi per SPK.
 * name = titik ukur (mis. Lingkar Pinggang), type = TOP/BOTTOM,
 * values = nilai cm per ukuran, mis. {"S":90,"M":96,"L":102}.
 */
export const workOrderSpecs = pgTable("work_order_specs", {
  ...baseColumns,
  spkId: uuid("spk_id").notNull().references(() => workOrders.id),
  name: text("name"),
  type: text("type"),
  sortOrder: integer("sort_order"),
  values: jsonb("values"),
});

/**
 * PO Produksi — order jasa produksi (ongkos WIP) ke vendor/makloon, TERIKAT ke SPK.
 * code = PO-{Kode SPK}, mis. PO-SPK-BRE-001.
 * Qty PO diisi manual (ikut cutting report), qty SPK jadi referensi.
 * status: open | received | cancelled.
 */
export const productionPos = pgTable("production_pos", {
  ...baseColumns,
  code: text("code").notNull(),
  spkId: uuid("spk_id").notNull().references((): AnyPgColumn => workOrders.id),
  supplierId: uuid("supplier_id").references(() => suppliers.id), // vendor/makloon
  poDate: date("po_date"),
  dueDelivery: date("due_delivery"),
  notes: text("notes"),
  ppnPercent: numeric("ppn_percent", { precision: 6, scale: 2 }).notNull().default("0"),
  ppnAmount: numeric("ppn_amount", { precision: 18, scale: 4 }).notNull().default("0"),
  status: text("status").notNull().default("open"),
  invoiceNo: text("invoice_no"),
  invoiceDate: date("invoice_date"),
});

/** Baris PO Produksi: SKU dari SPK + qty PO (manual) + ongkos WIP per pcs. */
export const productionPoLines = pgTable("production_po_lines", {
  ...baseColumns,
  poId: uuid("po_id").notNull().references(() => productionPos.id),
  spkLineId: uuid("spk_line_id"),
  sku: text("sku"),
  size: text("size"),
  productName: text("product_name"),
  qtySpk: numeric("qty_spk", { precision: 18, scale: 4 }).notNull().default("0"),  // referensi
  qty: numeric("qty", { precision: 18, scale: 4 }).notNull().default("0"),         // qty PO (manual)
  unitCost: numeric("unit_cost", { precision: 18, scale: 4 }).notNull().default("0"), // ongkos WIP/pcs
  receivedQty: numeric("received_qty", { precision: 18, scale: 4 }).notNull().default("0"),
});
