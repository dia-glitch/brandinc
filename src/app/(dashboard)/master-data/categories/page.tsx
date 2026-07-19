import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { CategoryDialog, type CategoryData } from "./category-dialog";
import { CategoryTree } from "./category-tree";

async function getCategories(): Promise<CategoryData[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id,code,name,parent_id,is_active")
    .is("deleted_at", null)
    .order("code");
  if (error) return [];
  return (data ?? []) as CategoryData[];
}

export default async function CategoriesPage() {
  const cats = await getCategories();
  const tops = cats.filter((c) => !c.parent_id);
  const parentsOpt = tops.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Master Data</p>
          <h1 className="text-2xl font-extrabold">Kategori</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            Struktur 2 tingkat: Kategori Utama → Sub-kategori. Klik baris untuk buka/tutup.
          </p>
        </div>
        <CategoryDialog parents={parentsOpt} />
      </div>

      {cats.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="font-bold">Belum ada kategori</p>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            Pastikan tabel <code>categories</code> sudah dibuat di database, lalu klik &quot;Kategori Baru&quot;.
          </p>
        </div>
      ) : (
        <CategoryTree categories={cats} parents={parentsOpt} />
      )}

      <p className="text-xs font-medium text-muted-foreground">
        Kategori &amp; sub-kategori tersimpan di tabel <code>categories</code> (pohon lewat <code>parent_id</code>).
      </p>
    </div>
  );
}
