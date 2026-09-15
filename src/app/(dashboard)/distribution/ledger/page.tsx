import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { LedgerView, type LedgerLoc, type LedgerRow } from "./ledger-view";

async function getData(): Promise<{ locations: LedgerLoc[]; rows: LedgerRow[]; brands: { id: string; name: string }[] }> {
  if (!isSupabaseConfigured()) return { locations: [], rows: [], brands: [] };
  const supabase = createClient();
  const [balRes, whRes, varRes, prodRes, brandRes] = await Promise.all([
    supabase.from("stock_balances").select("variant_id,warehouse_id,qty_on_hand,stock_status").is("deleted_at", null),
    supabase.from("warehouses").select("id,name,kind").is("deleted_at", null).order("name"),
    supabase.from("product_variants").select("id,sku,product_id").is("deleted_at", null),
    supabase.from("products").select("id,name,brand_id,style_code").is("deleted_at", null),
    supabase.from("brands").select("id,name").is("deleted_at", null).order("name"),
  ]);

  const brands = (brandRes.data ?? []).map((b) => ({ id: b.id as string, name: (b.name as string) ?? "—" }));
  const brandName = (id: string | null) => brands.find((b) => b.id === id)?.name ?? "—";
  const products = prodRes.data ?? [];
  const prodById = new Map<string, (typeof products)[number]>();
  products.forEach((p) => prodById.set(p.id as string, p));
  const variants = varRes.data ?? [];

  // Lokasi = gudang non-damage (warehouse dulu, lalu store), urut nama.
  const whAll = (whRes.data ?? []).filter((w) => (w.kind as string) !== "damage");
  const kindRank = (k: string) => (k === "warehouse" ? 0 : k === "store" ? 1 : 2);
  const locations: LedgerLoc[] = whAll
    .sort((a, b) => kindRank((a.kind as string) ?? "") - kindRank((b.kind as string) ?? "") || String(a.name).localeCompare(String(b.name)))
    .map((w) => ({ id: w.id as string, name: (w.name as string) ?? "—", kind: (w.kind as string) ?? "warehouse" }));
  const locIds = new Set(locations.map((l) => l.id));

  // qty available per (variant, warehouse).
  const cell = new Map<string, number>();
  (balRes.data ?? []).forEach((b) => {
    if ((b.stock_status as string) !== "available") return;
    const wh = b.warehouse_id as string;
    if (!locIds.has(wh)) return;
    const q = Number(b.qty_on_hand) || 0;
    if (q === 0) return;
    cell.set(`${b.variant_id}|${wh}`, (cell.get(`${b.variant_id}|${wh}`) ?? 0) + q);
  });

  const rows: LedgerRow[] = variants.map((v) => {
    const vid = v.id as string;
    const p = prodById.get(v.product_id as string);
    const qty: Record<string, number> = {};
    let total = 0;
    for (const l of locations) { const q = cell.get(`${vid}|${l.id}`) ?? 0; if (q) { qty[l.id] = q; total += q; } }
    return {
      sku: (v.sku as string) ?? "—",
      product: (p?.name as string) ?? "—",
      parentSku: (p?.style_code as string) ?? "—",
      brand: brandName((p?.brand_id as string | null) ?? null),
      brandId: (p?.brand_id as string | null) ?? null,
      qty, total,
    };
  }).filter((r) => r.total > 0).sort((a, b) => a.sku.localeCompare(b.sku));

  return { locations, rows, brands };
}

export default async function DistributionLedgerPage() {
  const { locations, rows, brands } = await getData();
  return <LedgerView locations={locations} rows={rows} brands={brands} />;
}
