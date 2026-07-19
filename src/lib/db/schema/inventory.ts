import { pgTable, text, numeric, uuid, unique } from "drizzle-orm/pg-core";
import { baseColumns } from "./_shared";
import { productVariants, warehouses } from "./masterdata";

/**
 * INVENTORY LEDGER ENGINE — append-only (blueprint Bab 4.3).
 * Semua perubahan stok masuk lewat sini. Jangan UPDATE/DELETE; koreksi = entri balik.
 * stock_status: available | reserved | wip | transit | damaged | consignment | at_subcontractor
 * movement_type: receipt | issue | transfer_in | transfer_out | adjustment | sale | return
 *              | production_in | production_out | subcontract_out | subcontract_in
 */
export const inventoryMovements = pgTable("inventory_movements", {
  ...baseColumns,
  variantId: uuid("variant_id").notNull().references(() => productVariants.id),
  warehouseId: uuid("warehouse_id").notNull().references(() => warehouses.id),
  batchId: uuid("batch_id"),
  movementType: text("movement_type").notNull(),
  stockStatus: text("stock_status").notNull().default("available"),
  qty: numeric("qty", { precision: 18, scale: 4 }).notNull(),
  unitCost: numeric("unit_cost", { precision: 18, scale: 4 }).notNull().default("0"),
  sourceDocType: text("source_doc_type"),
  sourceDocId: uuid("source_doc_id"),
});

/**
 * Saldo stok terdenormalisasi (cek ketersediaan O(1)) + moving average cost.
 * Selalu bisa dibangun ulang dari inventory_movements (penting untuk reset demo).
 */
export const stockBalances = pgTable(
  "stock_balances",
  {
    ...baseColumns,
    variantId: uuid("variant_id").notNull().references(() => productVariants.id),
    warehouseId: uuid("warehouse_id").notNull().references(() => warehouses.id),
    stockStatus: text("stock_status").notNull().default("available"),
    qtyOnHand: numeric("qty_on_hand", { precision: 18, scale: 4 }).notNull().default("0"),
    movingAvgCost: numeric("moving_avg_cost", { precision: 18, scale: 4 }).notNull().default("0"),
  },
  (t) => ({
    uq: unique("uq_balance").on(t.variantId, t.warehouseId, t.stockStatus),
  })
);

/** LEDGER BAHAN BAKU (append-only). status: available | at_subcontractor | ... */
export const materialMovements = pgTable("material_movements", {
  ...baseColumns,
  materialId: uuid("material_id").notNull(),
  warehouseId: uuid("warehouse_id"),
  movementType: text("movement_type").notNull(),   // receipt | issue | adjustment | return
  stockStatus: text("stock_status").notNull().default("available"),
  qty: numeric("qty", { precision: 18, scale: 4 }).notNull(),
  unitCost: numeric("unit_cost", { precision: 18, scale: 4 }).notNull().default("0"),
  sourceDocType: text("source_doc_type"),
  sourceDocId: uuid("source_doc_id"),
  notes: text("notes"),
});

/** Saldo stok bahan baku + moving average cost. */
export const materialStockBalances = pgTable(
  "material_stock_balances",
  {
    ...baseColumns,
    materialId: uuid("material_id").notNull(),
    warehouseId: uuid("warehouse_id"),
    stockStatus: text("stock_status").notNull().default("available"),
    qtyOnHand: numeric("qty_on_hand", { precision: 18, scale: 4 }).notNull().default("0"),
    movingAvgCost: numeric("moving_avg_cost", { precision: 18, scale: 4 }).notNull().default("0"),
  },
  (t) => ({
    uq: unique("uq_material_balance").on(t.materialId, t.warehouseId, t.stockStatus),
  })
);
