import { pgTable, text, uuid, numeric, date, jsonb } from "drizzle-orm/pg-core";
import { baseColumns } from "./_shared";

/**
 * Payment Request — pengajuan pembayaran oleh PIC dept, diverifikasi finance.
 * type: cash_advance | reimbursement | invoice
 * status: draft → submitted → reviewed → approved → scheduled → paid  (atau rejected)
 *         cash_advance yang sudah paid → settlement → settled (+ refund / kelebihan reimburse)
 * attachments: [{name, url, kind}] kind: invoice | reimburse | settlement
 */
export const paymentRequests = pgTable("payment_requests", {
  ...baseColumns,
  code: text("code").notNull(),
  type: text("type").notNull(),
  title: text("title"),
  requester: text("requester"),                       // PIC internal (otomatis dari user login)
  payee: text("payee"),                               // nama vendor/penerima
  vendorBank: text("vendor_bank"),                    // mis. BCA
  vendorAccountNo: text("vendor_account_no"),
  vendorAccountHolder: text("vendor_account_holder"),
  category: text("category"),
  amount: numeric("amount", { precision: 18, scale: 4 }).notNull().default("0"),
  notes: text("notes"),
  status: text("status").notNull().default("draft"),
  scheduledDate: date("scheduled_date"),
  paidAt: date("paid_at"),
  settledAmount: numeric("settled_amount", { precision: 18, scale: 4 }),
  settledAt: date("settled_at"),
  settlementNote: text("settlement_note"),
  attachments: jsonb("attachments"),
  sourcePrId: uuid("source_pr_id"), // asal (mis. reimburse dari kelebihan cash advance)
});
