"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEMO_COMPANY_ID } from "@/lib/supabase/config";
import { getAccountInfo, idr } from "@/lib/finance";
import { getRole } from "@/lib/roles";
import { canAct } from "@/lib/permissions";

type Result = { ok: true } | { ok: false; error: string };
function rv() {
  revalidatePath("/finance/refund"); revalidatePath("/finance/cash"); revalidatePath("/finance/mutasi"); revalidatePath("/finance/summary"); revalidatePath("/sales/return");
}

/** Proses transfer refund (kas keluar riil) oleh Finance. */
export async function processRefund(input: { id: string; code: string; amount: number; accountId: string; date: string; method: string }): Promise<Result> {
  const supabase = createClient();
  if (!canAct(await getRole(supabase), "fin_other")) return { ok: false, error: "Anda tidak punya akses untuk aksi ini." };
  if (!input.accountId) return { ok: false, error: "Pilih akun kas/bank sumber transfer." };
  const { data: sr } = await supabase.from("sales_returns").select("refund_status,refund_amount").eq("id", input.id).single();
  if (!sr) return { ok: false, error: "Retur tidak ditemukan." };
  if ((sr.refund_status as string) !== "pending") return { ok: false, error: "Refund ini sudah diproses / tidak perlu diproses." };
  const amount = Number(sr.refund_amount) || input.amount;
  const info = await getAccountInfo(supabase, input.accountId);
  if (info && amount > info.balance + 0.0001) return { ok: false, error: `Saldo ${info.name} tidak cukup — saldo ${idr(info.balance)}, diminta ${idr(amount)}.` };

  const { error: pErr } = await supabase.from("payments").insert({
    company_id: DEMO_COMPANY_ID, brand_id: null, account_id: input.accountId, pay_date: input.date || null,
    direction: "out", amount, method: input.method || "transfer", ref_type: "sales_refund", ref_key: input.code,
    notes: `Refund retur penjualan ${input.code}`, is_demo: false,
  });
  if (pErr) return { ok: false, error: pErr.message };
  const { error } = await supabase.from("sales_returns").update({ refund_status: "paid", refund_paid_at: input.date || null, updated_at: new Date().toISOString() }).eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true };
}
