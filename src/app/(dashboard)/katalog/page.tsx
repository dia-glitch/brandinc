import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getRole } from "@/lib/roles";
import { canAct } from "@/lib/permissions";
import { KatalogView, type KatalogBrand } from "./katalog-view";

const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "3XL", "4XL", "ALL", "F", "ONE"];
function sortSizes(a: string, b: string) {
  const ia = SIZE_ORDER.indexOf(a.toUpperCase()); const ib = SIZE_ORDER.indexOf(b.toUpperCase());
  if (ia === -1 && ib === -1) return a.localeCompare(b);
  if (ia === -1) return 1; if (ib === -1) return -1; return ia - ib;
}

async function getData(): Promise<{ brands: KatalogBrand[] }> {
  if (!isSupabaseConfigured()) return { brands: [] };
  const supabase = createClient();
  const [brandRes, prodRes, varRes] = await Promise.all([
    supabase.from("brands").select("id,name").is("deleted_at", null).order("name"),
    supabase.from("products").select("id,name,brand_id,style_code,retail_price,catalog_image_url").is("deleted_at", null),
    supabase.from("product_variants").select("product_id,size").is("deleted_at", null),
  ]);

  const sizesByProd = new Map<string, Set<string>>();
  (varRes.data ?? []).forEach((v) => {
    const pid = v.product_id as string; const sz = (v.size as string | null) ?? "";
    if (!sz) return;
    if (!sizesByProd.has(pid)) sizesByProd.set(pid, new Set());
    sizesByProd.get(pid)!.add(sz);
  });

  const brands = brandRes.data ?? [];
  const products = (prodRes.data ?? []).map((p) => ({
    id: p.id as string,
    brandId: (p.brand_id as string | null) ?? null,
    code: (p.style_code as string) ?? "—",
    name: (p.name as string) ?? "—",
    retail: Number(p.retail_price) || 0,
    image: (p.catalog_image_url as string | null) ?? null,
    sizes: Array.from(sizesByProd.get(p.id as string) ?? []).sort(sortSizes),
  }));

  const out: KatalogBrand[] = brands
    .map((b) => ({
      id: b.id as string,
      name: (b.name as string) ?? "—",
      products: products.filter((p) => p.brandId === b.id).sort((a, c) => a.code.localeCompare(c.code)),
    }))
    .filter((b) => b.products.length > 0);

  return { brands: out };
}

export default async function KatalogPage() {
  const { brands } = await getData();
  let canEdit = true;
  if (isSupabaseConfigured()) canEdit = canAct(await getRole(createClient()), "catalog");
  return <KatalogView brands={brands} canEdit={canEdit} />;
}
