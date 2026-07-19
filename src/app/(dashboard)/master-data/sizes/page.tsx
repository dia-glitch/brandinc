import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { Badge } from "@/components/ui/badge";
import { SizeDialog, type SizeData } from "./size-dialog";

async function getSizes(): Promise<SizeData[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("sizes")
    .select("id,code,name,sort_order,is_active")
    .is("deleted_at", null)
    .order("sort_order")
    .order("name");
  if (error) return [];
  return (data ?? []) as SizeData[];
}

export default async function SizesPage() {
  const sizes = await getSizes();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Master Data</p>
          <h1 className="text-2xl font-extrabold">Ukuran</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            {sizes.length} ukuran. Diurutkan sesuai kolom Urutan (bukan alfabet).
          </p>
        </div>
        <SizeDialog />
      </div>

      {sizes.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="font-bold">Belum ada ukuran</p>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            Pastikan tabel <code>sizes</code> sudah dibuat di database, lalu klik &quot;Ukuran Baru&quot;.
          </p>
        </div>
      ) : (
        <div className="card p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 w-16">Urutan</th>
                <th className="px-5 py-3">Ukuran</th>
                <th className="px-5 py-3">Kode</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {sizes.map((s) => (
                <tr key={s.id} className="border-t border-border font-semibold hover:bg-muted/50">
                  <td className="px-5 py-3 tabular-nums text-muted-foreground">{s.sort_order}</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex min-w-[44px] justify-center rounded-lg bg-muted px-2.5 py-1 font-bold">
                      {s.name}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{s.code ?? "—"}</td>
                  <td className="px-5 py-3">
                    {s.is_active ? <Badge tone="success">Aktif</Badge> : <Badge tone="neutral">Nonaktif</Badge>}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <SizeDialog size={s} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs font-medium text-muted-foreground">
        Ukuran tersimpan di tabel <code>sizes</code>, dipakai bersama semua brand. Ubah kolom <b>Urutan</b> untuk menata posisinya.
      </p>
    </div>
  );
}
