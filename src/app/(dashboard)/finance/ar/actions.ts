"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEMO_COMPANY_ID } from "@/lib/supabase/config";
import { getRole } from "@/lib/roles";
import { canAct } from "@/lib/permissions";

type Result = { ok: true } | { ok: false; error: string };
type CreateResult = { ok: true; code: string } | { ok: false; error: string };
function rv() {
  revalidatePath("/finance/ar");
  revalidatePath("/finance/cash");
  revalidatePath("/finance/mutasi");
  revalidatePath("/finance/summary");
}

async function nextCode(supabase: ReturnType<typeof createClient>): Promise<string> {
  const { count } = await supabase.from("receivables").select("id", { count: "exact", head: true });
  return `AR-${String((count ?? 0) + 1).padStart(4, "0")}`;
}

export type ARInput = {
  channelId: string | null; brandId: string | null; payAccountId: string | null; billTo: string; period: string; invoiceDate: string; dueDate: string; amount: number; notes: string;
};

export async function createReceivable(input: ARInput): Promise<CreateResult> {
  const supabase = createClient();
  if (!canAct(await getRole(supabase), "fin_other")) return { ok: false, error: "Anda tidak punya akses untuk aksi ini." };
  if (!input.brandId) return { ok: false, error: "Pilih brand." };
  if (!input.billTo.trim() && !input.channelId) return { ok: false, error: "Pilih store / isi penerima tagihan." };
  if (!(input.amount > 0)) return { ok: false, error: "Nominal tagihan harus > 0." };
  const code = await nextCode(supabase);
  const { error } = await supabase.from("receivables").insert({
    company_id: DEMO_COMPANY_ID, brand_id: input.brandId, code, channel_id: input.channelId, bill_to: input.billTo.trim() || null,
    period: input.period.trim() || null, invoice_date: input.invoiceDate || null, due_date: input.dueDate || null,
    amount: input.amount, notes: input.notes.trim() || null, attachments: [], pay_account_id: input.payAccountId, is_demo: false,
  });
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true, code };
}

export async function deleteReceivable(id: string): Promise<Result> {
  const supabase = createClient();
  if (!canAct(await getRole(supabase), "fin_other")) return { ok: false, error: "Anda tidak punya akses untuk aksi ini." };
  const { error } = await supabase.from("receivables").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true };
}

/** Terima pembayaran dari store → kas masuk (ref_type ar_receipt, ref_key = AR code). */
export async function receiveAR(input: { id: string; code: string; amount: number; accountId: string; date: string; method: string }): Promise<Result> {
  const supabase = createClient();
  if (!canAct(await getRole(supabase), "sales_penerimaan")) return { ok: false, error: "Anda tidak punya akses untuk aksi ini." };
  if (!input.accountId) return { ok: false, error: "Pilih akun kas/bank penerima." };
  if (!(input.amount > 0)) return { ok: false, error: "Nominal terima harus > 0." };
  const { error } = await supabase.from("payments").insert({
    company_id: DEMO_COMPANY_ID, brand_id: null, account_id: input.accountId, pay_date: input.date || null,
    direction: "in", amount: input.amount, method: input.method || "transfer", ref_type: "ar_receipt", ref_key: input.code,
    notes: `Pelunasan piutang ${input.code}`, is_demo: false,
  });
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true };
}
