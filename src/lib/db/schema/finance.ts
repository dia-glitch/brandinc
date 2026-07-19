import { pgTable, text, uuid, numeric, boolean, date } from "drizzle-orm/pg-core";
import { baseColumns } from "./_shared";

/** Akun Kas / Bank. Saldo = opening_balance + Σ(masuk) − Σ(keluar) dari payments. */
export const cashAccounts = pgTable("cash_accounts", {
  ...baseColumns,
  name: text("name").notNull(),
  kind: text("kind").notNull().default("bank"), // cash | bank
  bankName: text("bank_name"),
  accountNo: text("account_no"),
  accountHolder: text("account_holder"), // nama pemilik rekening resmi (a.n.) — diisi manual

  openingBalance: numeric("opening_balance", { precision: 18, scale: 4 }).notNull().default("0"),
  isActive: boolean("is_active").notNull().default(true),
});

/**
 * Mutasi kas (pembayaran / setoran).
 * direction: out (bayar hutang/expense) | in (setor/top-up saldo).
 * ref_type: material_invoice | production_invoice | expense | topup | other
 * ref_key : nomor invoice / id expense (untuk cek status lunas).
 */
export const payments = pgTable("payments", {
  ...baseColumns,
  accountId: uuid("account_id").references(() => cashAccounts.id),
  payDate: date("pay_date"),
  direction: text("direction").notNull().default("out"),
  amount: numeric("amount", { precision: 18, scale: 4 }).notNull().default("0"),
  method: text("method"),
  refType: text("ref_type"),
  refKey: text("ref_key"),
  notes: text("notes"),
});

/** Expense manual (marketing, operasional, gaji, dll). status: unpaid | paid. */
export const expenses = pgTable("expenses", {
  ...baseColumns,
  category: text("category").notNull(),
  expenseDate: date("expense_date"),
  amount: numeric("amount", { precision: 18, scale: 4 }).notNull().default("0"),
  requester: text("requester"),                       // PIC internal (otomatis dari user login)
  payee: text("payee"),                               // nama vendor/penerima
  vendorBank: text("vendor_bank"),                    // mis. BCA
  vendorAccountNo: text("vendor_account_no"),
  vendorAccountHolder: text("vendor_account_holder"),
  notes: text("notes"),
  status: text("status").notNull().default("unpaid"),
});
