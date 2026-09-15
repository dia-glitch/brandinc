import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getRole } from "@/lib/roles";
import { canAct } from "@/lib/permissions";
import { getSkuCosting } from "@/lib/costing";
import { POSView, type PosItem, type PosLoc } from "./pos-view";

async function getData(): Promise<{ locations: PosLoc[]; items: PosItem[]; canEdit: boolean }> {
  if (!isSupabaseConfigured()) return { locations: [], items: [], canEdit: false };
  const supabase = createClient();
  const [balRes, whRes, varRes, prodRes, brandRes, costing, role] = await Promise.all([
    supabase.from("stock_balances").select("variant_id,warehouse_id,qty_on_hand,stock_status").is("deleted_at", null),
    supabase.from("warehouses").select("id,name,kind").is("deleted_at", null).order("name"),
    supabase.from("product_variants").select("id,sku,size,product_id,retail_price").is("deleted_at", null),
    supabase.from("products").select("id,name,brand_id,style_code,catalog_image_url").is("deleted_at", null),
    supabase.from("brands").select("id,name").is("deleted_at", null),
    getSkuCosting(supabase),
    getRole(supabase),
  ]);

  const brandName = new Map((brandRes.data ?? []).map((b) => [b.id as string, (b.name as string) ?? "—"]));
  const prodById = new Map((prodRes.data ?? []).map((p) => [p.id as string, p]));

  // Lokasi POS = gudang tipe store (popup) & warehouse umum; kecuali bahan baku & damage.
  const kindRank = (k: string) => (k === "store" ? 0 : k === "warehouse" ? 1 : 9);
  const locations: PosLoc[] = (whRes.data ?? [])
    .filter((w) => { const k = (w.kind as string) ?? ""; return k !== "damage" && k !== "material"; })
    .sort((a, b) => kindRank((a.kind as string) ?? "") - kindRank((b.kind as string) ?? "") || String(a.name).localeCompare(String(b.name)))
    .map((w) => ({ id: w.id as string, name: (w.name as string) ?? "—", kind: (w.kind as string) ?? "warehouse" }));
  const locIds = new Set(locations.map((l) => l.id));

  // qty available per (variant, warehouse)
  const cell = new Map<string, number>();
  (balRes.data ?? []).forEach((b) => {
    if ((b.stock_status as string) !== "available") return;
    const wh = b.warehouse_id as string;
    if (!locIds.has(wh)) return;
    const q = Number(b.qty_on_hand) || 0;
    if (q <= 0) return;
    cell.set(`${b.variant_id}|${wh}`, (cell.get(`${b.variant_id}|${wh}`) ?? 0) + q);
  });

  const items: PosItem[] = (varRes.data ?? []).map((v) => {
    const vid = v.id as string;
    const sku = (v.sku as string) ?? "";
    const p = prodById.get((v.product_id as string) ?? "");
    const c = costing.get(sku);
    const retail = Math.max(c?.retail ?? 0, Number(v.retail_price) || 0);
    const stock: Record<string, number> = {};
    for (const l of locations) { const q = cell.get(`${vid}|${l.id}`) ?? 0; if (q > 0) stock[l.id] = q; }
    return {
      variantId: vid, sku, size: (v.size as string | null) ?? "",
      productName: (p?.name as string) ?? sku,
      brandId: (p?.brand_id as string | null) ?? "",
      brandName: brandName.get((p?.brand_id as string | null) ?? "") ?? "—",
      image: (p?.catalog_image_url as string | null) ?? null,
      retail, cogm: c?.cogm ?? 0, stock,
    };
  }).filter((it) => Object.keys(it.stock).length > 0);

  return { locations, items, canEdit: canAct(role, "sales_penjualan") };
}

export default async function POSPage() {
  const { locations, items, canEdit } = await getData();
  return (
    <div className="mx-auto max-w-7xl">
      <POSView locations={locations} items={items} canEdit={canEdit} />
    </div>
  );
}
