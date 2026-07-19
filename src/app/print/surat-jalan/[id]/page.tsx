import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { PrintButton } from "./print-button";

export default async function SuratJalanPrintPage({ params }: { params: { id: string } }) {
  if (!isSupabaseConfigured()) redirect("/login");
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: t } = await supabase
    .from("stock_transfers")
    .select("id,code,brand_id,from_warehouse_id,to_warehouse_id,transfer_date,notes,status,requested_by,packed_by,packed_at,completed_at,company_id")
    .eq("id", params.id).is("deleted_at", null).single();
  if (!t) notFound();

  const [lineRes, brandRes, fromRes, toRes, coRes] = await Promise.all([
    supabase.from("stock_transfer_lines").select("sku,size,product_name,qty,qty_packed").eq("transfer_id", t.id).is("deleted_at", null),
    t.brand_id ? supabase.from("brands").select("name").eq("id", t.brand_id).single() : Promise.resolve({ data: null }),
    t.from_warehouse_id ? supabase.from("warehouses").select("name").eq("id", t.from_warehouse_id).single() : Promise.resolve({ data: null }),
    t.to_warehouse_id ? supabase.from("warehouses").select("name").eq("id", t.to_warehouse_id).single() : Promise.resolve({ data: null }),
    supabase.from("companies").select("legal_name").eq("id", t.company_id).single(),
  ]);

  const company = (coRes.data as { legal_name?: string } | null)?.legal_name ?? "Brand.Inc";
  const brand = (brandRes.data as { name?: string } | null)?.name ?? null;
  const fromWh = (fromRes.data as { name?: string } | null)?.name ?? "—";
  const toWh = (toRes.data as { name?: string } | null)?.name ?? "—";
  const lines = (lineRes.data ?? []).map((l) => ({ sku: (l.sku as string) ?? "", size: (l.size as string | null) ?? "", name: (l.product_name as string | null) ?? "", qty: l.qty_packed != null ? Number(l.qty_packed) || 0 : Number(l.qty) || 0 }));
  const totalQty = lines.reduce((s, l) => s + l.qty, 0);
  const tgl = (t.completed_at as string | null) ?? (t.packed_at as string | null) ?? (t.transfer_date as string | null) ?? "—";

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-eerie">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-black">{company}</h1>
          <p className="text-sm text-muted-foreground">Surat Jalan / Delivery Note · Pemindahan Stok</p>
        </div>
        <PrintButton />
      </div>

      <div className="mb-6 flex items-end justify-between border-b border-t border-border py-4">
        <div>
          <p className="text-2xl font-black tracking-tight">{t.code as string}</p>
          <p className="text-sm text-muted-foreground">Tanggal: {tgl}</p>
        </div>
        <div className="text-right text-sm">
          {brand && <p className="font-bold">Brand: {brand}</p>}
          <p className="text-muted-foreground">Status: {(t.status as string) === "completed" ? "Selesai (stok berpindah)" : "Siap Kirim"}</p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-black uppercase tracking-wide text-muted-foreground">Dari (Gudang Asal)</p>
          <p className="font-bold">{fromWh}</p>
          {t.packed_by ? <p className="text-sm text-muted-foreground">Dipacking: {t.packed_by as string}</p> : null}
        </div>
        <div>
          <p className="mb-1 text-xs font-black uppercase tracking-wide text-muted-foreground">Ke (Tujuan)</p>
          <p className="font-bold">{toWh}</p>
          {t.requested_by ? <p className="text-sm text-muted-foreground">Diminta: {t.requested_by as string}</p> : null}
        </div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-eerie text-left">
            <th className="py-2 pr-2">No</th>
            <th className="py-2 pr-2">Produk</th>
            <th className="py-2 pr-2">SKU</th>
            <th className="py-2 pr-2">Ukuran</th>
            <th className="py-2 pl-2 text-right">Qty</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className="border-b border-border">
              <td className="py-2 pr-2">{i + 1}</td>
              <td className="py-2 pr-2 font-semibold">{l.name}</td>
              <td className="py-2 pr-2 font-mono text-xs">{l.sku}</td>
              <td className="py-2 pr-2">{l.size || "—"}</td>
              <td className="py-2 pl-2 text-right font-bold tabular-nums">{l.qty}</td>
            </tr>
          ))}
          <tr className="border-b-2 border-eerie font-black">
            <td className="py-2 pr-2" colSpan={4}>Total</td>
            <td className="py-2 pl-2 text-right tabular-nums">{totalQty}</td>
          </tr>
        </tbody>
      </table>

      {t.notes ? <p className="mt-4 text-sm"><span className="font-bold">Catatan:</span> {t.notes as string}</p> : null}

      <div className="mt-12 grid grid-cols-3 gap-6 text-center text-sm">
        {["Pengirim (Outbound)", "Pengemudi / Kurir", "Penerima (Tujuan)"].map((role) => (
          <div key={role}>
            <div className="h-20 border-b border-border" />
            <p className="mt-2 font-bold">{role}</p>
            <p className="text-xs text-muted-foreground">Nama &amp; tanda tangan</p>
          </div>
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground print:hidden">Dokumen ini bisa langsung di-Print atau Simpan sebagai PDF.</p>
    </div>
  );
}
