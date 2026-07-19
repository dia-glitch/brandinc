"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEMO_COMPANY_ID } from "@/lib/supabase/config";

type Result = { ok: true } | { ok: false; error: string };
type CreateResult = { ok: true; code: string } | { ok: false; error: string };

export type Attachment = { name: string; url: string; kind: string };
export type CPLineInput = { materialId: string; materialName: string; unit: string; qty: number; unitPrice: number };
export type CPInput = {
  prId: string; purchaseDate: string; vendor: string; notaNo: string; warehouseId: string;
  notes: string; attachments: Attachment[]; lines: CPLineInput[];
};

function rv() {
  revalidatePath("/raw-material");
  revalidatePath("/raw-material/cash-purchase");
  revalidatePath("/finance/payment-request");
}

async function nextCode(supabase: ReturnType<typeof createClient>): Promise<string> {
  const { count } = await supabase.from("cash_purchases").select("id", { count: "exact", head: true });
  return `CP-${String((count ?? 0) + 1).padStart(4, "0")}`;
}

/** Stok masuk + moving average (identik dengan penerimaan bahan). */
async function stockIn(supabase: ReturnType<typeof createClient>, materialId: string, warehouseId: string, qty: number, unitCost: number, purchaseId: string, notes: string) {
  await supabase.from("material_movements").insert({
    company_id: DEMO_COMPANY_ID, brand_id: null, material_id: materialId, warehouse_id: warehouseId || null,
    movement_type: "receipt", stock_status: "available", qty, unit_cost: unitCost || 0,
    source_doc_type: "cash_purchase", source_doc_id: purchaseId, notes: notes || null, is_demo: false,
  });
  const { data: bal } = await supabase.from("material_stock_balances")
    .select("qty_on_hand,moving_avg_cost").eq("material_id", materialId).eq("warehouse_id", warehouseId).eq("stock_status", "available").maybeSingle();
  const oldQty = Number(bal?.qty_on_hand) || 0;
  const oldAvg = Number(bal?.moving_avg_cost) || 0;
  const newQty = oldQty + qty;
  const newAvg = newQty > 0 ? (oldQty * oldAvg + qty * (unitCost || 0)) / newQty : 0;
  await supabase.from("material_stock_balances").upsert({
    company_id: DEMO_COMPANY_ID, brand_id: null, material_id: materialId, warehouse_id: warehouseId || null,
    stock_status: "available", qty_on_hand: newQty, moving_avg_cost: newAvg, is_demo: false,
  }, { onConflict: "material_id,warehouse_id,stock_status" });
}

export async function createCashPurchase(input: CPInput): Promise<CreateResult> {
  const supabase = createClient();
  if (!input.prId) return { ok: false, error: "Pilih Cash Advance sumber dana." };
  if (!input.warehouseId) return { ok: false, error: "Pilih gudang." };
  const lines = (input.lines ?? []).filter((l) => l.materialId && l.qty > 0);
  if (lines.length === 0) return { ok: false, error: "Tambah minimal satu material (qty > 0)." };

  const total = lines.reduce((s, l) => s + l.qty * (l.unitPrice || 0), 0);
  const code = await nextCode(supabase);

  const { data: cp, error: cpErr } = await supabase.from("cash_purchases").insert({
    company_id: DEMO_COMPANY_ID, brand_id: null, code, pr_id: input.prId, purchase_date: input.purchaseDate || null,
    vendor: input.vendor.trim() || null, nota_no: input.notaNo.trim() || null, warehouse_id: input.warehouseId,
    total, notes: input.notes.trim() || null, attachments: input.attachments ?? [], is_demo: false,
  }).select("id").single();
  if (cpErr || !cp) return { ok: false, error: cpErr?.message ?? "Gagal simpan." };

  const { error: lErr } = await supabase.from("cash_purchase_lines").insert(
    lines.map((l) => ({
      company_id: DEMO_COMPANY_ID, brand_id: null, purchase_id: cp.id as string, material_id: l.materialId,
      material_name: l.materialName || null, unit: l.unit || null, qty: l.qty, unit_price: l.unitPrice || 0, is_demo: false,
    }))
  );
  if (lErr) return { ok: false, error: lErr.message };

  for (const l of lines) {
    await stockIn(supabase, l.materialId, input.warehouseId, l.qty, l.unitPrice || 0, cp.id as string, `${code} · ${input.vendor || "nota"}`);
  }

  rv();
  return { ok: true, code };
}

export async function deleteCashPurchase(id: string): Promise<Result> {
  const supabase = createClient();
  // Balik stok: keluarkan kembali qty yang pernah masuk dari pembelian ini.
  const { data: lines } = await supabase.from("cash_purchase_lines").select("material_id,qty,unit_price").eq("purchase_id", id).is("deleted_at", null);
  const { data: cp } = await supabase.from("cash_purchases").select("warehouse_id").eq("id", id).single();
  const wh = (cp?.warehouse_id as string | null) ?? null;
  for (const l of lines ?? []) {
    const mid = l.material_id as string;
    const qty = Number(l.qty) || 0;
    if (!mid || qty <= 0 || !wh) continue;
    await supabase.from("material_movements").insert({
      company_id: DEMO_COMPANY_ID, brand_id: null, material_id: mid, warehouse_id: wh,
      movement_type: "adjustment", stock_status: "available", qty: -qty, unit_cost: Number(l.unit_price) || 0,
      source_doc_type: "cash_purchase_void", source_doc_id: id, notes: "Pembatalan pembelian tunai", is_demo: false,
    });
    const { data: bal } = await supabase.from("material_stock_balances")
      .select("qty_on_hand,moving_avg_cost").eq("material_id", mid).eq("warehouse_id", wh).eq("stock_status", "available").maybeSingle();
    const oldQty = Number(bal?.qty_on_hand) || 0;
    const newQty = Math.max(0, oldQty - qty);
    await supabase.from("material_stock_balances").upsert({
      company_id: DEMO_COMPANY_ID, brand_id: null, material_id: mid, warehouse_id: wh, stock_status: "available",
      qty_on_hand: newQty, moving_avg_cost: Number(bal?.moving_avg_cost) || 0, is_demo: false,
    }, { onConflict: "material_id,warehouse_id,stock_status" });
  }
  await supabase.from("cash_purchase_lines").update({ deleted_at: new Date().toISOString() }).eq("purchase_id", id);
  const { error } = await supabase.from("cash_purchases").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  rv();
  return { ok: true };
}
