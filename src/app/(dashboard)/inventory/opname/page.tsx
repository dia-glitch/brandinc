import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getRole } from "@/lib/roles";
import { canAct } from "@/lib/permissions";
import { OpnameView, type OpnameRow, type Opt } from "./opname-view";

async function getData(): Promise<{ rows: OpnameRow[]; warehouses: Opt[] }> {
  if (!isSupabaseConfigured()) return { rows: [], warehouses: [] };
  const supabase = createClient();
  const [balRes, varRes, prodRes, brandRes, whRes] = await Promise.all([
    supabase.from("stock_balances").select("variant_id,warehouse_id,stock_status,qty_on_hand,moving_avg_cost").is("deleted_at", null),
    supabase.from("product_variants").select("id,product_id,sku").is("deleted_at", null),
    supabase.from("products").select("id,name,brand_id").is("deleted_at", null),
    supabase.from("brands").select("id,name").is("deleted_at", null),
    supabase.from("warehouses").select("id,name").is("deleted_at", null).order("name"),
  ]);
  const variants = varRes.data ?? [];
  const products = prodRes.data ?? [];
  const brands = brandRes.data ?? [];
  const whs = whRes.data ?? [];
  const vInfo = (id: string) => variants.find((v) => v.id === id);
  const pName = (pid: string | null | undefined) => products.find((p) => p.id === pid)?.name ?? "—";
  const bName = (pid: string | null | undefined) => { const p = products.find((x) => x.id === pid); return brands.find((b) => b.id === (p?.brand_id ?? null))?.name ?? "—"; };
  const whName = (id: string | null | undefined) => whs.find((w) => w.id === id)?.name ?? "—";

  const rows: OpnameRow[] = (balRes.data ?? [])
    .map((b) => {
      const v = vInfo(b.variant_id as string);
      return {
        variantId: b.variant_id as string, warehouseId: b.warehouse_id as string, stockStatus: (b.stock_status as string) ?? "available",
        sku: (v?.sku as string | undefined) ?? "—", product: pName(v?.product_id as string | undefined), brand: bName(v?.product_id as string | undefined),
        warehouse: whName(b.warehouse_id as string | null), qtySystem: Number(b.qty_on_hand) || 0, avgCost: Number(b.moving_avg_cost) || 0,
      };
    })
    .filter((r) => r.sku !== "—")
    .sort((a, b) => a.warehouse.localeCompare(b.warehouse) || a.sku.localeCompare(b.sku));

  const warehouses: Opt[] = whs.map((w) => ({ id: w.id as string, name: w.name as string }));
  return { rows, warehouses };
}

export default async function StockOpnamePage() {
  const { rows, warehouses } = await getData();
  let canEdit = true;
  if (isSupabaseConfigured()) canEdit = canAct(await getRole(createClient()), "inventory");
  return (
    <div className="mx-auto max-w-7xl">
      <OpnameView rows={rows} warehouses={warehouses} canEdit={canEdit} />
    </div>
  );
}
