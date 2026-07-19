"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEMO_COMPANY_ID } from "@/lib/supabase/config";

type Result = { ok: true; id: string; code: string } | { ok: false; error: string };
type SimpleResult = { ok: true } | { ok: false; error: string };

function rv() {
  revalidatePath("/production/material-issue");
  revalidatePath("/raw-material");
}

export type IssueLineInput = { materialId: string; materialName: string; unit: string; qty: number };
export type IssueInput = {
  spkId: string;
  spkCode: string;
  warehouseId: string;
  issueDate: string;
  notes: string;
  lines: IssueLineInput[];
};

async function nextIssueNo(supabase: ReturnType<typeof createClient>, spkId: string): Promise<number> {
  const { count } = await supabase.from("material_issues").select("id", { count: "exact", head: true }).eq("spk_id", spkId);
  return (count ?? 0) + 1;
}

export async function createMaterialIssue(input: IssueInput): Promise<Result> {
  const supabase = createClient();
  if (!input.spkId) return { ok: false, error: "Pilih SPK dulu." };
  if (!input.warehouseId) return { ok: false, error: "Pilih gudang bahan." };
  const lines = input.lines.filter((l) => l.materialId && l.qty > 0);
  if (lines.length === 0) return { ok: false, error: "Tambah minimal satu bahan (qty > 0)." };

  // Ambil saldo & cek kecukupan stok.
  const priced: { l: IssueLineInput; unitCost: number; avail: number; balExists: boolean }[] = [];
  for (const l of lines) {
    const { data: bal } = await supabase
      .from("material_stock_balances")
      .select("qty_on_hand,moving_avg_cost")
      .eq("material_id", l.materialId).eq("warehouse_id", input.warehouseId).eq("stock_status", "available").maybeSingle();
    const avail = Number(bal?.qty_on_hand) || 0;
    if (l.qty > avail) return { ok: false, error: `Stok ${l.materialName} tidak cukup (tersedia ${avail}, diminta ${l.qty}).` };
    priced.push({ l, unitCost: Number(bal?.moving_avg_cost) || 0, avail, balExists: Boolean(bal) });
  }

  const no = await nextIssueNo(supabase, input.spkId);
  const code = `MI-${input.spkCode.trim().toUpperCase()}-${no}`;

  const { data: issue, error: iErr } = await supabase.from("material_issues").insert({
    company_id: DEMO_COMPANY_ID, brand_id: null,
    code, spk_id: input.spkId, warehouse_id: input.warehouseId,
    issue_date: input.issueDate || null, notes: input.notes.trim() || null, status: "issued", is_demo: false,
  }).select("id").single();
  if (iErr || !issue) return { ok: false, error: iErr?.message ?? "Gagal membuat material issue." };

  const lineRows = priced.map(({ l, unitCost }) => ({
    company_id: DEMO_COMPANY_ID, brand_id: null,
    issue_id: issue.id, material_id: l.materialId, material_name: l.materialName, unit: l.unit || null,
    qty: l.qty, unit_cost: unitCost, is_demo: false,
  }));
  const { error: lErr } = await supabase.from("material_issue_lines").insert(lineRows);
  if (lErr) { await supabase.from("material_issues").delete().eq("id", issue.id); return { ok: false, error: lErr.message }; }

  // Kurangi stok + catat pergerakan (issue). Avg cost tidak berubah saat keluar.
  for (const { l, unitCost, avail } of priced) {
    await supabase.from("material_movements").insert({
      company_id: DEMO_COMPANY_ID, brand_id: null,
      material_id: l.materialId, warehouse_id: input.warehouseId, movement_type: "issue", stock_status: "available",
      qty: l.qty, unit_cost: unitCost, source_doc_type: "material_issue", source_doc_id: issue.id,
      notes: `Issue ke SPK`, is_demo: false,
    });
    await supabase.from("material_stock_balances")
      .update({ qty_on_hand: avail - l.qty, updated_at: new Date().toISOString() })
      .eq("material_id", l.materialId).eq("warehouse_id", input.warehouseId).eq("stock_status", "available");
  }

  rv();
  return { ok: true, id: issue.id as string, code };
}

export async function cancelMaterialIssue(id: string): Promise<SimpleResult> {
  const supabase = createClient();
  const { data: issue } = await supabase.from("material_issues").select("id,warehouse_id,status").eq("id", id).single();
  if (!issue) return { ok: false, error: "Tidak ditemukan." };
  if (issue.status === "cancelled") return { ok: true };

  // Kembalikan stok.
  const { data: lines } = await supabase.from("material_issue_lines").select("material_id,qty,unit_cost").eq("issue_id", id).is("deleted_at", null);
  for (const l of lines ?? []) {
    const { data: bal } = await supabase
      .from("material_stock_balances").select("qty_on_hand")
      .eq("material_id", l.material_id).eq("warehouse_id", issue.warehouse_id).eq("stock_status", "available").maybeSingle();
    const cur = Number(bal?.qty_on_hand) || 0;
    await supabase.from("material_stock_balances")
      .update({ qty_on_hand: cur + (Number(l.qty) || 0), updated_at: new Date().toISOString() })
      .eq("material_id", l.material_id).eq("warehouse_id", issue.warehouse_id).eq("stock_status", "available");
    await supabase.from("material_movements").insert({
      company_id: DEMO_COMPANY_ID, brand_id: null,
      material_id: l.material_id, warehouse_id: issue.warehouse_id, movement_type: "return", stock_status: "available",
      qty: Number(l.qty) || 0, unit_cost: Number(l.unit_cost) || 0, source_doc_type: "material_issue_cancel", source_doc_id: id, is_demo: false,
    });
  }
  await supabase.from("material_issues").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", id);
  rv();
  return { ok: true };
}
