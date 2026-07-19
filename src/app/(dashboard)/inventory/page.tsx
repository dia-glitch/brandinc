import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { CatalogTable, type CatalogRow } from "./catalog-table";

async function getData() {
  if (!isSupabaseConfigured()) return { rows: [] as CatalogRow[], brands: [] as { id: string; name: string }[] };
  const supabase = createClient();
  const [prodRes, varRes, brandRes, colorRes, balRes, spkRes, spkLineRes, miRes, miLineRes, poRes, poLineRes, costRes, rcptRes, rLineRes] = await Promise.all([
    supabase.from("products").select("id,name,brand_id,color_id,status,style_code").is("deleted_at", null),
    supabase.from("product_variants").select("id,product_id,sku,color,size").is("deleted_at", null),
    supabase.from("brands").select("id,name").is("deleted_at", null).order("name"),
    supabase.from("colors").select("id,name").is("deleted_at", null),
    supabase.from("stock_balances").select("variant_id,qty_on_hand,stock_status").is("deleted_at", null),
    supabase.from("work_orders").select("id,code,status").is("deleted_at", null).order("code", { ascending: false }),
    supabase.from("work_order_lines").select("spk_id,product_id,sku").is("deleted_at", null),
    supabase.from("material_issues").select("id,spk_id,status").is("deleted_at", null),
    supabase.from("material_issue_lines").select("issue_id,qty,unit_cost").is("deleted_at", null),
    supabase.from("production_pos").select("id,spk_id,status").is("deleted_at", null),
    supabase.from("production_po_lines").select("po_id,received_qty,unit_cost").is("deleted_at", null),
    supabase.from("spk_costing").select("spk_id,retail_price,locked").is("deleted_at", null),
    supabase.from("fg_receipts").select("id,receipt_date").is("deleted_at", null),
    supabase.from("fg_receipt_lines").select("receipt_id,variant_id,qty_good").is("deleted_at", null),
  ]);

  const brands = (brandRes.data ?? []).map((b) => ({ id: b.id as string, name: b.name as string }));
  const brandName = (id: string | null) => brands.find((b) => b.id === id)?.name ?? "—";
  const colors = colorRes.data ?? [];
  const colorName = (id: string | null) => colors.find((c) => c.id === id)?.name as string | undefined;

  // --- COGM/pcs & retail per SPK ---
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

  // Map SKU -> SEMUA SPK yg memproduksinya (spkRes desc by code = terbaru dulu).
  const spkOrder = (spkRes.data ?? []).map((s) => s.id as string);
  const spkRank = new Map<string, number>(); spkOrder.forEach((id, i) => spkRank.set(id, i));
  const skuSpks = new Map<string, string[]>();
  (spkLineRes.data ?? []).forEach((l) => {
    const sku = (l.sku as string | null) ?? ""; const spk = l.spk_id as string;
    if (!sku) return;
    const arr = skuSpks.get(sku) ?? [];
    if (!arr.includes(spk)) arr.push(spk);
    skuSpks.set(sku, arr);
  });
  // COGM per SKU = total (material+wip) SPK ybs ÷ total good — sumbernya sama dgn page COGM.
  function skuCogm(sku: string): number {
    const spks = skuSpks.get(sku) ?? [];
    let cost = 0, good = 0;
    for (const s of spks) { cost += (materialBySpk.get(s) ?? 0) + (wipBySpk.get(s) ?? 0); good += goodBySpk.get(s) ?? 0; }
    return good > 0 ? cost / good : 0;
  }
  // Retail per SKU = dari SPK (paling baru) yg sudah diisi retail di page COGM.
  function skuRetail(sku: string): { retail: number; locked: boolean } {
    const spks = (skuSpks.get(sku) ?? []).slice().sort((a, b) => (spkRank.get(a) ?? 9999) - (spkRank.get(b) ?? 9999));
    for (const s of spks) { const c = costBySpk.get(s); if (c && c.retail > 0) return c; }
    return { retail: 0, locked: false };
  }

  // Stok good per varian.
  const stockByVar = new Map<string, number>();
  (balRes.data ?? []).forEach((b) => { if ((b.stock_status as string) === "available") stockByVar.set(b.variant_id as string, (stockByVar.get(b.variant_id as string) ?? 0) + (Number(b.qty_on_hand) || 0)); });

  // Aging: tanggal incoming (kedatangan) paling awal yg menghasilkan good per varian.
  const rcptDate = new Map<string, string>();
  (rcptRes.data ?? []).forEach((r) => { if (r.receipt_date) rcptDate.set(r.id as string, r.receipt_date as string); });
  const earliestByVar = new Map<string, string>();
  (rLineRes.data ?? []).forEach((l) => {
    if ((Number(l.qty_good) || 0) <= 0) return;
    const vid = l.variant_id as string | null; if (!vid) return;
    const d = rcptDate.get(l.receipt_id as string); if (!d) return;
    const cur = earliestByVar.get(vid);
    if (!cur || d < cur) earliestByVar.set(vid, d);
  });
  const todayMs = Date.now();
  const agingOf = (vid: string): number | null => {
    const d = earliestByVar.get(vid);
    if (!d) return null;
    return Math.max(0, Math.floor((todayMs - new Date(d + "T00:00:00").getTime()) / 86400000));
  };

  const products = prodRes.data ?? [];
  const prodInfo = (id: string) => products.find((p) => p.id === id);

  const rows: CatalogRow[] = (varRes.data ?? []).map((v) => {
    const p = prodInfo(v.product_id as string);
    const sku = v.sku as string;
    const cost = skuRetail(sku);
    return {
      variantId: v.id as string,
      parentSku: (p?.style_code as string) ?? "—",
      sku,
      product: (p?.name as string) ?? "—",
      brand: brandName((p?.brand_id as string | null) ?? null),
      brandId: (p?.brand_id as string | null) ?? null,
      color: (v.color as string | null) ?? colorName((p?.color_id as string | null) ?? null) ?? "",
      size: (v.size as string | null) ?? "",
      stock: stockByVar.get(v.id as string) ?? 0,
      cogm: skuCogm(sku),
      retail: cost.retail,
      locked: cost.locked,
      aging: agingOf(v.id as string),
    };
  }).sort((a, b) => a.sku.localeCompare(b.sku));

  return { rows, brands };
}

export default async function InventoryCatalogPage() {
  const { rows, brands } = await getData();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Inventory</p>
        <h1 className="text-2xl font-extrabold">Katalog / Master Inventory</h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          {rows.length} SKU. Detail produk + stok + COGM (dari produksi) + retail price (dari COGM/harga jual).
        </p>
      </div>
      <CatalogTable rows={rows} brands={brands} />
    </div>
  );
}
