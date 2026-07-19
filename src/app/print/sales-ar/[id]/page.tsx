import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { formatIDR } from "@/lib/utils";
import { PrintButton } from "./print-button";

export default async function SalesARPrintPage({ params }: { params: { id: string } }) {
  if (!isSupabaseConfigured()) redirect("/login");
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: o } = await supabase
    .from("sales_orders")
    .select("id,code,brand_id,channel_id,settlement,order_date,discount,commission,ppn,notes,company_id")
    .eq("id", params.id).is("deleted_at", null).single();
  if (!o) notFound();

  const [lineRes, brandRes, chanRes, coRes, payRes, srRes, srLineRes, acctRes] = await Promise.all([
    supabase.from("sales_order_lines").select("sku,size,product_name,qty,retail,price").eq("order_id", o.id).is("deleted_at", null),
    o.brand_id ? supabase.from("brands").select("name").eq("id", o.brand_id).single() : Promise.resolve({ data: null }),
    o.channel_id ? supabase.from("sales_channels").select("name").eq("id", o.channel_id).single() : Promise.resolve({ data: null }),
    supabase.from("companies").select("legal_name").eq("id", o.company_id).single(),
    supabase.from("payments").select("amount").eq("ref_type", "ar_receipt").eq("ref_key", o.code).eq("direction", "in").is("deleted_at", null),
    supabase.from("sales_returns").select("id").eq("order_id", o.id).is("deleted_at", null),
    supabase.from("sales_return_lines").select("return_id,qty,price").is("deleted_at", null),
    supabase.from("cash_accounts").select("name,bank_name,account_no,account_holder").eq("kind", "bank").is("deleted_at", null).limit(1),
  ]);

  const company = coRes.data?.legal_name ?? "Brand.Inc";
  const brand = (brandRes.data as { name?: string } | null)?.name ?? null;
  const store = (chanRes.data as { name?: string } | null)?.name ?? "—";
  const lines = (lineRes.data ?? []).map((l) => ({ sku: (l.sku as string) ?? "", size: (l.size as string | null) ?? "", name: (l.product_name as string | null) ?? "", qty: Number(l.qty) || 0, retail: Number(l.retail) || 0, price: Number(l.price) || 0 }));
  const net = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const discount = Number(o.discount) || 0;
  const commission = Number(o.commission) || 0;
  const ppn = Number(o.ppn) || 0;
  const retIds = new Set((srRes.data ?? []).map((r) => r.id as string));
  const returned = (srLineRes.data ?? []).filter((l) => retIds.has(l.return_id as string)).reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
  const total = Math.max(0, net + ppn - commission - returned);
  const paid = (payRes.data ?? []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const outstanding = Math.max(0, total - paid);
  const acct = (acctRes.data ?? [])[0] as { name?: string; bank_name?: string; account_no?: string; account_holder?: string } | undefined;

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-eerie">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-black">{company}</h1>
          <p className="text-sm text-muted-foreground">Invoice Penagihan Konsinyasi · Piutang (AR)</p>
        </div>
        <PrintButton />
      </div>

      <div className="mb-6 flex items-end justify-between border-t border-b border-border py-4">
        <div>
          <p className="text-2xl font-black tracking-tight">{o.code as string}</p>
          <p className="text-sm text-muted-foreground">Tanggal: {(o.order_date as string) ?? "—"}</p>
        </div>
        <div className="text-right text-sm">
          {brand && <p className="font-bold">Brand: {brand}</p>}
          <p className="text-muted-foreground">Penjualan konsinyasi per produk</p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-black uppercase tracking-wide text-muted-foreground">Ditagihkan kepada (Store)</p>
          <p className="font-bold">{store}</p>
          <p className="text-sm text-muted-foreground">Store konsinyasi</p>
        </div>
        <div>
          <p className="mb-1 text-xs font-black uppercase tracking-wide text-muted-foreground">Penagih</p>
          <p className="font-bold">{company}</p>
          <p className="text-sm text-muted-foreground">Divisi Finance</p>
        </div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-bold uppercase text-muted-foreground">
            <th className="py-2">Produk</th><th className="py-2">SKU</th><th className="py-2 text-right">Qty</th><th className="py-2 text-right">Harga</th><th className="py-2 text-right">Jumlah</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className="border-b border-border/60">
              <td className="py-1.5 font-semibold">{l.name}{l.size ? ` · ${l.size}` : ""}</td>
              <td className="py-1.5 font-mono text-xs">{l.sku}</td>
              <td className="py-1.5 text-right tabular-nums">{l.qty}</td>
              <td className="py-1.5 text-right tabular-nums">{formatIDR(l.price)}</td>
              <td className="py-1.5 text-right tabular-nums">{formatIDR(l.qty * l.price)}</td>
            </tr>
          ))}
          <tr className="text-muted-foreground"><td className="py-1.5 font-semibold" colSpan={4}>Subtotal (neto)</td><td className="py-1.5 text-right tabular-nums">{formatIDR(net)}</td></tr>
          {commission > 0 && <tr className="text-muted-foreground"><td className="py-1.5 font-semibold" colSpan={4}>Komisi Konsinyasi</td><td className="py-1.5 text-right tabular-nums">− {formatIDR(commission)}</td></tr>}
          {ppn > 0 && <tr className="text-muted-foreground"><td className="py-1.5 font-semibold" colSpan={4}>PPN</td><td className="py-1.5 text-right tabular-nums">{formatIDR(ppn)}</td></tr>}
          {returned > 0 && <tr className="text-muted-foreground"><td className="py-1.5 font-semibold" colSpan={4}>Retur</td><td className="py-1.5 text-right tabular-nums">− {formatIDR(returned)}</td></tr>}
          {paid > 0 && <tr className="text-muted-foreground"><td className="py-1.5 font-semibold" colSpan={4}>Sudah diterima</td><td className="py-1.5 text-right tabular-nums">− {formatIDR(paid)}</td></tr>}
          <tr className="text-base font-black"><td className="py-2.5" colSpan={4}>SISA TAGIHAN</td><td className="py-2.5 text-right tabular-nums">{formatIDR(outstanding)}</td></tr>
        </tbody>
      </table>

      <div className="mt-6 rounded-xl border border-border p-4">
        <p className="mb-1 text-xs font-black uppercase tracking-wide text-muted-foreground">Pembayaran ke Rekening</p>
        {acct ? (
          <p className="text-sm font-semibold">{acct.bank_name ?? acct.name} · {acct.account_no ?? "—"} · a.n. {acct.account_holder || company}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Belum ada rekening bank di Kas &amp; Bank.</p>
        )}
      </div>

      {o.notes && <p className="mt-4 text-sm text-muted-foreground">Catatan: {o.notes as string}</p>}

      <div className="mt-10 grid grid-cols-2 gap-8 text-sm">
        <div><p className="mb-12 text-muted-foreground">Hormat kami,</p><p className="border-t border-border pt-1 font-semibold">{company}</p></div>
        <div><p className="mb-12 text-muted-foreground">Diterima &amp; disetujui,</p><p className="border-t border-border pt-1 font-semibold">{store}</p></div>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">Invoice penagihan penjualan konsinyasi {o.code as string}. Nilai tagihan = penjualan neto − komisi konsinyasi − retur.</p>
    </div>
  );
}
