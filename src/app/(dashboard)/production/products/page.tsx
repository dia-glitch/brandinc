import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getRole } from "@/lib/roles";
import { canAct } from "@/lib/permissions";
import { ProductForm } from "./product-form";
import { ProductList, type ProductRow } from "./product-list";

async function getData() {
  if (!isSupabaseConfigured()) {
    return { products: [] as ProductRow[], brands: [], catParents: [], catSubs: [], colorParents: [], colorSubs: [], sizes: [] };
  }
  const supabase = createClient();
  const [prodRes, varRes, brandRes, catRes, colorRes, sizeRes] = await Promise.all([
    supabase.from("products").select("id,style_code,name,brand_id,category_id,color_id,color,status").is("deleted_at", null).order("style_code"),
    supabase.from("product_variants").select("id,product_id,sku,size,size_id,retail_price").is("deleted_at", null),
    supabase.from("brands").select("id,name,code").is("deleted_at", null).order("name"),
    supabase.from("categories").select("id,name,code,parent_id").is("deleted_at", null).order("name"),
    supabase.from("colors").select("id,name,parent_id").is("deleted_at", null).order("name"),
    supabase.from("sizes").select("id,name,sort_order").is("deleted_at", null).order("sort_order"),
  ]);

  const brands = brandRes.data ?? [];
  const allCats = catRes.data ?? [];
  const allColors = colorRes.data ?? [];
  const sizes = (sizeRes.data ?? []).map((s) => ({ id: s.id as string, name: s.name as string }));
  const variants = varRes.data ?? [];

  const brandName = (id: string) => brands.find((b) => b.id === id)?.name ?? "—";
  const catName = (id: string | null) => allCats.find((c) => c.id === id)?.name ?? "—";

  const products: ProductRow[] = (prodRes.data ?? []).map((p) => ({
    id: p.id as string,
    style_code: p.style_code as string,
    name: p.name as string,
    brand_id: p.brand_id as string,
    brand_name: brandName(p.brand_id as string),
    category_name: catName(p.category_id as string | null),
    color_id: (p.color_id as string | null) ?? null,
    color: (p.color as string | null) ?? null,
    status: (p.status as string) ?? "active",
    variants: variants
      .filter((v) => v.product_id === p.id)
      .map((v) => ({
        id: v.id as string,
        sku: v.sku as string,
        size: (v.size as string | null) ?? null,
        size_id: (v.size_id as string | null) ?? null,
      })),
  }));

  // Untuk form: pilihan bertingkat (LV1 -> LV2).
  const catParents = allCats
    .filter((c) => !c.parent_id)
    .map((c) => ({ id: c.id as string, name: c.name as string }));
  const catSubs = allCats
    .filter((c) => c.parent_id)
    .map((c) => ({ id: c.id as string, name: c.name as string, code: (c.code as string) ?? "", parentId: c.parent_id as string }));
  const colorParents = allColors
    .filter((c) => !c.parent_id)
    .map((c) => ({ id: c.id as string, name: c.name as string }));
  const colorSubs = allColors
    .filter((c) => c.parent_id)
    .map((c) => ({ id: c.id as string, name: c.name as string, parentId: c.parent_id as string }));

  return {
    products,
    brands: brands.map((b) => ({ id: b.id as string, name: b.name as string, code: (b.code as string) ?? "" })),
    catParents, catSubs, colorParents, colorSubs,
    sizes,
  };
}

export default async function ProductionProductsPage() {
  const { products, brands, catParents, catSubs, colorParents, colorSubs, sizes } = await getData();

  let canEdit = true;
  if (isSupabaseConfigured()) canEdit = canAct(await getRole(createClient()), "prod_product");

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Produksi</p>
          <h1 className="text-2xl font-extrabold">Produk &amp; SKU</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            {products.length} produk. SKU otomatis: KodeBrand-KodeKategori+No-Ukuran (mis. BRE-SH001-S).
          </p>
        </div>
        {canEdit && <ProductForm brands={brands} catParents={catParents} catSubs={catSubs} colorParents={colorParents} colorSubs={colorSubs} sizes={sizes} />}
      </div>

      {products.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="font-bold">Belum ada produk</p>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            Klik &quot;Produk Baru&quot;: pilih Brand → isi Nama → Kategori → Warna → Ukuran, SKU dibuat otomatis.
          </p>
        </div>
      ) : (
        <ProductList products={products} sizes={sizes} canEdit={canEdit} />
      )}

      <p className="text-xs font-medium text-muted-foreground">
        Produk/SKU dibuat di Produksi (bukan Master Data). Nama tercatat = Nama + Kategori LV2 + Warna LV2.
      </p>
    </div>
  );
}
