import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { LogView, type LogRow, type Opt } from "./log-view";

async function getData(): Promise<{ rows: LogRow[]; warehouses: Opt[] }> {
  if (!isSupabaseConfigured()) return { rows: [], warehouses: [] };
  const supabase = createClient();
  const [mvRes, varRes, prodRes, brandRes, whRes] = await Promise.all([
    supabase.from("inventory_movements")
      .select("id,created_at,variant_id,warehouse_id,stock_status,movement_type,qty,unit_cost,source_doc_type,note")
      .is("deleted_at", null).order("created_at", { ascending: false }).limit(2000),
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

  const rows: LogRow[] = (mvRes.data ?? []).map((m) => {
    const v = vInfo(m.variant_id as string);
    return {
      id: m.id as string,
      date: (typeof m.created_at === "string" ? m.created_at : "").slice(0, 19).replace("T", " "),
      sku: (v?.sku as string | undefined) ?? "—",
      product: pName(v?.product_id as string | undefined),
      brand: bName(v?.product_id as string | undefined),
      warehouse: whName(m.warehouse_id as string | null),
      status: (m.stock_status as string) ?? "available",
      type: (m.movement_type as string) ?? "",
      source: (m.source_doc_type as string | null) ?? "",
      qty: Number(m.qty) || 0,
      unitCost: Number(m.unit_cost) || 0,
      note: (m.note as string | null) ?? "",
    };
  });

  const warehouses: Opt[] = whs.map((w) => ({ id: w.id as string, name: w.name as string }));
  return { rows, warehouses };
}

export default async function InventoryLogPage() {
  const { rows, warehouses } = await getData();
  return (
    <div className="mx-auto max-w-7xl">
      <LogView rows={rows} warehouses={warehouses} />
    </div>
  );
}
