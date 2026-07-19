import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { Badge } from "@/components/ui/badge";
import { WarehouseDialog, type WarehouseData } from "./warehouse-dialog";
import { kindLabel } from "./kinds";

type Brand = { id: string; name: string };

async function getData(): Promise<{ warehouses: WarehouseData[]; brands: Brand[] }> {
  if (!isSupabaseConfigured()) return { warehouses: [], brands: [] };
  const supabase = createClient();
  const [whRes, brandRes] = await Promise.all([
    supabase.from("warehouses").select("id,code,name,kind,brand_id").is("deleted_at", null).order("name"),
    supabase.from("brands").select("id,name").is("deleted_at", null).order("name"),
  ]);
  return {
    warehouses: (whRes.data ?? []) as WarehouseData[],
    brands: (brandRes.data ?? []) as Brand[],
  };
}

export default async function WarehousesPage() {
  const { warehouses, brands } = await getData();
  const brandName = (id: string | null) => brands.find((b) => b.id === id)?.name ?? "Umum";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Master Data</p>
          <h1 className="text-2xl font-extrabold">Gudang</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">{warehouses.length} gudang. Dipakai untuk penerimaan barang jadi, damage, &amp; bahan baku.</p>
        </div>
        <WarehouseDialog brands={brands} />
      </div>

      {warehouses.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="font-bold">Belum ada gudang</p>
          <p className="mt-1 text-sm font-medium text-muted-foreground">Klik &quot;Gudang Baru&quot; untuk menambah gudang jadi / damage / bahan baku per brand.</p>
        </div>
      ) : (
        <div className="card p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3">Nama</th>
                <th className="px-5 py-3">Jenis</th>
                <th className="px-5 py-3">Brand</th>
                <th className="px-5 py-3">Kode</th>
                <th className="px-5 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {warehouses.map((w) => (
                <tr key={w.id} className="border-t border-border font-semibold hover:bg-muted/50">
                  <td className="px-5 py-3">{w.name}</td>
                  <td className="px-5 py-3"><Badge tone={w.kind === "damage" ? "danger" : "neutral"}>{kindLabel(w.kind)}</Badge></td>
                  <td className="px-5 py-3 font-medium text-muted-foreground">{brandName(w.brand_id)}</td>
                  <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{w.code ?? "—"}</td>
                  <td className="px-5 py-3 text-right"><WarehouseDialog warehouse={w} brands={brands} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
