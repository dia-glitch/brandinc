import { pgTable, text, boolean } from "drizzle-orm/pg-core";
import { baseColumns } from "./_shared";

/**
 * Kategori Biaya — master data untuk kategori Expense & Payment Request.
 * Bisa ditambah manual (mis. "Raw Material"). coa_code opsional untuk
 * pemetaan ke Chart of Accounts ke depan.
 */
export const expenseCategories = pgTable("expense_categories", {
  ...baseColumns,
  name: text("name").notNull(),
  code: text("code"),
  coaCode: text("coa_code"),          // opsional: nomor akun COA terkait
  isActive: boolean("is_active").notNull().default(true),
});
