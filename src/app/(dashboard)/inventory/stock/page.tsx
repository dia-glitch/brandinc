import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSkuCosting } from "@/lib/costing";
import { StockTable, type StockRow } from "./stock-table";

async function getData() {
  if (!isSupabaseConfigured()) return { rows: [] as StockRow[], brands: [] as { id: string; name: string }[] };
  const supabase = createClient();
  const [balRes, mvRes, varRes, prodRes, brandRes, whRes, costing] = await Promise.all([
    supabase.from("stock_balances").select("variant_id,warehouse_id,stock_status,qty_on_hand,moving_avg_cost").is("deleted_at", null),
    supabase.from("inventory_movements").select("variant_id,warehouse_id,stock_status,movement_type,qty").is("deleted_at", null),
    supabase.from("product_variants").select("id,product_id,sku").is("deleted_at", null),
    supabase.from("products").select("id,name,brand_id,style_code").is("deleted_at", null),
    supabase.from("brands").select("id,name").is("deleted_at", null).order("name"),
    supabase.from("warehouses").select("id,name").is("deleted_at", null),
    getSkuCosting(supabase),
  ]);

  // Agregasi pergerakan per varian+gudang+status.
  // Qty In = pemasukan asli (produksi/terima/transfer/adjust +), TIDAK termasuk 'return'.
  // Qty Sold = net terjual = Σ|sale| − Σ return (pembatalan/edit penjualan dikembalikan → tidak dihitung terjual).
  const inByKey = new Map<string, number>();
  const saleByKey = new Map<string, number>();
  const returnByKey = new Map<string, number>();
  for (const m of mvRes.data ?? []) {
    const k = `${m.variant_id}-${m.warehouse_id}-${(m.stock_status as string) ?? "available"}`;
    const q = Number(m.qty) || 0;
    const type = (m.movement_type as string) ?? "";
    if (type === "return") returnByKey.set(k, (returnByKey.get(k) ?? 0) + Math.abs(q));
    else if (q > 0) inByKey.set(k, (inByKey.get(k) ?? 0) + q);
    if (type === "sale") saleByKey.set(k, (saleByKey.get(k) ?? 0) + Math.abs(q));
  }
  const soldByKey = new Map<string, number>();
  for (const k of new Set([...saleByKey.keys(), ...returnByKey.keys()])) {
    soldByKey.set(k, Math.max(0, (saleByKey.get(k) ?? 0) - (returnByKey.get(k) ?? 0)));
  }

  const brands = (brandRes.data ?? []).map((b) => ({ id: b.id as string, name: b.name as string }));
  const brandName = (id: string | null | undefined) => brands.find((b) => b.id === id)?.name ?? "—";
  const variants = varRes.data ?? [];
  const products = prodRes.data ?? [];
  const whs = whRes.data ?? [];
  const varInfo = (id: string) => variants.find((v) => v.id === id);
  const prodInfo = (id: string | undefined) => products.find((p) => p.id === id);
  const whName = (id: string) => whs.find((w) => w.id === id)?.name ?? "—";

  const rows: StockRow[] = (balRes.data ?? []).map((b, i) => {
    const v = varInfo(b.variant_id as string);
    const p = prodInfo(v?.product_id as string | undefined);
    const sku = (v?.sku as string) ?? "(?)";
    const qty = Number(b.qty_on_hand) || 0;
    const c = costing.get(sku);
    const status = (b.stock_status as string) ?? "available";
    const wip = Number(b.moving_avg_cost) || 0; // ongkos WIP (dari incoming)
    // Good = COGM penuh (material+WIP). Damage = WIP saja (material hanya dibebankan ke Good).
    const cost = status === "damaged" ? wip : (c && c.cogm > 0 ? c.cogm : wip);
    const aggKey = `${b.variant_id}-${b.warehouse_id}-${status}`;
    return {
      key: `${b.variant_id}-${b.warehouse_id}-${b.stock_status}-${i}`,
      parentSku: (p?.style_code as string) ?? "—",
      sku,
      product: (p?.name as string) ?? "—",
      brand: brandName(p?.brand_id as string | undefined),
      brandId: (p?.brand_id as string | null) ?? null,
      warehouse: whName(b.warehouse_id as string),
      status,
      qtyIn: inByKey.get(aggKey) ?? 0, qtySold: soldByKey.get(aggKey) ?? 0,
      qty, avg: cost, value: qty * cost, retail: c?.retail ?? 0,
    };
  }).filter((r) => r.qty !== 0).sort((a, b) => a.sku.localeCompare(b.sku));

  return { rows, brands };
}

export default async function InventoryStockPage() {
  const { rows, brands } = await getData();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Inventory</p>
        <h1 className="text-2xl font-extrabold">Stok per Lokasi</h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">Saldo barang jadi per SKU, gudang, &amp; status (Good/Damage) — moving average.</p>
      </div>
      <StockTable rows={rows} brands={brands} />
    </div>
  );
}
