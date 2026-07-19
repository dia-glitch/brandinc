import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { ColorDialog, type ColorData } from "./color-dialog";
import { ColorTree } from "./color-tree";

async function getColors(): Promise<ColorData[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("colors")
    .select("id,code,name,hex,parent_id,is_active")
    .is("deleted_at", null)
    .order("name");
  if (error) return [];
  return (data ?? []) as ColorData[];
}

export default async function ColorsPage() {
  const colors = await getColors();
  const tops = colors.filter((c) => !c.parent_id);
  const parentsOpt = tops.map((c) => ({ id: c.id, name: c.name }));
  const subCount = colors.length - tops.length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Master Data</p>
          <h1 className="text-2xl font-extrabold">Warna</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            {tops.length} parent colour · {subCount} sub colour. Saat produksi: pilih parent dulu, sub-nya muncul.
          </p>
        </div>
        <ColorDialog parents={parentsOpt} />
      </div>

      {colors.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="font-bold">Belum ada warna</p>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            Jalankan SQL penyiapan tabel <code>colors</code>, atau klik &quot;Parent Colour Baru&quot;.
          </p>
        </div>
      ) : (
        <ColorTree colors={colors} parents={parentsOpt} />
      )}

      <p className="text-xs font-medium text-muted-foreground">
        Warna 2 tingkat (Parent → Sub) di tabel <code>colors</code> lewat <code>parent_id</code>. Swatch opsional untuk bantu identifikasi shade.
      </p>
    </div>
  );
}
