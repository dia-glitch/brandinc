"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEMO_COMPANY_ID } from "@/lib/supabase/config";

type Result = { ok: true } | { ok: false; error: string };

export type ReceiveInput = {
  materialId: string;
  warehouseId: string;
  qty: number;
  unitCost: number;
  date: string;
  notes: string;
};

/**
 * Terima bahan ke gudang RM.
 * - Catat pergerakan (receipt) di material_movements (append-only).
 * - Perbarui saldo + moving average cost:
 *   avg_baru = (qty_lama*avg_lama + qty_masuk*harga_masuk) / (qty_lama+qty_masuk)
 */
export async function receiveMaterial(input: ReceiveInput): Promise<Result> {
  const supabase = createClient();
  if (!input.materialId) return { ok: false, error: "Pilih material." };
  if (!(input.qty > 0)) return { ok: false, error: "Qty harus lebih dari 0." };

  const { error: mvErr } = await supabase.from("material_movements").insert({
    company_id: DEMO_COMPANY_ID, brand_id: null,
    material_id: input.materialId,
    warehouse_id: input.warehouseId || null,
    movement_type: "receipt",
    stock_status: "available",
    qty: input.qty,
    unit_cost: input.unitCost || 0,
    source_doc_type: "receiving",
    notes: input.notes.trim() || null,
    is_demo: false,
  });
  if (mvErr) return { ok: false, error: mvErr.message };

  // Hitung moving average
  const { data: bal } = await supabase
    .from("material_stock_balances")
    .select("qty_on_hand,moving_avg_cost")
    .eq("material_id", input.materialId)
    .eq("warehouse_id", input.warehouseId)
    .eq("stock_status", "available")
    .maybeSingle();

  const oldQty = Number(bal?.qty_on_hand) || 0;
  const oldAvg = Number(bal?.moving_avg_cost) || 0;
  const newQty = oldQty + input.qty;
  const newAvg = newQty > 0 ? (oldQty * oldAvg + input.qty * (input.unitCost || 0)) / newQty : 0;

  const { error: balErr } = await supabase
    .from("material_stock_balances")
    .upsert(
      {
        company_id: DEMO_COMPANY_ID, brand_id: null,
        material_id: input.materialId,
        warehouse_id: input.warehouseId || null,
        stock_status: "available",
        qty_on_hand: newQty,
        moving_avg_cost: newAvg,
        is_demo: false,
      },
      { onConflict: "material_id,warehouse_id,stock_status" }
    );
  if (balErr) return { ok: false, error: balErr.message };

  revalidatePath("/raw-material");
  return { ok: true };
}
