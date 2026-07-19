"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEMO_COMPANY_ID } from "@/lib/supabase/config";
import { getAccountInfo, idr } from "@/lib/finance";
import { getUserName } from "@/lib/roles";

type Result = { ok: true } | { ok: false; error: string };

/** Tolak bila nominal keluar melebihi saldo akun (agar saldo tidak minus). */
async function assertFunds(supabase: ReturnType<typeof createClient>, accountId: string, amount: number): Promise<string | null> {
  const info = await getAccountInfo(supabase, accountId);
  if (info && amount > info.balance + 0.0001) return `Saldo ${info.name} tidak cukup — saldo ${idr(info.balance)}, diminta ${idr(amount)}. Top-up / pindah buku dulu.`;
  return null;
}
function rv() {
  revalidatePath("/finance");
  revalidatePath("/finance/expenses");
  revalidatePath("/finance/cash");
  revalidatePath("/finance/mutasi");
  revalidatePath("/finance/summary");
}

/* ---------------- Kas / Bank ---------------- */
export async function createAccount(input: { name: string; kind: string; bankName: string; accountNo: string; accountHolder: string; opening: number }): Promise<Result> {
  const supabase = createClient();
  if (!input.name.trim()) return { ok: false, error: "Nama akun wajib diisi." };
  const { error } = await supabase.from("cash_accounts").insert({
    company_id: DEMO_COMPANY_ID, brand_id: null, name: input.name.trim(), kind: input.kind || "bank",
    bank_name: input.bankName.trim() || null, account_no: input.accountNo.trim() || null, account_holder: input.accountHolder.trim() || null, opening_balance: input.opening || 0, is_demo: false,
  });
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true };
}
export async function updateAccount(id: string, input: { name: string; kind: string; bankName: string; accountNo: string; accountHolder: string; opening: number }): Promise<Result> {
  const supabase = createClient();
  const { error } = await supabase.from("cash_accounts").update({
    name: input.name.trim(), kind: input.kind, bank_name: input.bankName.trim() || null, account_no: input.accountNo.trim() || null,
    account_holder: input.accountHolder.trim() || null, opening_balance: input.opening || 0, updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true };
}
export async function deleteAccount(id: string): Promise<Result> {
  const supabase = createClient();
  const { error } = await supabase.from("cash_accounts").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true };
}
/** Setoran / top-up saldo (mutasi masuk). */
export async function topupAccount(input: { accountId: string; date: string; amount: number; notes: string }): Promise<Result> {
  const supabase = createClient();
  if (!input.accountId) return { ok: false, error: "Pilih akun." };
  if (!(input.amount > 0)) return { ok: false, error: "Nominal harus > 0." };
  const { error } = await supabase.from("payments").insert({
    company_id: DEMO_COMPANY_ID, brand_id: null, account_id: input.accountId, pay_date: input.date || null,
    direction: "in", amount: input.amount, method: "setoran", ref_type: "topup", ref_key: null, notes: input.notes.trim() || null, is_demo: false,
  });
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true };
}

/**
 * Cash In / Penerimaan (mutasi masuk) dengan sumber.
 * source: sales_marketplace (pencairan marketplace, netto) | capital (setoran modal) | other (pendapatan lain).
 * channel: nama marketplace (Shopee/Tokopedia/dst) — masuk ke referensi.
 */
export async function recordCashIn(input: { accountId: string; source: string; channel: string; date: string; amount: number; notes: string }): Promise<Result> {
  const supabase = createClient();
  if (!input.accountId) return { ok: false, error: "Pilih akun." };
  if (!(input.amount > 0)) return { ok: false, error: "Nominal harus > 0." };
  const map: Record<string, { refType: string; method: string }> = {
    sales_marketplace: { refType: "sales_income", method: "disbursement" },
    capital: { refType: "topup", method: "setoran" },
    other: { refType: "other_income", method: "lainnya" },
  };
  const m = map[input.source] ?? map.other;
  const { error } = await supabase.from("payments").insert({
    company_id: DEMO_COMPANY_ID, brand_id: null, account_id: input.accountId, pay_date: input.date || null,
    direction: "in", amount: input.amount, method: m.method, ref_type: m.refType,
    ref_key: input.source === "sales_marketplace" ? (input.channel.trim() || "Marketplace") : null,
    notes: input.notes.trim() || null, is_demo: false,
  });
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true };
}

/**
 * Pindah Buku (transfer antar akun sendiri).
 * Membuat 2 mutasi berpasangan: keluar dari akun asal + masuk ke akun tujuan.
 * Total saldo semua akun TIDAK berubah (bukan pemasukan/pengeluaran baru),
 * dan ditandai transfer_in/transfer_out agar tidak dihitung sbg pendapatan.
 */
export async function transferBook(input: { fromId: string; toId: string; amount: number; date: string; method: string; notes: string }): Promise<Result> {
  const supabase = createClient();
  if (!input.fromId || !input.toId) return { ok: false, error: "Pilih akun asal & tujuan." };
  if (input.fromId === input.toId) return { ok: false, error: "Akun asal dan tujuan tidak boleh sama." };
  if (!(input.amount > 0)) return { ok: false, error: "Nominal harus > 0." };
  const short = await assertFunds(supabase, input.fromId, input.amount);
  if (short) return { ok: false, error: short };
  const code = `TRF-${Date.now()}`;
  const note = input.notes.trim() || "Pindah buku";
  const base = { company_id: DEMO_COMPANY_ID, brand_id: null, pay_date: input.date || null, amount: input.amount, method: input.method || "transfer", ref_key: code, is_demo: false };
  const { error: e1 } = await supabase.from("payments").insert({ ...base, account_id: input.fromId, direction: "out", ref_type: "transfer_out", notes: note });
  if (e1) return { ok: false, error: e1.message };
  const { error: e2 } = await supabase.from("payments").insert({ ...base, account_id: input.toId, direction: "in", ref_type: "transfer_in", notes: note });
  if (e2) return { ok: false, error: e2.message };
  rv(); return { ok: true };
}

/* ---------------- Bayar Hutang (AP) ---------------- */
export async function payInvoice(input: { refType: string; invoiceNo: string; accountId: string; date: string; amount: number; method: string; notes: string }): Promise<Result> {
  const supabase = createClient();
  if (!input.accountId) return { ok: false, error: "Pilih akun kas/bank." };
  if (!(input.amount > 0)) return { ok: false, error: "Nominal bayar harus > 0." };
  const short = await assertFunds(supabase, input.accountId, input.amount);
  if (short) return { ok: false, error: short };
  const { error } = await supabase.from("payments").insert({
    company_id: DEMO_COMPANY_ID, brand_id: null, account_id: input.accountId, pay_date: input.date || null,
    direction: "out", amount: input.amount, method: input.method || null, ref_type: input.refType, ref_key: input.invoiceNo, notes: input.notes.trim() || null, is_demo: false,
  });
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true };
}

/* ---------------- Expenses ---------------- */
export async function createExpense(input: { category: string; date: string; amount: number; payee: string; brandId: string | null; notes: string; vendorBank?: string; vendorAccountNo?: string; vendorAccountHolder?: string }): Promise<Result> {
  const supabase = createClient();
  if (!input.category) return { ok: false, error: "Pilih kategori." };
  if (!(input.amount > 0)) return { ok: false, error: "Nominal harus > 0." };
  const requester = await getUserName(supabase); // Pemohon otomatis = user login
  const { error } = await supabase.from("expenses").insert({
    company_id: DEMO_COMPANY_ID, brand_id: input.brandId, category: input.category, expense_date: input.date || null,
    amount: input.amount, requester: requester || null, payee: input.payee.trim() || null,
    vendor_bank: input.vendorBank?.trim() || null, vendor_account_no: input.vendorAccountNo?.trim() || null, vendor_account_holder: input.vendorAccountHolder?.trim() || null,
    notes: input.notes.trim() || null, status: "unpaid", is_demo: false,
  });
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true };
}
export async function deleteExpense(id: string): Promise<Result> {
  const supabase = createClient();
  const { error } = await supabase.from("expenses").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true };
}
/** Bayar expense → catat mutasi keluar + tandai lunas. */
export async function payExpense(input: { expenseId: string; amount: number; accountId: string; date: string; method: string }): Promise<Result> {
  const supabase = createClient();
  if (!input.accountId) return { ok: false, error: "Pilih akun kas/bank." };
  const shortExp = await assertFunds(supabase, input.accountId, input.amount);
  if (shortExp) return { ok: false, error: shortExp };
  const { error: pErr } = await supabase.from("payments").insert({
    company_id: DEMO_COMPANY_ID, brand_id: null, account_id: input.accountId, pay_date: input.date || null,
    direction: "out", amount: input.amount, method: input.method || null, ref_type: "expense", ref_key: input.expenseId, notes: null, is_demo: false,
  });
  if (pErr) return { ok: false, error: pErr.message };
  const { error } = await supabase.from("expenses").update({ status: "paid", updated_at: new Date().toISOString() }).eq("id", input.expenseId);
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true };
}
