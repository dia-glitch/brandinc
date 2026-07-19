import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { formatIDR } from "@/lib/utils";
import { PrintButton } from "./print-button";

export default async function InvoicePrintPage({ params }: { params: { id: string } }) {
  if (!isSupabaseConfigured()) redirect("/login");
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: po } = await supabase
    .from("purchase_orders")
    .select("id,code,po_date,brand_id,company_id,supplier_id,status,ppn_percent,invoice_no,invoice_date")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single();
  if (!po) notFound();
  if (!po.invoice_no) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-center text-eerie">
        <p className="text-lg font-bold">Invoice belum dibuat untuk PO ini.</p>
        <p className="mt-1 text-sm text-muted-foreground">Buka Purchasing → PO yang sudah diterima → klik &quot;Buat Invoice&quot;.</p>
      </div>
    );
  }

  const [lineRes, brandRes, supRes, coRes] = await Promise.all([
    supabase.from("purchase_order_lines").select("material_name,unit,qty,unit_price,received_qty").eq("po_id", po.id).is("deleted_at", null),
    supabase.from("brands").select("name,code").eq("id", po.brand_id).single(),
    po.supplier_id
      ? supabase.from("suppliers").select("name,phone,email,npwp,is_taxable,bank_name,bank_account_no,bank_account_name").eq("id", po.supplier_id).single()
      : Promise.resolve({ data: null }),
    supabase.from("companies").select("legal_name").eq("id", po.company_id).single(),
  ]);

  const allLines = lineRes.data ?? [];
  // Nilai invoice SELALU dari qty yang benar-benar diterima.
  const lines = allLines
    .map((l) => ({
      name: l.material_name as string,
      unit: (l.unit as string | null) ?? "—",
      qty: Number(l.received_qty) || 0,
      price: Number(l.unit_price) || 0,
    }))
    .filter((l) => l.qty > 0);

  const brandName = brandRes.data?.name ?? "—";
  const sup = supRes.data as {
    name?: string; phone?: string; email?: string; npwp?: string; is_taxable?: boolean;
    bank_name?: string; bank_account_no?: string; bank_account_name?: string;
  } | null;
  const company = coRes.data?.legal_name ?? "Brand.Inc";

  const subtotal = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const ppnPercent = Number(po.ppn_percent) || 0;
  const ppnAmount = subtotal * (ppnPercent / 100);
  const total = subtotal + ppnAmount;

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-eerie">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-black">{company}</h1>
          <p className="text-sm text-muted-foreground">Invoice Reference · Lembar Penagihan Supplier</p>
        </div>
        <PrintButton />
      </div>

      <div className="mb-6 flex items-end justify-between border-t border-b border-border py-4">
        <div>
          <p className="text-2xl font-black tracking-tight">{po.invoice_no}</p>
          <p className="text-sm text-muted-foreground">Tanggal: {(po.invoice_date as string) ?? "—"}</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-bold">Ref. PO: <span className="font-mono">{po.code}</span></p>
          <p className="text-muted-foreground">Brand: {brandName}</p>
          <p className="text-muted-foreground">Nilai sesuai penerimaan</p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-black uppercase tracking-wide text-muted-foreground">Ditagihkan oleh (Supplier)</p>
          <p className="font-bold">{sup?.name ?? "—"}</p>
          {sup?.phone && <p className="text-sm">{sup.phone}</p>}
          {sup?.email && <p className="text-sm">{sup.email}</p>}
          <p className="text-sm">{sup?.is_taxable ? "PKP" : "Non-PKP"}{sup?.npwp ? ` · NPWP ${sup.npwp}` : ""}</p>
        </div>
        <div>
          <p className="mb-1 text-xs font-black uppercase tracking-wide text-muted-foreground">Ditagihkan kepada</p>
          <p className="font-bold">{company}</p>
          <p className="text-sm text-muted-foreground">Divisi Finance</p>
        </div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-bold uppercase text-muted-foreground">
            <th className="py-2">Material</th>
            <th className="py-2 text-right">Qty Diterima</th>
            <th className="py-2">Satuan</th>
            <th className="py-2 text-right">Harga</th>
            <th className="py-2 text-right">Jumlah</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className="border-b border-border/60">
              <td className="py-1.5 font-semibold">{l.name}</td>
              <td className="py-1.5 text-right tabular-nums">{l.qty}</td>
              <td className="py-1.5">{l.unit}</td>
              <td className="py-1.5 text-right tabular-nums">{formatIDR(l.price)}</td>
              <td className="py-1.5 text-right tabular-nums">{formatIDR(l.qty * l.price)}</td>
            </tr>
          ))}
          <tr className="text-muted-foreground">
            <td className="py-1.5 font-semibold" colSpan={4}>Subtotal</td>
            <td className="py-1.5 text-right tabular-nums">{formatIDR(subtotal)}</td>
          </tr>
          <tr className="text-muted-foreground">
            <td className="py-1.5 font-semibold" colSpan={4}>PPN {ppnPercent}%</td>
            <td className="py-1.5 text-right tabular-nums">{formatIDR(ppnAmount)}</td>
          </tr>
          <tr className="text-base font-black">
            <td className="py-2.5" colSpan={4}>TOTAL TAGIHAN</td>
            <td className="py-2.5 text-right tabular-nums">{formatIDR(total)}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-6 rounded-xl border border-border p-4">
        <p className="mb-1 text-xs font-black uppercase tracking-wide text-muted-foreground">Pembayaran ke Rekening</p>
        {sup?.bank_name ? (
          <p className="text-sm font-semibold">
            {sup.bank_name} · {sup.bank_account_no ?? "—"} · a.n. {sup.bank_account_name ?? sup.name ?? "—"}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Rekening supplier belum diisi di Master Data.</p>
        )}
      </div>

      <div className="mt-10 grid grid-cols-2 gap-8 text-sm">
        <div>
          <p className="mb-12 text-muted-foreground">Diterima & diverifikasi (Finance),</p>
          <p className="border-t border-border pt-1 font-semibold">{company}</p>
        </div>
        <div>
          <p className="mb-12 text-muted-foreground">Hormat kami (Supplier),</p>
          <p className="border-t border-border pt-1 font-semibold">{sup?.name ?? "—"}</p>
        </div>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Dokumen ini adalah referensi penagihan berdasarkan penerimaan barang atas PO {po.code}. Nilai mengikuti jumlah yang benar-benar diterima.
      </p>
    </div>
  );
}
