import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getRole } from "@/lib/roles";
import { canAct } from "@/lib/permissions";
import { ReturnView, type OrderOpt, type ReturnRow, type WarehouseOpt } from "./return-view";

async function getData() {
  if (!isSupabaseConfigured()) return { orders: [] as OrderOpt[], rows: [] as ReturnRow[], damageWarehouses: [] as WarehouseOpt[] };
  const supabase = createClient();
  const [soRes, soLineRes, brandRes, chanRes, whRes, srRes, srLineRes] = await Promise.all([
    supabase.from("sales_orders").select("id,code,brand_id,channel_id,settlement,order_date").is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("sales_order_lines").select("order_id,variant_id,warehouse_id,sku,size,product_name,qty,price,cogm").is("deleted_at", null),
    supabase.from("brands").select("id,name").is("deleted_at", null),
    supabase.from("sales_channels").select("id,name").is("deleted_at", null),
    supabase.from("warehouses").select("id,name,kind,brand_id").is("deleted_at", null),
    supabase.from("sales_returns").select("id,code,order_id,brand_id,channel_id,settlement,return_date,reason").is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("sales_return_lines").select("return_id,sku,size,product_name,qty,price,cogm,restock").is("deleted_at", null),
  ]);

  const brandName = (id: string | null) => (brandRes.data ?? []).find((b) => b.id === id)?.name ?? "—";
  const chanName = (id: string | null) => (chanRes.data ?? []).find((c) => c.id === id)?.name ?? "—";
  const soLines = soLineRes.data ?? [];

  const orders: OrderOpt[] = (soRes.data ?? []).map((o) => ({
    id: o.id as string, code: o.code as string, brandId: (o.brand_id as string | null) ?? null, brand: brandName((o.brand_id as string | null) ?? null),
    channelId: (o.channel_id as string | null) ?? null, settlement: (o.settlement as string) ?? "ar", date: (o.order_date as string | null) ?? null,
    lines: soLines.filter((l) => l.order_id === o.id).map((l) => ({
      variantId: (l.variant_id as string | null) ?? "", warehouseId: (l.warehouse_id as string | null) ?? "",
      sku: (l.sku as string | null) ?? "", size: (l.size as string | null) ?? "", productName: (l.product_name as string | null) ?? "",
      qty: Number(l.qty) || 0, price: Number(l.price) || 0, cogm: Number(l.cogm) || 0,
    })),
  }));

  const damageWarehouses: WarehouseOpt[] = (whRes.data ?? []).filter((w) => (w.kind as string) === "damage").map((w) => ({ id: w.id as string, name: w.name as string, brandId: (w.brand_id as string | null) ?? null }));

  const srLines = srLineRes.data ?? [];
  const orderCode = (id: string | null) => (soRes.data ?? []).find((o) => o.id === id)?.code ?? "—";
  const rows: ReturnRow[] = (srRes.data ?? []).map((r) => {
    const lines = srLines.filter((l) => l.return_id === r.id);
    const value = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
    const qty = lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);
    return {
      id: r.id as string, code: r.code as string, orderCode: orderCode((r.order_id as string | null) ?? null),
      brand: brandName((r.brand_id as string | null) ?? null), channel: chanName((r.channel_id as string | null) ?? null),
      date: (r.return_date as string | null) ?? null, reason: (r.reason as string | null) ?? "", qty, value,
      lines: lines.map((l) => ({ sku: (l.sku as string | null) ?? "", productName: (l.product_name as string | null) ?? "", size: (l.size as string | null) ?? "", qty: Number(l.qty) || 0, price: Number(l.price) || 0, restock: (l.restock as string) ?? "available" })),
    };
  });

  return { orders, rows, damageWarehouses };
}

export default async function SalesReturnPage() {
  const { orders, rows, damageWarehouses } = await getData();
  let canEdit = true;
  if (isSupabaseConfigured()) { const role = await getRole(createClient()); canEdit = canAct(role, "sales_penjualan"); }
  return (
    <div className="mx-auto max-w-7xl">
      <ReturnView orders={orders} rows={rows} damageWarehouses={damageWarehouses} canEdit={canEdit} />
    </div>
  );
}
