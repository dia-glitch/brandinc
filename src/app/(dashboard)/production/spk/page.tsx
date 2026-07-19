import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { SPKForm, type BrandOpt, type ProductOpt, type SupplierOpt } from "./spk-form";
import { SPKList, type SPKRow } from "./spk-list";

async function getData() {
  if (!isSupabaseConfigured()) {
    return { rows: [] as SPKRow[], brands: [] as BrandOpt[], products: [] as ProductOpt[], suppliers: [] as SupplierOpt[] };
  }
  const supabase = createClient();
  const [spkRes, lineRes, brandRes, prodRes, varRes, supRes, sizeRes, specRes] = await Promise.all([
    supabase.from("work_orders").select("id,code,spk_date,due_delivery,brand_id,supplier_id,supplier_type,merchandiser,button_accessories,care_label,vendor_comment,image_url,status,notes").is("deleted_at", null).order("code", { ascending: false }),
    supabase.from("work_order_lines").select("id,spk_id,sku,size,product_name,ratio,qty").is("deleted_at", null),
    supabase.from("brands").select("id,name,code").is("deleted_at", null).order("name"),
    supabase.from("products").select("id,name,brand_id,status").is("deleted_at", null).order("style_code"),
    supabase.from("product_variants").select("id,product_id,sku,size,size_id").is("deleted_at", null),
    supabase.from("suppliers").select("id,name").is("deleted_at", null).order("name"),
    supabase.from("sizes").select("id,sort_order").is("deleted_at", null),
    supabase.from("work_order_specs").select("id,spk_id,name,type,values,sort_order").is("deleted_at", null).order("sort_order"),
  ]);

  // Peta urutan ukuran (ikut sort_order master, bukan alfabet).
  const sizeSort = new Map<string, number>();
  (sizeRes.data ?? []).forEach((s) => sizeSort.set(s.id as string, (s.sort_order as number) ?? 9999));

  const brands = (brandRes.data ?? []).map((b) => ({ id: b.id as string, name: b.name as string, code: (b.code as string) ?? "" }));
  const suppliers = (supRes.data ?? []).map((s) => ({ id: s.id as string, name: s.name as string }));
  const brandName = (id: string) => brands.find((b) => b.id === id)?.name ?? "—";
  const supplierName = (id: string | null) => suppliers.find((s) => s.id === id)?.name ?? "—";
  const lines = lineRes.data ?? [];
  const variants = varRes.data ?? [];

  const rows: SPKRow[] = (spkRes.data ?? []).map((s) => ({
    id: s.id as string,
    code: s.code as string,
    spk_date: (s.spk_date as string | null) ?? null,
    due_delivery: (s.due_delivery as string | null) ?? null,
    brand_name: brandName(s.brand_id as string),
    supplier_name: supplierName((s.supplier_id as string | null) ?? null),
    supplier_type: (s.supplier_type as string | null) ?? null,
    merchandiser: (s.merchandiser as string | null) ?? null,
    button_accessories: (s.button_accessories as string | null) ?? null,
    care_label: (s.care_label as string | null) ?? null,
    vendor_comment: (s.vendor_comment as string | null) ?? null,
    image_url: (s.image_url as string | null) ?? null,
    status: (s.status as string) ?? "open",
    notes: (s.notes as string | null) ?? null,
    specs: (specRes.data ?? []).filter((sp) => sp.spk_id === s.id).map((sp) => ({
      name: (sp.name as string | null) ?? null,
      type: (sp.type as string | null) ?? null,
      values: (sp.values as Record<string, number> | null) ?? null,
    })),
    lines: lines.filter((l) => l.spk_id === s.id).map((l) => ({
      id: l.id as string,
      sku: (l.sku as string | null) ?? null,
      size: (l.size as string | null) ?? null,
      product_name: (l.product_name as string | null) ?? null,
      ratio: (l.ratio as number | null) ?? null,
      qty: (l.qty as string | number) ?? 0,
    })),
  }));

  // Untuk form: produk aktif + varian-nya.
  const products: ProductOpt[] = (prodRes.data ?? [])
    .filter((p) => (p.status as string) !== "cancelled")
    .map((p) => ({
      id: p.id as string,
      name: p.name as string,
      brand_id: p.brand_id as string,
      variants: variants
        .filter((v) => v.product_id === p.id)
        .sort((a, b) => (sizeSort.get((a.size_id as string) ?? "") ?? 9999) - (sizeSort.get((b.size_id as string) ?? "") ?? 9999))
        .map((v) => ({ id: v.id as string, sku: v.sku as string, size: (v.size as string | null) ?? null, size_id: (v.size_id as string | null) ?? null })),
    }));

  return { rows, brands, products, suppliers };
}

export default async function SPKPage() {
  const { rows, brands, products, suppliers } = await getData();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Produksi</p>
          <h1 className="text-2xl font-extrabold">SPK — Surat Perintah Kerja</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            {rows.length} SPK. Kode otomatis SPK-KodeBrand-NoUrut (mis. SPK-BRE-001) — jadi acuan sampai penerimaan &amp; finance.
          </p>
        </div>
        <SPKForm brands={brands} products={products} suppliers={suppliers} />
      </div>

      {rows.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="font-bold">Belum ada SPK</p>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            Klik &quot;Buat SPK&quot;: pilih Brand → tambah produk &amp; jumlah per ukuran. Kode SPK dibuat otomatis.
          </p>
        </div>
      ) : (
        <SPKList rows={rows} />
      )}
    </div>
  );
}
