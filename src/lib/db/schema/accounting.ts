import { pgTable, text, numeric, uuid, date, integer } from "drizzle-orm/pg-core";
import { baseColumns } from "./_shared";

/** Bagan akun (satu CoA, dipakai semua brand; posting rule per brand). */
export const chartOfAccounts = pgTable("chart_of_accounts", {
  ...baseColumns,
  code: text("code").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // asset | liability | equity | revenue | expense
  isPostable: text("is_postable").notNull().default("true"),
});

/**
 * ACCOUNTING ENGINE — jurnal double-entry (blueprint Bab 4.3).
 * Header + baris; Σdebit = Σkredit di-enforce trigger (lihat supabase/functions).
 * source_type menautkan ke event: sale | cogs | purchase | payment | production | adjustment | manual
 */
export const journalEntries = pgTable("journal_entries", {
  ...baseColumns,
  entryDate: date("entry_date").notNull(),
  sourceType: text("source_type").notNull(),
  sourceId: uuid("source_id"),
  periodYear: integer("period_year").notNull(),
  periodMonth: integer("period_month").notNull(),
  status: text("status").notNull().default("posted"), // draft | posted | reversed
  memo: text("memo"),
});

export const journalEntryLines = pgTable("journal_entry_lines", {
  ...baseColumns,
  journalId: uuid("journal_id").notNull().references(() => journalEntries.id),
  accountId: uuid("account_id").notNull().references(() => chartOfAccounts.id),
  costCenterId: uuid("cost_center_id"),
  debit: numeric("debit", { precision: 18, scale: 4 }).notNull().default("0"),
  credit: numeric("credit", { precision: 18, scale: 4 }).notNull().default("0"),
  memo: text("memo"),
});
