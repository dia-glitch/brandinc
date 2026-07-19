import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSkuCosting } from "@/lib/costing";
import { Badge } from "@/components/ui/badge";
import { formatIDR } from "@/lib/utils";

type Row = { parentSku: string; sku: string; product: string; brand: string; warehouse: string; status: string; qty: number; avg: number; value: number };

async function getData(): Promise<{ rows: Row[]; totalGood: number; totalDamage: number }> {
  if (!isSupabaseConfigured()) return { rows: [], totalGood: 0, totalDamage: 0 };
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

  let totalGood = 0, totalDamage = 0;
  const rows: Row[] = Array.from(groups.values()).map((g) => {
    const v = varBySku(g.sku);
    const p = prodInfo(v?.product_id as string | undefined);
    if (g.status === "damaged") totalDamage += g.value; else totalGood += g.value;
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

  return { rows, totalGood, totalDamage };
}

export default async function FinishedGoodsPage() {
  const { rows, totalGood, totalDamage } = await getData();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Finished Goods</p>
        <h1 className="text-2xl font-extrabold">Rekap Barang Jadi (Incoming)</h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          Total masuk dari Incoming &amp; QC (dikunci, tidak bergerak). Good: <b className="text-foreground">{formatIDR(totalGood)}</b> · Damage: <b className="text-danger">{formatIDR(totalDamage)}</b>.
        </p>
        <p className="mt-1 text-xs font-medium text-muted-foreground">Stok berjalan (berkurang saat sales) ada di <b>Inventory → Stok per Lokasi</b>.</p>
      </div>

      {rows.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="font-bold">Belum ada stok barang jadi</p>
          <p className="mt-1 text-sm font-medium text-muted-foreground">Stok masuk lewat <b>Incoming &amp; QC</b> dari PO Produksi.</p>
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3">Parent SKU</th>
                <th className="px-5 py-3">SKU</th>
                <th className="px-5 py-3">Produk</th>
                <th className="px-5 py-3">Brand</th>
                <th className="px-5 py-3">Gudang</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Qty</th>
                <th className="px-5 py-3 text-right">COGM</th>
                <th className="px-5 py-3 text-right">Nilai COGM</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-border font-semibold hover:bg-muted/50">
                  <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{r.parentSku}</td>
                  <td className="px-5 py-3 font-mono text-xs">{r.sku}</td>
                  <td className="px-5 py-3">{r.product}</td>
                  <td className="px-5 py-3 font-medium text-muted-foreground">{r.brand}</td>
                  <td className="px-5 py-3 font-medium text-muted-foreground">{r.warehouse}</td>
                  <td className="px-5 py-3">{r.status === "damaged" ? <Badge tone="danger">Damage</Badge> : <Badge tone="success">Good</Badge>}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{r.qty}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{formatIDR(r.avg)}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{formatIDR(r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
