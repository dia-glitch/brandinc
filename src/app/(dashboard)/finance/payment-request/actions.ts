"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEMO_COMPANY_ID } from "@/lib/supabase/config";
import { getAccountInfo, idr } from "@/lib/finance";
import { getRole, getUserName } from "@/lib/roles";
import { canAct } from "@/lib/permissions";

type Result = { ok: true } | { ok: false; error: string };
type CreateResult = { ok: true; code: string } | { ok: false; error: string };
function rv() { revalidatePath("/finance/payment-request"); revalidatePath("/finance"); revalidatePath("/finance/cash"); revalidatePath("/finance/summary"); }

const FINANCE_ONLY = "Hanya Finance/Admin yang boleh review, menyetujui, atau membayar pengajuan.";
/** Review/approve/reject/schedule/pay/settle → Finance & Admin saja. */
async function isFinance(supabase: ReturnType<typeof createClient>): Promise<boolean> {
  const role = await getRole(supabase);
  return role === "finance" || role === "admin";
}
/** Submit/buat pengajuan → siapa pun yg punya akses aksi Payment Request. */
async function canSubmit(supabase: ReturnType<typeof createClient>): Promise<boolean> {
  return canAct(await getRole(supabase), "fin_payment_request");
}

export type Attachment = { name: string; url: string; kind: string };

async function nextCode(supabase: ReturnType<typeof createClient>): Promise<string> {
  const { count } = await supabase.from("payment_requests").select("id", { count: "exact", head: true });
  return `PR-${String((count ?? 0) + 1).padStart(4, "0")}`;
}

export type PRInput = {
  type: string; title: string; payee: string; category: string; amount: number; brandId: string | null; notes: string; attachments: Attachment[];
  vendorBank?: string; vendorAccountNo?: string; vendorAccountHolder?: string;
};

export async function createPR(input: PRInput): Promise<CreateResult> {
  const supabase = createClient();
  if (!(await canSubmit(supabase))) return { ok: false, error: "Anda tidak punya akses membuat pengajuan." };
  if (!input.type) return { ok: false, error: "Pilih jenis pengajuan." };
  if (!(input.amount > 0)) return { ok: false, error: "Nominal harus > 0." };
  const requester = await getUserName(supabase); // Pemohon otomatis = user login (PIC internal)
  const code = await nextCode(supabase);
  const { error } = await supabase.from("payment_requests").insert({
    company_id: DEMO_COMPANY_ID, brand_id: input.brandId, code, type: input.type, title: input.title.trim() || null,
    requester: requester || null, payee: input.payee.trim() || null,
    vendor_bank: input.vendorBank?.trim() || null, vendor_account_no: input.vendorAccountNo?.trim() || null, vendor_account_holder: input.vendorAccountHolder?.trim() || null,
    category: input.category || null, amount: input.amount, notes: input.notes.trim() || null,
    status: "draft", attachments: input.attachments ?? [], is_demo: false,
  });
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true, code };
}

async function setStatus(id: string, status: string, extra: Record<string, unknown> = {}): Promise<Result> {
  const supabase = createClient();
  const { error } = await supabase.from("payment_requests").update({ status, ...extra, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true };
}

/** Ajukan draft (pemohon). */
export async function submitPR(id: string): Promise<Result> {
  const supabase = createClient();
  if (!(await canSubmit(supabase))) return { ok: false, error: "Anda tidak punya akses mengajukan." };
  return setStatus(id, "submitted");
}
// Review / approve / reject / schedule — Finance & Admin saja.
export async function reviewPR(id: string): Promise<Result> {
  const supabase = createClient(); if (!(await isFinance(supabase))) return { ok: false, error: FINANCE_ONLY };
  return setStatus(id, "reviewed");
}
export async function approvePR(id: string): Promise<Result> {
  const supabase = createClient(); if (!(await isFinance(supabase))) return { ok: false, error: FINANCE_ONLY };
  return setStatus(id, "approved");
}
export async function rejectPR(id: string): Promise<Result> {
  const supabase = createClient(); if (!(await isFinance(supabase))) return { ok: false, error: FINANCE_ONLY };
  return setStatus(id, "rejected");
}
export async function schedulePR(id: string, date: string): Promise<Result> {
  const supabase = createClient(); if (!(await isFinance(supabase))) return { ok: false, error: FINANCE_ONLY };
  return setStatus(id, "scheduled", { scheduled_date: date || null });
}

export async function addAttachment(id: string, att: Attachment): Promise<Result> {
  const supabase = createClient();
  const { data } = await supabase.from("payment_requests").select("attachments").eq("id", id).single();
  const list = Array.isArray(data?.attachments) ? (data!.attachments as Attachment[]) : [];
  const { error } = await supabase.from("payment_requests").update({ attachments: [...list, att], updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true };
}

/** Bayar PR (kas keluar). Untuk cash advance → dana dikeluarkan; settlement menyusul. */
export async function payPR(input: { id: string; code: string; amount: number; accountId: string; date: string; method: string }): Promise<Result> {
  const supabase = createClient();
  if (!(await isFinance(supabase))) return { ok: false, error: FINANCE_ONLY };
  if (!input.accountId) return { ok: false, error: "Pilih akun kas/bank." };
  const info = await getAccountInfo(supabase, input.accountId);
  if (info && input.amount > info.balance + 0.0001) return { ok: false, error: `Saldo ${info.name} tidak cukup — saldo ${idr(info.balance)}, diminta ${idr(input.amount)}. Top-up / pindah buku dulu.` };
  const { error: pErr } = await supabase.from("payments").insert({
    company_id: DEMO_COMPANY_ID, brand_id: null, account_id: input.accountId, pay_date: input.date || null,
    direction: "out", amount: input.amount, method: input.method || null, ref_type: "payment_request", ref_key: input.code, notes: null, is_demo: false,
  });
  if (pErr) return { ok: false, error: pErr.message };
  return setStatus(input.id, "paid", { paid_at: input.date || null });
}

/**
 * Settlement Cash Advance: input realisasi + report.
 * realisasi < advance → refund (kas masuk). realisasi > advance → kelebihan jadi PR reimbursement (approved) baru.
 */
export async function settleCashAdvance(input: { id: string; code: string; amount: number; settledAmount: number; accountId: string; date: string; brandId: string | null; report?: Attachment }): Promise<Result> {
  const supabase = createClient();
  if (!(await isFinance(supabase))) return { ok: false, error: FINANCE_ONLY };
  const { data: pr } = await supabase.from("payment_requests").select("attachments,status,type").eq("id", input.id).single();
  if (!pr) return { ok: false, error: "PR tidak ditemukan." };
  if (pr.type !== "cash_advance") return { ok: false, error: "Settlement hanya untuk Cash Advance." };
  if (pr.status !== "paid") return { ok: false, error: "Cash advance harus sudah dibayar dulu." };

  const refund = Math.max(0, input.amount - input.settledAmount);
  const excess = Math.max(0, input.settledAmount - input.amount);
  const list = Array.isArray(pr.attachments) ? (pr.attachments as Attachment[]) : [];
  if (input.report) list.push(input.report);

  // Refund → kas masuk
  if (refund > 0) {
    if (!input.accountId) return { ok: false, error: "Pilih akun untuk terima refund." };
    const { error } = await supabase.from("payments").insert({
      company_id: DEMO_COMPANY_ID, brand_id: null, account_id: input.accountId, pay_date: input.date || null,
      direction: "in", amount: refund, method: "refund", ref_type: "pr_refund", ref_key: input.code, notes: `Refund sisa cash advance ${input.code}`, is_demo: false,
    });
    if (error) return { ok: false, error: error.message };
  }

  // Kelebihan → PR reimbursement baru (approved, siap dibayar)
  if (excess > 0) {
    const code = await nextCode(supabase);
    await supabase.from("payment_requests").insert({
      company_id: DEMO_COMPANY_ID, brand_id: input.brandId, code, type: "reimbursement",
      title: `Kelebihan pemakaian CA ${input.code}`, amount: excess, status: "approved", source_pr_id: input.id, attachments: [], is_demo: false,
    });
  }

  const { error } = await supabase.from("payment_requests").update({
    status: "settled", settled_amount: input.settledAmount, settled_at: input.date || null, attachments: list, updated_at: new Date().toISOString(),
  }).eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true };
}

export async function deletePR(id: string): Promise<Result> {
  const supabase = createClient();
  // Draft boleh dihapus pemohon; setelah diajukan hanya Finance/Admin.
  const { data: pr } = await supabase.from("payment_requests").select("status").eq("id", id).single();
  const status = (pr?.status as string) ?? "draft";
  const allowed = status === "draft" ? await canSubmit(supabase) : await isFinance(supabase);
  if (!allowed) return { ok: false, error: status === "draft" ? "Anda tidak punya akses." : FINANCE_ONLY };
  const { error } = await supabase.from("payment_requests").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true };
}
