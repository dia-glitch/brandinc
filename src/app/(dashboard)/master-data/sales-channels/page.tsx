import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getRole } from "@/lib/roles";
import { canAct } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { ChannelDialog, type ChannelData, type WarehouseOpt } from "./channel-dialog";
import { SeedButton } from "./seed-button";

async function getData(): Promise<{ channels: ChannelData[]; warehouses: WarehouseOpt[] }> {
  if (!isSupabaseConfigured()) return { channels: [], warehouses: [] };
  const supabase = createClient();
  const [chRes, whRes] = await Promise.all([
    supabase.from("sales_channels").select("id,name,grup,code,warehouse_id,is_active").is("deleted_at", null).order("grup").order("name"),
    supabase.from("warehouses").select("id,name,kind,brand_id").is("deleted_at", null).order("name"),
  ]);
  return { channels: (chRes.data ?? []) as ChannelData[], warehouses: (whRes.data ?? []).map((w) => ({ id: w.id as string, name: w.name as string })) };
}

export default async function SalesChannelsPage() {
  const { channels, warehouses } = await getData();
  const whName = (id: string | null) => warehouses.find((w) => w.id === id)?.name ?? null;
  const online = channels.filter((c) => c.grup === "online");
  const offline = channels.filter((c) => c.grup === "offline");

  let canEdit = true;
  if (isSupabaseConfigured()) canEdit = canAct(await getRole(createClient()), "master_data");

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Master Data</p>
          <h1 className="text-2xl font-extrabold">Akun Penjualan</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">{channels.length} channel. Petakan <b>Gudang Sumber</b> agar penjualan channel ini otomatis mengurangi stok gudang tersebut.</p>
        </div>
        <div className="flex items-center gap-2">
          <SeedButton canEdit={canEdit} />
          <ChannelDialog warehouses={warehouses} canEdit={canEdit} />
        </div>
      </div>

      {channels.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="font-bold">Belum ada akun penjualan</p>
          <p className="mt-1 text-sm font-medium text-muted-foreground">Klik &quot;Isi Bawaan&quot; untuk memasukkan Shopee, Tiktok, Website, Store A, Store B — atau &quot;Akun Penjualan Baru&quot; untuk menambah sendiri.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <Group title="Online" rows={online} warehouses={warehouses} whName={whName} canEdit={canEdit} />
          <Group title="Offline" rows={offline} warehouses={warehouses} whName={whName} canEdit={canEdit} />
        </div>
      )}
    </div>
  );
}

function Group({ title, rows, warehouses, whName, canEdit = true }: { title: string; rows: ChannelData[]; warehouses: WarehouseOpt[]; whName: (id: string | null) => string | null; canEdit?: boolean }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="card p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <th className="px-5 py-3">Nama</th>
              <th className="px-5 py-3">Gudang Sumber</th>
              <th className="px-5 py-3">Kode</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-border font-semibold hover:bg-muted/50">
                <td className="px-5 py-3">{c.name}</td>
                <td className="px-5 py-3 font-medium text-muted-foreground">{whName(c.warehouse_id) ?? <span className="text-muted-foreground">— semua —</span>}</td>
                <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{c.code ?? "—"}</td>
                <td className="px-5 py-3">{c.is_active ? <Badge tone="success">Aktif</Badge> : <Badge tone="neutral">Nonaktif</Badge>}</td>
                <td className="px-5 py-3 text-right"><ChannelDialog channel={c} warehouses={warehouses} canEdit={canEdit} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
