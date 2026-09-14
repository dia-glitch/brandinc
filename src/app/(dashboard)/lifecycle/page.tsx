import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getRole } from "@/lib/roles";
import { canAct } from "@/lib/permissions";
import { getSkuCosting } from "@/lib/costing";
import { LifecycleView, type LifeRow } from "./lifecycle-view";

const DAY = 86_400_000;

function bucketOf(ageDays: number | null): LifeRow["bucket"] {
  if (ageDays === null) return "unset";
  if (ageDays < 0) return "pre";
  if (ageDays <= 30) return "b0";
  if (ageDays <= 60) return "b30";
  if (ageDays <= 90) return "b60";
  return "b90";
}

async function getData(): Promise<{ rows: LifeRow[] }> {
  if (!isSupabaseConfigured()) return { rows: [] };
  const supabase = createClient();
  const [prodRes, varRes, brandRes, balRes, mvRes, rLineRes, costing] = await Promise.all([
    supabase.from("products").select("id,name,brand_id,style_code,launch_date").is("deleted_at", null),
    supabase.from("product_variants").select("id,product_id,sku").is("deleted_at", null),
    supabase.from("brands").select("id,name").is("deleted_at", null),
    supabase.from("stock_balances").select("variant_id,qty_on_hand").eq("stock_status", "available").is("deleted_at", null),
    supabase.from("inventory_movements").select("variant_id,movement_type,qty").is("deleted_at", null),
    supabase.from("fg_receipt_lines").select("variant_id,qty_good").is("deleted_at", null),
    getSkuCosting(supabase),
  ]);

  const brands = brandRes.data ?? [];
  const brandName = (id: string | null | undefined) => brands.find((b) => b.id === id)?.name ?? "—";
  const variants = varRes.data ?? [];
  const prodByVar = new Map<string, string>(); // variant_id -> product_id
  const skuByVar = new Map<string, string>();
  variants.forEach((v) => { prodByVar.set(v.id as string, v.product_id as string); skuByVar.set(v.id as string, (v.sku as string) ?? ""); });

  // Sisa qty & nilai (available/good) per produk.
  const qtyByProd = new Map<string, number>();
  const valByProd = new Map<string, number>();
  (balRes.data ?? []).forEach((b) => {
    const pid = prodByVar.get(b.variant_id as string); if (!pid) return;
    const q = Number(b.qty_on_hand) || 0; if (q === 0) return;
    const sku = skuByVar.get(b.variant_id as string) ?? "";
    const cogm = costing.get(sku)?.cogm ?? 0;
    qtyByProd.set(pid, (qtyByProd.get(pid) ?? 0) + q);
    valByProd.set(pid, (valByProd.get(pid) ?? 0) + q * cogm);
  });

  // Total terjual (net = sale − return) per produk → pembilang sell-through.
  const soldByProd = new Map<string, number>();
  (mvRes.data ?? []).forEach((m) => {
    const pid = prodByVar.get(m.variant_id as string); if (!pid) return;
    const type = (m.movement_type as string) ?? "";
    const q = Math.abs(Number(m.qty) || 0);
    if (type === "sale") soldByProd.set(pid, (soldByProd.get(pid) ?? 0) + q);
    else if (type === "return") soldByProd.set(pid, (soldByProd.get(pid) ?? 0) - q);
  });

  // Total masuk (good) dari Incoming per produk → penyebut sell-through.
  const recvByProd = new Map<string, number>();
  (rLineRes.data ?? []).forEach((l) => {
    const pid = prodByVar.get(l.variant_id as string); if (!pid) return;
    recvByProd.set(pid, (recvByProd.get(pid) ?? 0) + (Number(l.qty_good) || 0));
  });

  const today = Date.now();
  const rows: LifeRow[] = (prodRes.data ?? []).map((p) => {
    const pid = p.id as string;
    const launch = (p.launch_date as string | null) ?? null;
    const ageDays = launch ? Math.floor((today - new Date(launch + "T00:00:00").getTime()) / DAY) : null;
    const recv = recvByProd.get(pid) ?? 0;
    const sold = Math.max(0, soldByProd.get(pid) ?? 0);
    const sellThrough = recv > 0 ? Math.min(1, sold / recv) : null;
    return {
      id: pid,
      parentSku: (p.style_code as string) ?? "—",
      product: (p.name as string) ?? "—",
      brand: brandName(p.brand_id as string | null),
      launchDate: launch,
      ageDays,
      bucket: bucketOf(ageDays),
      sellThrough,
      received: recv,
      qty: qtyByProd.get(pid) ?? 0,
      value: Math.round(valByProd.get(pid) ?? 0),
    };
  })
    // urut: yang punya stok mengendap paling tua dulu, lalu nilai terbesar.
    .sort((a, b) => (b.ageDays ?? -1) - (a.ageDays ?? -1) || b.value - a.value);

  return { rows };
}

export default async function LifecyclePage() {
  const { rows } = await getData();
  let canEdit = true;
  if (isSupabaseConfigured()) canEdit = canAct(await getRole(createClient()), "product_lifecycle");
  return <LifecycleView rows={rows} canEdit={canEdit} />;
}
