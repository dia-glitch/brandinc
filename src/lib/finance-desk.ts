import type { createClient } from "@/lib/supabase/server";
import { getPayables, getAccounts, type AccountBalance } from "@/lib/finance";

type SB = ReturnType<typeof createClient>;

export type DeskSource = "ap" | "expense" | "pr";

export type DeskItem = {
  qid: string;              // stabil: `${source}:${refKey}`
  source: DeskSource;
  sourceLabel: string;      // "Payable (AP)" | "Payable (Umum)" | "Reimburse" | "Cash Advance"
  refType: string | null;   // AP: material_invoice | production_invoice
  refKey: string;           // invoice_no (ap) / id (expense, pr)
  refLabel: string;         // no. invoice / kode
  payee: string;
  payeeBank: string | null;
  payeeAccountNo: string | null;
  payeeHolder: string | null;
  note: string;             // keterangan
  brand: string;
  dueDate: string | null;
  remaining: number;        // sisa tagihan
  marked: boolean;          // ada di payment_queue
};

const prLabel = (type: string): string =>
  type === "cash_advance" ? "Cash Advance" : type === "reimbursement" ? "Reimburse" : "Payable (Umum)";

/** Semua item siap-bayar (AP belum lunas + Expense belum bayar + PR approved) + status antrian. */
export async function getFinanceDesk(supabase: SB): Promise<{ items: DeskItem[]; accounts: AccountBalance[] }> {
  const [payables, accounts, expRes, prRes, supRes, brandRes, queueRes] = await Promise.all([
    getPayables(supabase),
    getAccounts(supabase),
    supabase.from("expenses").select("id,category,expense_date,amount,payee,vendor_bank,vendor_account_no,vendor_account_holder,brand_id,status").is("deleted_at", null).eq("status", "unpaid"),
    supabase.from("payment_requests").select("id,code,type,title,category,payee,vendor_bank,vendor_account_no,vendor_account_holder,brand_id,amount,status,scheduled_date").is("deleted_at", null).eq("status", "approved"),
    supabase.from("suppliers").select("name,bank_name,bank_account_no,bank_account_name").is("deleted_at", null),
    supabase.from("brands").select("id,name").is("deleted_at", null),
    supabase.from("payment_queue").select("source,ref_key"),
  ]);

  const marked = new Set<string>();
  (queueRes.data ?? []).forEach((q) => marked.add(`${q.source as string}:${q.ref_key as string}`));
  const brandName = (id: string | null) => (brandRes.data ?? []).find((b) => b.id === id)?.name ?? "Umum";
  const supByName = new Map<string, { bank: string | null; no: string | null; holder: string | null }>();
  (supRes.data ?? []).forEach((s) =>
    supByName.set(s.name as string, {
      bank: (s.bank_name as string | null) ?? null,
      no: (s.bank_account_no as string | null) ?? null,
      holder: (s.bank_account_name as string | null) ?? null,
    })
  );

  const items: DeskItem[] = [];

  // 1) Payable (AP) — invoice bahan (PO) & jasa produksi (GRN), belum lunas.
  for (const p of payables) {
    const remaining = p.total - p.paid;
    if (remaining <= 0.0001) continue;
    const bank = supByName.get(p.party);
    const qid = `ap:${p.key}`;
    items.push({
      qid, source: "ap", sourceLabel: "Payable (AP)", refType: p.refType, refKey: p.key, refLabel: p.invoiceNo,
      payee: p.party, payeeBank: bank?.bank ?? null, payeeAccountNo: bank?.no ?? null, payeeHolder: bank?.holder ?? null,
      note: p.refType === "material_invoice" ? "Material" : "Jasa Produksi (WIP)",
      brand: p.brand, dueDate: p.invoiceDate, remaining, marked: marked.has(qid),
    });
  }

  // 2) Payable (Umum) — Expenses / reimbursement belum dibayar.
  for (const e of expRes.data ?? []) {
    const remaining = Number(e.amount) || 0;
    if (remaining <= 0.0001) continue;
    const id = e.id as string;
    const qid = `expense:${id}`;
    items.push({
      qid, source: "expense", sourceLabel: "Payable (Umum)", refType: null, refKey: id,
      refLabel: (e.category as string | null) ?? "Expense",
      payee: (e.payee as string | null) ?? "—",
      payeeBank: (e.vendor_bank as string | null) ?? null, payeeAccountNo: (e.vendor_account_no as string | null) ?? null, payeeHolder: (e.vendor_account_holder as string | null) ?? null,
      note: (e.category as string | null) ?? "Expense", brand: brandName((e.brand_id as string | null) ?? null),
      dueDate: (e.expense_date as string | null) ?? null, remaining, marked: marked.has(qid),
    });
  }

  // 3) Cash Advance / Reimbursement (Payment Request) yang sudah approved.
  for (const r of prRes.data ?? []) {
    const remaining = Number(r.amount) || 0;
    if (remaining <= 0.0001) continue;
    const id = r.id as string;
    const type = (r.type as string) ?? "invoice";
    const qid = `pr:${id}`;
    items.push({
      qid, source: "pr", sourceLabel: prLabel(type), refType: type, refKey: id,
      refLabel: (r.code as string) ?? "PR",
      payee: (r.payee as string | null) ?? "—",
      payeeBank: (r.vendor_bank as string | null) ?? null, payeeAccountNo: (r.vendor_account_no as string | null) ?? null, payeeHolder: (r.vendor_account_holder as string | null) ?? null,
      note: (r.title as string | null) ?? (r.category as string | null) ?? "Payment Request",
      brand: brandName((r.brand_id as string | null) ?? null),
      dueDate: (r.scheduled_date as string | null) ?? null, remaining, marked: marked.has(qid),
    });
  }

  // Urut: jatuh tempo paling awal dulu (yang null di bawah), lalu nominal terbesar.
  items.sort((a, b) => {
    const ad = a.dueDate ?? "9999", bd = b.dueDate ?? "9999";
    if (ad !== bd) return ad.localeCompare(bd);
    return b.remaining - a.remaining;
  });

  return { items, accounts };
}
