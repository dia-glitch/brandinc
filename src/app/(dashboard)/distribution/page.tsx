import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getRole } from "@/lib/roles";
import { canAct } from "@/lib/permissions";
import { DistributionView, type TransferRow, type StockOpt, type WarehouseOpt } from "./distribution-view";

async function getData() {
  if (!isSupabaseConfigured()) return { rows: [] as TransferRow[], stock: [] as StockOpt[], warehouses: [] as WarehouseOpt[] };
  const supabase = createClient();
  const [tfRes, tfLineRes, balRes, varRes, prodRes, whRes, brandRes] = await Promise.all([
    supabase.from("stock_transfers").select("id,code,brand_id,from_warehouse_id,to_warehouse_id,transfer_date,notes,status,requested_by,packed_by,packed_at,completed_at").is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("stock_transfer_lines").select("id,transfer_id,variant_id,sku,size,product_name,qty,qty_packed,anomaly_note,unit_cost").is("deleted_at", null),
    supabase.from("stock_balances").select("variant_id,warehouse_id,qty_on_hand,moving_avg_cost").eq("stock_status", "available").is("deleted_at", null),
    supabase.from("product_variants").select("id,sku,size,product_id").is("deleted_at", null),
    supabase.from("products").select("id,name,brand_id").is("deleted_at", null),
    supabase.from("warehouses").select("id,name,kind,brand_id").is("deleted_at", null).order("name"),
    supabase.from("brands").select("id,name").is("deleted_at", null),
  ]);

  const brandName = (id: string | null) => (brandRes.data ?? []).find((b) => b.id === id)?.name ?? "—";
  const whName = (id: string | null) => (whRes.data ?? []).find((w) => w.id === id)?.name ?? "—";
  const variants = varRes.data ?? [];
  const products = prodRes.data ?? [];

  const tfLines = tfLineRes.data ?? [];
  const rows: TransferRow[] = (tfRes.data ?? []).map((t) => {
    const lines = tfLines.filter((l) => l.transfer_id === t.id);
    const rawStatus = (t.status as string | null) ?? "requested";
    const status = rawStatus === "done" ? "completed" : rawStatus; // normalisasi data lama
    return {
      id: t.id as string, code: t.code as string, brand: brandName((t.brand_id as string | null) ?? null),
      fromWarehouseId: (t.from_warehouse_id as string | null) ?? "",
      from: whName((t.from_warehouse_id as string | null) ?? null), to: whName((t.to_warehouse_id as string | null) ?? null),
      date: (t.transfer_date as string | null) ?? null, notes: (t.notes as string | null) ?? "",
      status, requestedBy: (t.requested_by as string | null) ?? "", packedBy: (t.packed_by as string | null) ?? "",
      packedAt: (t.packed_at as string | null) ?? null, completedAt: (t.completed_at as string | null) ?? null,
      qty: lines.reduce((s, l) => s + (Number(l.qty) || 0), 0),
      lines: lines.map((l) => ({
        lineId: l.id as string, variantId: (l.variant_id as string | null) ?? "",
        sku: (l.sku as string | null) ?? "", productName: (l.product_name as string | null) ?? "", size: (l.size as string | null) ?? "",
        qty: Number(l.qty) || 0, qtyPacked: l.qty_packed != null ? Number(l.qty_packed) || 0 : null,
        anomalyNote: (l.anomaly_note as string | null) ?? "", unitCost: Number(l.unit_cost) || 0,
      })),
    };
  });

  const stock: StockOpt[] = [];
  for (const b of balRes.data ?? []) {
    const qty = Number(b.qty_on_hand) || 0;
    if (qty <= 0) continue;
    const v = variants.find((x) => x.id === b.variant_id);
    if (!v) continue;
    const prod = products.find((p) => p.id === v.product_id);
    stock.push({
      variantId: v.id as string, warehouseId: b.warehouse_id as string, sku: (v.sku as string) ?? "", size: (v.size as string | null) ?? "",
      productName: (prod?.name as string | undefined) ?? (v.sku as string), brandId: (prod?.brand_id as string | null) ?? null,
      avail: qty, unitCost: Number(b.moving_avg_cost) || 0,
    });
  }

  const warehouses: WarehouseOpt[] = (whRes.data ?? []).map((w) => ({ id: w.id as string, name: w.name as string, kind: (w.kind as string) ?? "warehouse", brandId: (w.brand_id as string | null) ?? null }));
  return { rows, stock, warehouses };
}

export default async function DistributionPage() {
  const { rows, stock, warehouses } = await getData();
  let canSubmit = true, canProcess = true;
  if (isSupabaseConfigured()) {
    const role = await getRole(createClient());
    canSubmit = canAct(role, "dist_submit");
    canProcess = canAct(role, "dist_process");
  }
  return (
    <div className="mx-auto max-w-7xl">
      <DistributionView rows={rows} stock={stock} warehouses={warehouses} canSubmit={canSubmit} canProcess={canProcess} />
    </div>
  );
}
