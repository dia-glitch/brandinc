import type { createClient } from "@/lib/supabase/server";
import { SPENDING_TYPES, DEFAULT_SPENDING_CATEGORIES } from "@/lib/coa";

type SB = ReturnType<typeof createClient>;

export const EXPENSE_CATEGORIES = ["Marketing", "Operasional", "Gaji & Upah", "Sewa", "Utilitas", "Logistik & Ongkir", "Perlengkapan", "Pajak & Legal", "Lainnya"];

/**
 * Kategori pengeluaran = akun COA (Chart of Accounts) tipe HPP/Beban/Lain.
 * Sumber tunggal agar AP, Payment Request, Expenses seragam dgn Accounting.
 * Fallback ke COA bawaan bila tabel COA belum diisi.
 */
export async function getCoaCategories(supabase: SB): Promise<string[]> {
  const { data, error } = await supabase.from("chart_of_accounts").select("code,name,type").is("deleted_at", null).order("code");
  if (error || !data || data.length === 0) return DEFAULT_SPENDING_CATEGORIES;
  const names = data.filter((a) => SPENDING_TYPES.includes((a.type as string) ?? "")).map((a) => a.name as string).filter(Boolean);
  return names.length > 0 ? names : DEFAULT_SPENDING_CATEGORIES;
}

/** @deprecated Pakai getCoaCategories. Dipertahankan utk kompatibilitas. */
export async function getExpenseCategories(supabase: SB): Promise<string[]> {
  return getCoaCategories(supabase);
}

export type Payable = {
  key: string;               // = invoice_no (unik)
  refType: "material_invoice" | "production_invoice";
  invoiceNo: string;
  invoiceDate: string | null;
  party: string;             // supplier / vendor
  brand: string;
  subtotal: number;
  ppn: number;
  total: number;
  paid: number;
  status: "unpaid" | "partial" | "paid";
  // Sumber dokumen untuk lampiran verifikasi.
  poId: string | null;       // material: PO id ; production: null
  prodPoId: string | null;   // production: PO Produksi id
  receiptId: string | null;  // production: GRN id
};

/** Semua hutang dari invoice yang sudah dibuat: bahan (PO) + jasa produksi (GRN). */
export async function getPayables(supabase: SB): Promise<Payable[]> {
  const [poRes, poLineRes, rcptRes, rLineRes, brandRes, supRes, payRes] = await Promise.all([
    supabase.from("purchase_orders").select("id,brand_id,supplier_id,invoice_no,invoice_date,ppn_amount").not("invoice_no", "is", null).is("deleted_at", null),
    supabase.from("purchase_order_lines").select("po_id,qty,unit_price").is("deleted_at", null),
    supabase.from("fg_receipts").select("id,po_id,brand_id,supplier_id,invoice_no,invoice_date").not("invoice_no", "is", null).is("deleted_at", null),
    supabase.from("fg_receipt_lines").select("receipt_id,qty_good,unit_cost").is("deleted_at", null),
    supabase.from("brands").select("id,name").is("deleted_at", null),
    supabase.from("suppliers").select("id,name").is("deleted_at", null),
    supabase.from("payments").select("ref_key,direction,amount").eq("direction", "out").is("deleted_at", null),
  ]);

  const brandName = (id: string | null) => (brandRes.data ?? []).find((b) => b.id === id)?.name ?? "—";
  const supName = (id: string | null) => (supRes.data ?? []).find((s) => s.id === id)?.name ?? "—";
  const paidByKey = new Map<string, number>();
  (payRes.data ?? []).forEach((p) => { const k = (p.ref_key as string) ?? ""; if (k) paidByKey.set(k, (paidByKey.get(k) ?? 0) + (Number(p.amount) || 0)); });

  // PPN produksi dihitung dari % PO.
  const poPpnPct = new Map<string, number>();
  // (ambil ppn_percent PO produksi utk GRN)
  const prodPoRes = await supabase.from("production_pos").select("id,ppn_percent").is("deleted_at", null);
  (prodPoRes.data ?? []).forEach((p) => poPpnPct.set(p.id as string, Number(p.ppn_percent) || 0));

  const out: Payable[] = [];

  for (const po of poRes.data ?? []) {
    const subtotal = (poLineRes.data ?? []).filter((l) => l.po_id === po.id).reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unit_price) || 0), 0);
    const ppn = Number(po.ppn_amount) || 0;
    const total = subtotal + ppn;
    const inv = po.invoice_no as string;
    const paid = paidByKey.get(inv) ?? 0;
    out.push({
      key: inv, refType: "material_invoice", invoiceNo: inv, invoiceDate: (po.invoice_date as string | null) ?? null,
      party: supName((po.supplier_id as string | null) ?? null), brand: brandName((po.brand_id as string | null) ?? null),
      subtotal, ppn, total, paid, status: paid <= 0 ? "unpaid" : paid >= total ? "paid" : "partial",
      poId: po.id as string, prodPoId: null, receiptId: null,
    });
  }

  for (const r of rcptRes.data ?? []) {
    const subtotal = (rLineRes.data ?? []).filter((l) => l.receipt_id === r.id).reduce((s, l) => s + (Number(l.qty_good) || 0) * (Number(l.unit_cost) || 0), 0);
    const pct = poPpnPct.get((r.po_id as string) ?? "") ?? 0;
    const ppn = subtotal * (pct / 100);
    const total = subtotal + ppn;
    const inv = r.invoice_no as string;
    const paid = paidByKey.get(inv) ?? 0;
    out.push({
      key: inv, refType: "production_invoice", invoiceNo: inv, invoiceDate: (r.invoice_date as string | null) ?? null,
      party: supName((r.supplier_id as string | null) ?? null), brand: brandName((r.brand_id as string | null) ?? null),
      subtotal, ppn, total, paid, status: paid <= 0 ? "unpaid" : paid >= total ? "paid" : "partial",
      poId: null, prodPoId: (r.po_id as string | null) ?? null, receiptId: r.id as string,
    });
  }

  return out.sort((a, b) => (b.invoiceDate ?? "").localeCompare(a.invoiceDate ?? ""));
}

export type AccountBalance = { id: string; name: string; kind: string; bankName: string | null; accountNo: string | null; accountHolder: string | null; opening: number; inSum: number; outSum: number; balance: number };

/** Ambil saldo & nama satu akun (untuk validasi cukup/tidaknya dana). */
export async function getAccountInfo(supabase: SB, accountId: string): Promise<{ name: string; balance: number } | null> {
  if (!accountId) return null;
  const accs = await getAccounts(supabase);
  const a = accs.find((x) => x.id === accountId);
  return a ? { name: a.name, balance: a.balance } : null;
}

/** Format IDR sederhana untuk pesan error server. */
export function idr(n: number): string { return "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n)); }

export async function getAccounts(supabase: SB): Promise<AccountBalance[]> {
  const [accRes, payRes] = await Promise.all([
    supabase.from("cash_accounts").select("id,name,kind,bank_name,account_no,account_holder,opening_balance").is("deleted_at", null).order("name"),
    supabase.from("payments").select("account_id,direction,amount").is("deleted_at", null),
  ]);
  const inByAcc = new Map<string, number>(), outByAcc = new Map<string, number>();
  (payRes.data ?? []).forEach((p) => {
    const a = (p.account_id as string) ?? ""; if (!a) return;
    const amt = Number(p.amount) || 0;
    if ((p.direction as string) === "in") inByAcc.set(a, (inByAcc.get(a) ?? 0) + amt);
    else outByAcc.set(a, (outByAcc.get(a) ?? 0) + amt);
  });
  return (accRes.data ?? []).map((a) => {
    const opening = Number(a.opening_balance) || 0;
    const inSum = inByAcc.get(a.id as string) ?? 0;
    const outSum = outByAcc.get(a.id as string) ?? 0;
    return { id: a.id as string, name: a.name as string, kind: (a.kind as string) ?? "bank", bankName: (a.bank_name as string | null) ?? null, accountNo: (a.account_no as string | null) ?? null, accountHolder: (a.account_holder as string | null) ?? null, opening, inSum, outSum, balance: opening + inSum - outSum };
  });
}
