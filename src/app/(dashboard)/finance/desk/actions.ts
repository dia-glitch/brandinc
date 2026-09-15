"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/roles";
import { canAct } from "@/lib/permissions";
import { payInvoice, payExpense } from "../actions";
import { payPR } from "../payment-request/actions";
import type { DeskSource } from "@/lib/finance-desk";

type Result = { ok: true } | { ok: false; error: string };

function rv() {
  revalidatePath("/finance");
  revalidatePath("/finance/desk");
  revalidatePath("/finance/payment-today");
  revalidatePath("/finance/expenses");
  revalidatePath("/finance/payment-request");
  revalidatePath("/finance/cash");
  revalidatePath("/finance/mutasi");
  revalidatePath("/finance/summary");
}

/** Tandai / lepas item ke antrian "Payment Today". */
export async function togglePaymentToday(input: { source: DeskSource; refKey: string; refType: string | null; on: boolean }): Promise<Result> {
  const supabase = createClient();
  if (!canAct(await getRole(supabase), "fin_other")) return { ok: false, error: "Anda tidak punya akses untuk aksi ini." };
  if (input.on) {
    const { error } = await supabase.from("payment_queue").upsert(
      { source: input.source, ref_key: input.refKey, ref_type: input.refType, marked_at: new Date().toISOString() },
      { onConflict: "source,ref_key" }
    );
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("payment_queue").delete().eq("source", input.source).eq("ref_key", input.refKey);
    if (error) return { ok: false, error: error.message };
  }
  rv();
  return { ok: true };
}

export type PayLine = {
  source: DeskSource;
  refKey: string;
  refType: string | null;   // ap: material_invoice|production_invoice ; pr: code
  refLabel: string;         // untuk pesan error
  accountId: string;
  amount: number;
  method: string;
};

export type ProcessResult = { ok: boolean; done: number; failed: { ref: string; error: string }[] };

/**
 * Proses pembayaran hari ini: per item posting kas keluar sesuai sumbernya
 * (AP → payInvoice, Expense → payExpense, PR → payPR), lalu keluarkan dari antrian.
 */
export async function processPaymentToday(input: { date: string; lines: PayLine[] }): Promise<ProcessResult> {
  const supabase = createClient();
  if (!canAct(await getRole(supabase), "fin_other")) return { ok: false, done: 0, failed: [{ ref: "-", error: "Anda tidak punya akses." }] };

  const failed: { ref: string; error: string }[] = [];
  let done = 0;

  for (const l of input.lines) {
    if (!(l.amount > 0)) { failed.push({ ref: l.refLabel, error: "Nominal harus > 0." }); continue; }
    if (!l.accountId) { failed.push({ ref: l.refLabel, error: "Pilih sumber dana." }); continue; }

    let res: Result;
    if (l.source === "ap") {
      res = await payInvoice({ refType: l.refType ?? "material_invoice", invoiceNo: l.refKey, accountId: l.accountId, date: input.date, amount: l.amount, method: l.method || "transfer", notes: "" });
    } else if (l.source === "expense") {
      res = await payExpense({ expenseId: l.refKey, amount: l.amount, accountId: l.accountId, date: input.date, method: l.method || "transfer" });
    } else {
      res = await payPR({ id: l.refKey, code: l.refLabel, amount: l.amount, accountId: l.accountId, date: input.date, method: l.method || "transfer" });
    }

    if (!res.ok) { failed.push({ ref: l.refLabel, error: res.error }); continue; }
    // sukses → keluarkan dari antrian
    await supabase.from("payment_queue").delete().eq("source", l.source).eq("ref_key", l.refKey);
    done++;
  }

  rv();
  return { ok: failed.length === 0, done, failed };
}
