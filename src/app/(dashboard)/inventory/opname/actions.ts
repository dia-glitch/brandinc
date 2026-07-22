"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEMO_COMPANY_ID } from "@/lib/supabase/config";
import { getRole } from "@/lib/roles";
import { canAct } from "@/lib/permissions";

type Result = { ok: true; count: number } | { ok: false; error: string };
export type OpnameLine = { variantId: string; warehouseId: string; stockStatus: string; qtyFisik: number };

/**
 * Stock Opname: sesuaikan stok sistem ke hasil hitung fisik.
 * Untuk tiap baris yang berubah → catat 1 movement 'adjustment' (selisih) +
 * set qty_on_hand = qty fisik. Moving average TIDAK berubah.
 */
export async function adjustStock(input: { note: string; lines: OpnameLine[] }): Promise<Result> {
  const supabase = createClient();
  if (!canAct(await getRole(supabase), "inventory")) return { ok: false, error: "Hanya admin/role dengan akses aksi Inventory yang boleh melakukan opname." };

  const note = (input.note ?? "").trim() || "Stock opname";
  let count = 0;

  for (const l of input.lines ?? []) {
    if (!l.variantId || !l.warehouseId) continue;
    const status = l.stockStatus || "available";
    const qtyFisik = Number(l.qtyFisik);
    if (!Number.isFinite(qtyFisik) || qtyFisik < 0) continue;

    const { data: bal } = await supabase.from("stock_balances")
      .select("qty_on_hand,moving_avg_cost,brand_id")
      .eq("variant_id", l.variantId).eq("warehouse_id", l.warehouseId).eq("stock_status", status).maybeSingle();
    const qtySys = Number(bal?.qty_on_hand) || 0;
    const avg = Number(bal?.moving_avg_cost) || 0;
    let brandId = (bal?.brand_id as string | null) ?? null;
    const delta = qtyFisik - qtySys;
    if (Math.abs(delta) < 0.0001) continue;

    if (!brandId) {
      const { data: v } = await supabase.from("product_variants").select("product_id").eq("id", l.variantId).maybeSingle();
      if (v?.product_id) {
        const { data: p } = await supabase.from("products").select("brand_id").eq("id", v.product_id as string).maybeSingle();
        brandId = (p?.brand_id as string | null) ?? null;
      }
    }

    // Ledger: movement penyesuaian (selisih).
    await supabase.from("inventory_movements").insert({
      company_id: DEMO_COMPANY_ID, brand_id: brandId, variant_id: l.variantId, warehouse_id: l.warehouseId,
      movement_type: "adjustment", stock_status: status, qty: delta, unit_cost: avg,
      source_doc_type: "stock_opname", note, is_demo: false,
    });

    // Saldo: set langsung ke qty fisik (avg tetap).
    await supabase.from("stock_balances").upsert({
      company_id: DEMO_COMPANY_ID, brand_id: brandId, variant_id: l.variantId, warehouse_id: l.warehouseId, stock_status: status,
      qty_on_hand: qtyFisik, moving_avg_cost: avg, is_demo: false,
    }, { onConflict: "variant_id,warehouse_id,stock_status" });
    count++;
  }

  if (count === 0) return { ok: false, error: "Tidak ada selisih untuk disesuaikan (semua qty fisik = sistem)." };
  revalidatePath("/inventory/opname"); revalidatePath("/inventory/stock"); revalidatePath("/inventory/log"); revalidatePath("/inventory");
  return { ok: true, count };
}
