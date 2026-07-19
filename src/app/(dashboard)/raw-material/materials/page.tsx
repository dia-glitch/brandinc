import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getRole } from "@/lib/roles";
import { canAct } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { MaterialDialog, type MaterialData } from "./material-dialog";
import { CategoryManager, type MaterialCategory } from "./category-manager";

type Brand = { id: string; name: string };

async function getData(): Promise<{ materials: MaterialData[]; categories: MaterialCategory[]; brands: Brand[] }> {
  if (!isSupabaseConfigured()) return { materials: [], categories: [], brands: [] };
  const supabase = createClient();
  const [matRes, catRes, brandRes] = await Promise.all([
    supabase.from("materials").select("id,code,name,brand_id,category_id,unit,is_active").is("deleted_at", null).order("name"),
    supabase.from("material_categories").select("id,name,code").is("deleted_at", null).order("name"),
    supabase.from("brands").select("id,name").order("name"),
  ]);
  return {
    materials: (matRes.data ?? []) as MaterialData[],
    categories: (catRes.data ?? []) as MaterialCategory[],
    brands: (brandRes.data ?? []) as Brand[],
  };
}

export default async function MaterialsPage() {
  const { materials, categories, brands } = await getData();
  let canEdit = true;
  if (isSupabaseConfigured()) canEdit = canAct(await getRole(createClient()), "rm_create");
  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "—";
  const brandName = (id: string | null) => brands.find((b) => b.id === id)?.name ?? "—";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Raw Material</p>
          <h1 className="text-2xl font-extrabold">Material</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">{materials.length} material terdaftar.</p>
        </div>
        <div className="flex gap-2.5">
          <CategoryManager categories={categories} canEdit={canEdit} />
          <MaterialDialog categories={categories} brands={brands} canEdit={canEdit} />
        </div>
      </div>

      {materials.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="font-bold">Belum ada material</p>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            Pastikan tabel <code>materials</code> &amp; <code>material_categories</code> sudah disiapkan, lalu klik &quot;Material Baru&quot;.
          </p>
        </div>
      ) : (
        <div className="card p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3">Kode</th>
                <th className="px-5 py-3">Nama</th>
                <th className="px-5 py-3">Brand</th>
                <th className="px-5 py-3">Kategori</th>
                <th className="px-5 py-3">Satuan</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => (
                <tr key={m.id} className="border-t border-border font-semibold hover:bg-muted/50">
                  <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{m.code}</td>
                  <td className="px-5 py-3">{m.name}</td>
                  <td className="px-5 py-3 font-medium text-muted-foreground">{brandName(m.brand_id)}</td>
                  <td className="px-5 py-3 font-medium text-muted-foreground">{catName(m.category_id)}</td>
                  <td className="px-5 py-3 font-medium text-muted-foreground">{m.unit ?? "—"}</td>
                  <td className="px-5 py-3">{m.is_active ? <Badge tone="success">Aktif</Badge> : <Badge tone="neutral">Nonaktif</Badge>}</td>
                  <td className="px-5 py-3 text-right"><MaterialDialog material={m} categories={categories} brands={brands} canEdit={canEdit} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs font-medium text-muted-foreground">
        Material dipakai untuk BOM &amp; Material Issue (pengeluaran bahan ke produksi/vendor).
      </p>
    </div>
  );
}
