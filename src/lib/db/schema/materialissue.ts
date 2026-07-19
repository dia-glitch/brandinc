import { pgTable, text, uuid, numeric, date } from "drizzle-orm/pg-core";
import { baseColumns } from "./_shared";
import { workOrders } from "./production";
import { warehouses, materials } from "./masterdata";

/**
 * Material Issue — pengeluaran bahan (fabric/accessories/consumable) dari gudang
 * bahan baku ke sebuah SPK. Nilai keluar = qty × moving average cost saat issue.
 * Nilai ini terkumpul per SPK → dasar COGM (dibagi qty Good nanti).
 * code = MI-{Kode SPK}-{urut}.
 */
export const materialIssues = pgTable("material_issues", {
  ...baseColumns,
  code: text("code").notNull(),
  spkId: uuid("spk_id").references(() => workOrders.id),
  warehouseId: uuid("warehouse_id").references(() => warehouses.id),
  issueDate: date("issue_date"),
  notes: text("notes"),
  status: text("status").notNull().default("issued"), // issued | cancelled
});

export const materialIssueLines = pgTable("material_issue_lines", {
  ...baseColumns,
  issueId: uuid("issue_id").notNull().references(() => materialIssues.id),
  materialId: uuid("material_id").references(() => materials.id),
  materialName: text("material_name"),
  unit: text("unit"),
  qty: numeric("qty", { precision: 18, scale: 4 }).notNull().default("0"),
  unitCost: numeric("unit_cost", { precision: 18, scale: 4 }).notNull().default("0"), // avg cost saat keluar
});
