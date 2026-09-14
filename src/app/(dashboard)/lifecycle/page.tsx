import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getRole } from "@/lib/roles";
import { canAct } from "@/lib/permissions";
import { getSkuCosting } from "@/lib/costing";
import { LifecycleView, type LifeRow, type SkuRow, type BrandOpt } from "./lifecycle-view";

const DAY = 86_400_000;
type Bucket = LifeRow["bucket"];

function bucketOf(ageDays: number | null): Bucket {
  if (ageDays === null) return "unset";
  if (ageDays < 0) return "pre";
  if (ageDays <= 30) return "b0";
  if (ageDays <= 60) return "b30";
  if (ageDays <= 90) return "b60";
  return "b90";
}

async function getData(): Promise<{ rows: LifeRow[]; skuRows: SkuRow[]; brands: BrandOpt[] }> {
  if (!isSupabaseConfigured()) return { rows: [], skuRows: [], brands: [] };
  const supabase = createClient();
  const [prodRes, varRes, brandRes, balRes, mvRes, rLineRes, costing] = await Promise.all([
    supabase.from("products").select("id,name,brand_id,style_code,launch_date").is("deleted_at", null),
    supabase.from("product_variants").select("id,product_id,sku,size").is("deleted_at", null),
    supabase.from("brands").select("id,name").is("deleted_at", null).order("name"),
    supabase.from("stock_balances").select("variant_id,qty_on_hand").eq("stock_status", "available").is("deleted_at", null),
    supabase.from("inventory_movements").select("variant_id,movement_type,qty").is("deleted_at", null),
    supabase.from("fg_receipt_lines").select("variant_id,qty_good").is("deleted_at", null),
    getSkuCosting(supabase),
  ]);

  const brandsData = brandRes.data ?? [];
  const brandName = (id: string | null | undefined) => brandsData.find((b) => b.id === id)?.name ?? "—";
  const brands: BrandOpt[] = brandsData.map((b) => ({ id: b.id as string, name: (b.name as string) ?? "—" }));

  const products = prodRes.data ?? [];
  const prodById = new Map<string, (typeof products)[number]>();
  products.forEach((p) => prodById.set(p.id as string, p));

  const variants = varRes.data ?? [];
  const prodByVar = new Map<string, string>();
  const skuByVar = new Map<string, string>();
  variants.forEach((v) => { prodByVar.set(v.id as string, v.product_id as string); skuByVar.set(v.id as string, (v.sku as string) ?? ""); });

  // ---- Agregasi per VARIAN (untuk level SKU) ----
  const qtyByVar = new Map<string, number>();
  const valByVar = new Map<string, number>();
  (balRes.data ?? []).forEach((b) => {
    const q = Number(b.qty_on_hand) || 0; if (q === 0) return;
    const vid = b.variant_id as string;
    const sku = skuByVar.get(vid) ?? "";
    const cogm = costing.get(sku)?.cogm ?? 0;
    qtyByVar.set(vid, (qtyByVar.get(vid) ?? 0) + q);
    valByVar.set(vid, (valByVar.get(vid) ?? 0) + q * cogm);
  });
  const soldByVar = new Map<string, number>();
  (mvRes.data ?? []).forEach((m) => {
    const vid = m.variant_id as string;
    const type = (m.movement_type as string) ?? "";
    const q = Math.abs(Number(m.qty) || 0);
    if (type === "sale") soldByVar.set(vid, (soldByVar.get(vid) ?? 0) + q);
    else if (type === "return") soldByVar.set(vid, (soldByVar.get(vid) ?? 0) - q);
  });
  const recvByVar = new Map<string, number>();
  (rLineRes.data ?? []).forEach((l) => {
    const vid = l.variant_id as string;
    recvByVar.set(vid, (recvByVar.get(vid) ?? 0) + (Number(l.qty_good) || 0));
  });

  // ---- Agregasi per PRODUK (roll-up dari varian) ----
  const qtyByProd = new Map<string, number>();
  const valByProd = new Map<string, number>();
  const soldByProd = new Map<string, number>();
  const recvByProd = new Map<string, number>();
  const addProd = (m: Map<string, number>, pid: string | undefined, v: number) => { if (pid) m.set(pid, (m.get(pid) ?? 0) + v); };
  variants.forEach((vr) => {
    const vid = vr.id as string; const pid = vr.product_id as string;
    addProd(qtyByProd, pid, qtyByVar.get(vid) ?? 0);
    addProd(valByProd, pid, valByVar.get(vid) ?? 0);
    addProd(soldByProd, pid, soldByVar.get(vid) ?? 0);
    addProd(recvByProd, pid, recvByVar.get(vid) ?? 0);
  });

  const today = Date.now();
  const ageOf = (launch: string | null) => launch ? Math.floor((today - new Date(launch + "T00:00:00").getTime()) / DAY) : null;

  const rows: LifeRow[] = products.map((p) => {
    const pid = p.id as string;
    const launch = (p.launch_date as string | null) ?? null;
    const ageDays = ageOf(launch);
    const recv = recvByProd.get(pid) ?? 0;
    const sold = Math.max(0, soldByProd.get(pid) ?? 0);
    return {
      id: pid,
      parentSku: (p.style_code as string) ?? "—",
      product: (p.name as string) ?? "—",
      brand: brandName(p.brand_id as string | null),
      brandId: (p.brand_id as string | null) ?? null,
      launchDate: launch,
      ageDays,
      bucket: bucketOf(ageDays),
      sellThrough: recv > 0 ? Math.min(1, sold / recv) : null,
      received: recv,
      qty: qtyByProd.get(pid) ?? 0,
      value: Math.round(valByProd.get(pid) ?? 0),
    };
  }).sort((a, b) => (b.ageDays ?? -1) - (a.ageDays ?? -1) || b.value - a.value);

  const skuRows: SkuRow[] = variants.map((v) => {
    const vid = v.id as string;
    const p = prodById.get(v.product_id as string);
    const launch = (p?.launch_date as string | null) ?? null;
    const ageDays = ageOf(launch);
    const recv = recvByVar.get(vid) ?? 0;
    const sold = Math.max(0, soldByVar.get(vid) ?? 0);
    return {
      id: vid,
      parentSku: (p?.style_code as string) ?? "—",
      sku: (v.sku as string) ?? "—",
      size: (v.size as string | null) ?? "—",
      product: (p?.name as string) ?? "—",
      brand: brandName(p?.brand_id as string | null),
      brandId: (p?.brand_id as string | null) ?? null,
      launchDate: launch,
      ageDays,
      bucket: bucketOf(ageDays),
      sellThrough: recv > 0 ? Math.min(1, sold / recv) : null,
      received: recv,
      qty: qtyByVar.get(vid) ?? 0,
      value: Math.round(valByVar.get(vid) ?? 0),
    };
  }).sort((a, b) => (b.ageDays ?? -1) - (a.ageDays ?? -1) || b.value - a.value);

  return { rows, skuRows, brands };
}

export default async function LifecyclePage() {
  const { rows, skuRows, brands } = await getData();
  let canEdit = true;
  if (isSupabaseConfigured()) canEdit = canAct(await getRole(createClient()), "product_lifecycle");
  return <LifecycleView rows={rows} skuRows={skuRows} brands={brands} canEdit={canEdit} />;
}
