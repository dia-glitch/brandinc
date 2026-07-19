import { pgTable, text, uuid, numeric, date, jsonb } from "drizzle-orm/pg-core";
import { baseColumns } from "./_shared";
import { salesChannels } from "./saleschannel";

/**
 * Piutang / Account Receivable (AR).
 * Untuk store offline konsinyasi: menagih ke store berdasar total penerimaan
 * penjualan — HANYA nominal general (tanpa level produk; itu di modul Sales).
 * code = AR-xxxx. Pelunasan store dicatat sebagai kas masuk (ref_type ar_receipt).
 * status diturunkan dari amount vs total pembayaran masuk.
 */
export const receivables = pgTable("receivables", {
  ...baseColumns,
  code: text("code").notNull(),
  channelId: uuid("channel_id").references(() => salesChannels.id),
  billTo: text("bill_to"),          // snapshot nama store/penerima tagihan
  period: text("period"),           // periode penagihan, mis. "Juli 2026"
  invoiceDate: date("invoice_date"),
  dueDate: date("due_date"),
  amount: numeric("amount", { precision: 18, scale: 4 }).notNull().default("0"),
  notes: text("notes"),
  attachments: jsonb("attachments"),
  payAccountId: uuid("pay_account_id"), // rekening tujuan pembayaran (tercetak di invoice)
});
