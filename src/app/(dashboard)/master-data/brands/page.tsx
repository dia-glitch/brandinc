import { Filter, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getRole } from "@/lib/roles";
import { canAct } from "@/lib/permissions";
import { BrandDialog, type BrandData } from "./brand-dialog";

// Ambil data brand ASLI dari Supabase (menghormati RLS lewat sesi user).
async function getBrands(): Promise<BrandData[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("brands")
    .select("id,code,name,segment,is_active")
    .is("deleted_at", null)
    .order("code");
  if (error) return [];
  return (data ?? []) as BrandData[];
}

export default async function BrandsPage() {
  const brands = await getBrands();

  let canEdit = true;
  if (isSupabaseConfigured()) canEdit = canAct(await getRole(createClient()), "master_data");

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Master Data
          </p>
          <h1 className="text-2xl font-extrabold">Brand</h1>
        </div>
        <BrandDialog canEdit={canEdit} />
      </div>

      <div className="card p-0">
        <div className="flex flex-wrap items-center gap-2.5 border-b border-border p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Cari brand…"
              className="h-10 w-full rounded-full border border-border bg-background pl-10 pr-4 text-sm font-medium outline-none focus:border-primary/40"
            />
          </div>
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4" /> Filter
          </Button>
        </div>

        {brands.length === 0 ? (
          <div className="p-10 text-center">
            <p className="font-bold">Belum ada data brand yang tampil</p>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              Pastikan Anda sudah login &amp; punya akses ke company DEMO. Atau klik &quot;Brand Baru&quot; untuk menambah.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3">Kode</th>
                  <th className="px-5 py-3">Brand</th>
                  <th className="px-5 py-3">Segmen</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {brands.map((b) => (
                  <tr key={b.id} className="border-t border-border font-semibold hover:bg-muted/50">
                    <td className="px-5 py-4 font-mono text-xs text-muted-foreground">{b.code}</td>
                    <td className="px-5 py-4">{b.name}</td>
                    <td className="px-5 py-4 font-medium text-muted-foreground">{b.segment ?? "—"}</td>
                    <td className="px-5 py-4">
                      {b.is_active ? (
                        <Badge tone="success">Aktif</Badge>
                      ) : (
                        <Badge tone="neutral">Nonaktif</Badge>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <BrandDialog brand={b} canEdit={canEdit} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs font-medium text-muted-foreground">
        Tambah/edit tersimpan langsung ke database Supabase Anda (tabel <code>brands</code>), aman oleh RLS multi-brand.
      </p>
    </div>
  );
}
