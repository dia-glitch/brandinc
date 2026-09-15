import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getRole } from "@/lib/roles";
import { canAct } from "@/lib/permissions";
import { getSkuCosting } from "@/lib/costing";
import { POSView, type PosItem, type PosLoc, type RecapRow } from "./pos-view";

async function getData(): Promise<{ locations: PosLoc[]; items: PosItem[]; recap: RecapRow[]; canEdit: boolean }> {
  if (!isSupabaseConfigured()) return { locations: [], items: [], recap: [], canEdit: false };
  const supabase = createClient();
  const [balRes, whRes, varRes, prodRes, brandRes, soRes, soLineRes, costing, role] = await Promise.all([
    supabase.from("stock_balances").select("variant_id,warehouse_id,qty_on_hand,stock_status").is("deleted_at", null),
    supabase.from("warehouses").select("id,name,kind").is("deleted_at", null).order("name"),
    supabase.from("product_variants").select("id,sku,size,product_id,retail_price").is("deleted_at", null),
    supabase.from("products").select("id,name,brand_id,style_code,catalog_image_url").is("deleted_at", null),
    supabase.from("brands").select("id,name").is("deleted_at", null),
    supabase.from("sales_orders").select("id,code,brand_id,order_date,notes,customer").eq("settlement", "cash").is("deleted_at", null).order("created_at", { ascending: false }).limit(500),
    supabase.from("sales_order_lines").select("order_id,qty,price").is("deleted_at", null),
    getSkuCosting(supabase),
    getRole(supabase),
  ]);

  const brandName = new Map((brandRes.data ?? []).map((b) => [b.id as string, (b.name as string) ?? "—"]));
  const prodById = new Map((prodRes.data ?? []).map((p) => [p.id as string, p]));

  const kindRank = (k: string) => (k === "store" ? 0 : k === "warehouse" ? 1 : 9);
  const locations: PosLoc[] = (whRes.data ?? [])
    .filter((w) => { const k = (w.kind as string) ?? ""; return k !== "damage" && k !== "material"; })
    .sort((a, b) => kindRank((a.kind as string) ?? "") - kindRank((b.kind as string) ?? "") || String(a.name).localeCompare(String(b.name)))
    .map((w) => ({ id: w.id as string, name: (w.name as string) ?? "—", kind: (w.kind as string) ?? "warehouse" }));
  const locIds = new Set(locations.map((l) => l.id));

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

  // Rekap kasir: total per order (qty*price) + parse metode/lokasi dari notes.
  const totalByOrder = new Map<string, number>();
  (soLineRes.data ?? []).forEach((l) => {
    const oid = l.order_id as string;
    totalByOrder.set(oid, (totalByOrder.get(oid) ?? 0) + (Number(l.qty) || 0) * (Number(l.price) || 0));
  });
  const recap: RecapRow[] = (soRes.data ?? []).map((o) => {
    const parts = ((o.notes as string | null) ?? "").split(" · ");
    return {
      code: o.code as string,
      date: ((o.order_date as string | null) ?? "").slice(0, 10),
      brand: brandName.get((o.brand_id as string | null) ?? "") ?? "—",
      customer: (o.customer as string | null) ?? "",
      method: parts[1] ?? "—",
      location: parts[2] ?? "—",
      total: totalByOrder.get(o.id as string) ?? 0,
    };
  });

  return { locations, items, recap, canEdit: canAct(role, "sales_penjualan") };
}

export default async function POSPage() {
  const { locations, items, recap, canEdit } = await getData();
  return (
    <div className="mx-auto max-w-7xl">
      <POSView locations={locations} items={items} recap={recap} canEdit={canEdit} />
    </div>
  );
}
