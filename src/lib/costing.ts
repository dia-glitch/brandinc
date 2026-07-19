import type { createClient } from "@/lib/supabase/server";

type SB = ReturnType<typeof createClient>;
export type SkuCost = { cogm: number; retail: number; locked: boolean };

/**
 * Hitung COGM/pcs & retail per SKU dari data operasional (sumber sama dgn page COGM).
 * COGM = (total material issue + total WIP) ÷ total good, diagregat lintas SPK yg
 * memproduksi SKU tsb. Dipakai bersama oleh Inventory & Finished Goods.
 */
export async function getSkuCosting(supabase: SB): Promise<Map<string, SkuCost>> {
  const [spkRes, spkLineRes, miRes, miLineRes, poRes, poLineRes, costRes] = await Promise.all([
    supabase.from("work_orders").select("id,code,status").is("deleted_at", null).order("code", { ascending: false }),
    supabase.from("work_order_lines").select("spk_id,sku").is("deleted_at", null),
    supabase.from("material_issues").select("id,spk_id,status").is("deleted_at", null),
    supabase.from("material_issue_lines").select("issue_id,qty,unit_cost").is("deleted_at", null),
    supabase.from("production_pos").select("id,spk_id,status").is("deleted_at", null),
    supabase.from("production_po_lines").select("po_id,received_qty,unit_cost").is("deleted_at", null),
    supabase.from("spk_costing").select("spk_id,retail_price,locked").is("deleted_at", null),
  ]);

  const miById = new Map<string, string>();
  (miRes.data ?? []).forEach((m) => { if ((m.status as string) !== "cancelled") miById.set(m.id as string, m.spk_id as string); });
  const materialBySpk = new Map<string, number>();
  (miLineRes.data ?? []).forEach((l) => { const spk = miById.get(l.issue_id as string); if (spk) materialBySpk.set(spk, (materialBySpk.get(spk) ?? 0) + (Number(l.qty) || 0) * (Number(l.unit_cost) || 0)); });

  const poById = new Map<string, string>();
  (poRes.data ?? []).forEach((p) => { if ((p.status as string) !== "cancelled") poById.set(p.id as string, p.spk_id as string); });
  const wipBySpk = new Map<string, number>();
  const goodBySpk = new Map<string, number>();
  (poLineRes.data ?? []).forEach((l) => { const spk = poById.get(l.po_id as string); if (!spk) return; const g = Number(l.received_qty) || 0; wipBySpk.set(spk, (wipBySpk.get(spk) ?? 0) + g * (Number(l.unit_cost) || 0)); goodBySpk.set(spk, (goodBySpk.get(spk) ?? 0) + g); });

  const costBySpk = new Map<string, { retail: number; locked: boolean }>();
  (costRes.data ?? []).forEach((c) => costBySpk.set(c.spk_id as string, { retail: Number(c.retail_price) || 0, locked: Boolean(c.locked) }));

  const rank = new Map<string, number>();
  (spkRes.data ?? []).forEach((s, i) => rank.set(s.id as string, i));

  const skuSpks = new Map<string, string[]>();
  (spkLineRes.data ?? []).forEach((l) => {
    const sku = (l.sku as string | null) ?? ""; if (!sku) return;
    const arr = skuSpks.get(sku) ?? []; const spk = l.spk_id as string;
    if (!arr.includes(spk)) arr.push(spk);
    skuSpks.set(sku, arr);
  });

  const out = new Map<string, SkuCost>();
  for (const [sku, spks] of skuSpks) {
    let cost = 0, good = 0;
    for (const s of spks) { cost += (materialBySpk.get(s) ?? 0) + (wipBySpk.get(s) ?? 0); good += goodBySpk.get(s) ?? 0; }
    const cogm = good > 0 ? cost / good : 0;
    let retail = 0, locked = false;
    for (const s of spks.slice().sort((a, b) => (rank.get(a) ?? 9999) - (rank.get(b) ?? 9999))) {
      const c = costBySpk.get(s); if (c && c.retail > 0) { retail = c.retail; locked = c.locked; break; }
    }
    out.set(sku, { cogm, retail, locked });
  }
  return out;
}
