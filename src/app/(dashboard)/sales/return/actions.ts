"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEMO_COMPANY_ID } from "@/lib/supabase/config";

type Result = { ok: true } | { ok: false; error: string };
type CreateResult = { ok: true; code: string } | { ok: false; error: string };
function rv() {
  revalidatePath("/sales"); revalidatePath("/sales/return"); revalidatePath("/sales/ledger");
  revalidatePath("/inventory"); revalidatePath("/inventory/stock"); revalidatePath("/accounting/laba-rugi");
  revalidatePath("/finance/refund"); revalidatePath("/finance/cash"); revalidatePath("/finance/summary");
}

async function nextCode(supabase: ReturnType<typeof createClient>): Promise<string> {
  const { count } = await supabase.from("sales_returns").select("id", { count: "exact", head: true });
  return `SR-${String((count ?? 0) + 1).padStart(4, "0")}`;
}

/** Tambah stok kembali (return). */
async function stockBack(supabase: ReturnType<typeof createClient>, variantId: string, warehouseId: string, status: string, qty: number, unitCost: number, brandId: string | null, returnId: string) {
  await supabase.from("inventory_movements").insert({
    company_id: DEMO_COMPANY_ID, brand_id: brandId, variant_id: variantId, warehouse_id: warehouseId,
    movement_type: "return", stock_status: status, qty, unit_cost: unitCost || 0,
    source_doc_type: "sales_return", source_doc_id: returnId, is_demo: false,
  });
  const { data: bal } = await supabase.from("stock_balances")
    .select("qty_on_hand,moving_avg_cost").eq("variant_id", variantId).eq("warehouse_id", warehouseId).eq("stock_status", status).maybeSingle();
  const oldQty = Number(bal?.qty_on_hand) || 0;
  await supabase.from("stock_balances").upsert({
    company_id: DEMO_COMPANY_ID, brand_id: brandId, variant_id: variantId, warehouse_id: warehouseId, stock_status: status,
    qty_on_hand: oldQty + qty, moving_avg_cost: Number(bal?.moving_avg_cost) || unitCost || 0, is_demo: false,
  }, { onConflict: "variant_id,warehouse_id,stock_status" });
}

export type ReturnLineInput = { variantId: string; warehouseId: string; restock: string; sku: string; size: string; productName: string; qty: number; price: number; cogm: number };
export type ReturnInput = {
  orderId: string; brandId: string; channelId: string | null; settlement: string; returnDate: string; reason: string; notes: string; lines: ReturnLineInput[];
  refundRequired?: boolean; refundAmount?: number; refundBankName?: string; refundAccountNo?: string; refundAccountHolder?: string;
};

export async function createSalesReturn(input: ReturnInput): Promise<CreateResult> {
  const supabase = createClient();
  if (!input.brandId) return { ok: false, error: "Brand tidak diketahui." };
  const lines = (input.lines ?? []).filter((l) => l.variantId && l.warehouseId && l.qty > 0);
  if (lines.length === 0) return { ok: false, error: "Isi qty retur minimal satu produk." };

  const refund = Number(input.refundAmount) || 0;
  const needRefund = Boolean(input.refundRequired) && refund > 0;
  const code = await nextCode(supabase);
  const { data: ret, error: rErr } = await supabase.from("sales_returns").insert({
    company_id: DEMO_COMPANY_ID, brand_id: input.brandId, code, order_id: input.orderId || null, channel_id: input.channelId,
    settlement: input.settlement || "ar", return_date: input.returnDate || null, reason: input.reason.trim() || null, notes: input.notes.trim() || null,
    refund_required: needRefund ? "1" : null, refund_amount: needRefund ? refund : 0,
    refund_bank_name: input.refundBankName?.trim() || null, refund_account_no: input.refundAccountNo?.trim() || null, refund_account_holder: input.refundAccountHolder?.trim() || null,
    refund_status: needRefund ? "pending" : "none", is_demo: false,
  }).select("id").single();
  if (rErr || !ret) return { ok: false, error: rErr?.message ?? "Gagal simpan." };
  const returnId = ret.id as string;

  const { error: lErr } = await supabase.from("sales_return_lines").insert(
    lines.map((l) => ({
      company_id: DEMO_COMPANY_ID, brand_id: input.brandId, return_id: returnId, variant_id: l.variantId, warehouse_id: l.warehouseId,
      restock: l.restock || "available", sku: l.sku || null, size: l.size || null, product_name: l.productName || null, qty: l.qty, price: l.price || 0, cogm: l.cogm || 0, is_demo: false,
    }))
  );
  if (lErr) return { ok: false, error: lErr.message };

  for (const l of lines) await stockBack(supabase, l.variantId, l.warehouseId, l.restock || "available", l.qty, l.cogm || 0, input.brandId, returnId);

  // Refund TIDAK langsung jadi kas keluar — status pending, diproses Finance (transfer riil).
  rv(); return { ok: true, code };
}

export async function deleteSalesReturn(id: string): Promise<Result> {
  const supabase = createClient();
  const { data: ret } = await supabase.from("sales_returns").select("brand_id").eq("id", id).single();
  const { data: lines } = await supabase.from("sales_return_lines").select("variant_id,warehouse_id,restock,qty,cogm").eq("return_id", id).is("deleted_at", null);
  // Balik: keluarkan lagi stok yang tadi dimasukkan.
  for (const l of lines ?? []) {
    const vid = l.variant_id as string | null; const wh = l.warehouse_id as string | null; const qty = Number(l.qty) || 0; const st = (l.restock as string) ?? "available";
    if (vid && wh && qty > 0) await stockBack(supabase, vid, wh, st, -qty, Number(l.cogm) || 0, (ret?.brand_id as string | null) ?? null, id);
  }
  await supabase.from("sales_return_lines").update({ deleted_at: new Date().toISOString() }).eq("return_id", id);
  // Batalkan refund yang tercatat (bila ada).
  const { data: sr } = await supabase.from("sales_returns").select("code").eq("id", id).single();
  if (sr?.code) await supabase.from("payments").update({ deleted_at: new Date().toISOString() }).eq("ref_type", "sales_refund").eq("ref_key", sr.code as string);
  const { error } = await supabase.from("sales_returns").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/finance/cash"); revalidatePath("/finance/summary");
  rv(); return { ok: true };
}
