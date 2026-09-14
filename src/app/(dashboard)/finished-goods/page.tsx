import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSkuCosting } from "@/lib/costing";
import { FGStockView, type FGRow } from "./fg-stock-view";


async function getData(): Promise<{ rows: FGRow[] }> {
  if (!isSupabaseConfigured()) return { rows: [] };
  const supabase = createClient();
  // REKAP INCOMING (dikunci): sumbernya fg_receipt_lines (hasil QC), BUKAN saldo stok berjalan.
  const [rcptRes, rLineRes, varRes, prodRes, brandRes, whRes, costing] = await Promise.all([
    supabase.from("fg_receipts").select("id,brand_id,good_warehouse_id,damage_warehouse_id").is("deleted_at", null),
    supabase.from("fg_receipt_lines").select("receipt_id,variant_id,sku,qty_good,qty_damage,unit_cost").is("deleted_at", null),
    supabase.from("product_variants").select("id,sku,product_id").is("deleted_at", null),
    supabase.from("products").select("id,name,brand_id,style_code").is("deleted_at", null),
    supabase.from("brands").select("id,name").is("deleted_at", null),
    supabase.from("warehouses").select("id,name").is("deleted_at", null),
    getSkuCosting(supabase),
  ]);

  const variants = varRes.data ?? [];
  const products = prodRes.data ?? [];
  const brands = brandRes.data ?? [];
  const whs = whRes.data ?? [];
  const varBySku = (sku: string) => variants.find((v) => v.sku === sku);
  const prodInfo = (id: string | undefined) => products.find((p) => p.id === id);
  const brandName = (id: string | null | undefined) => brands.find((b) => b.id === id)?.name ?? "—";
  const whName = (id: string | null) => whs.find((w) => w.id === id)?.name ?? "—";
  const rcptById = new Map<string, { good_wh: string | null; damage_wh: string | null }>();
  (rcptRes.data ?? []).forEach((r) => rcptById.set(r.id as string, { good_wh: (r.good_warehouse_id as string | null) ?? null, damage_wh: (r.damage_warehouse_id as string | null) ?? null }));

  // Agregasi per SKU + status + gudang.
  type Agg = { qty: number; value: number };
  const groups = new Map<string, Agg & { sku: string; status: string; whId: string | null }>();
  for (const l of rLineRes.data ?? []) {
    const sku = (l.sku as string) ?? "(?)";
    const rc = rcptById.get(l.receipt_id as string);
    const good = Number(l.qty_good) || 0;
    const dmg = Number(l.qty_damage) || 0;
    const wip = Number(l.unit_cost) || 0;           // ongkos WIP per pcs
    const cogm = costing.get(sku)?.cogm ?? wip;      // COGM penuh utk good
    if (good > 0) {
      const wh = rc?.good_wh ?? null;
      const key = `${sku}|available|${wh}`;
      const g = groups.get(key) ?? { sku, status: "available", whId: wh, qty: 0, value: 0 };
      g.qty += good; g.value += good * cogm; groups.set(key, g);
    }
    if (dmg > 0) {
      const wh = rc?.damage_wh ?? null;
      const key = `${sku}|damaged|${wh}`;
      const g = groups.get(key) ?? { sku, status: "damaged", whId: wh, qty: 0, value: 0 };
      g.qty += dmg; g.value += dmg * wip; groups.set(key, g); // damage @ WIP saja
    }
  }

  const rows: FGRow[] = Array.from(groups.values()).map((g) => {
    const v = varBySku(g.sku);
    const p = prodInfo(v?.product_id as string | undefined);
    return {
      parentSku: (p?.style_code as string) ?? "—",
      sku: g.sku,
      product: (p?.name as string) ?? "—",
      brand: brandName(p?.brand_id as string | undefined),
      warehouse: whName(g.whId),
      status: g.status,
      qty: g.qty, avg: g.qty > 0 ? g.value / g.qty : 0, value: g.value,
    };
  }).filter((r) => r.qty !== 0).sort((a, b) => a.sku.localeCompare(b.sku));

  return { rows };
}

export default async function FinishedGoodsPage() {
  const { rows } = await getData();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Finished Goods</p>
        <h1 className="text-2xl font-extrabold">Rekap Barang Jadi (Incoming)</h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          Total masuk dari Incoming &amp; QC (dikunci, tidak bergerak). Rincian nilai ada di kartu bawah — mengikuti filter brand.
        </p>
        <p className="mt-1 text-xs font-medium text-muted-foreground">Stok berjalan (berkurang saat sales) ada di <b>Inventory → Stok per Lokasi</b>.</p>
      </div>

      {rows.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="font-bold">Belum ada stok barang jadi</p>
          <p className="mt-1 text-sm font-medium text-muted-foreground">Stok masuk lewat <b>Incoming &amp; QC</b> dari PO Produksi.</p>
        </div>
      ) : (
        <FGStockView rows={rows} />
      )}
    </div>
  );
}
