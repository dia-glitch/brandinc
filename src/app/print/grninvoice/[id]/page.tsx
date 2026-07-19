import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { formatIDR } from "@/lib/utils";
import { PrintButton } from "./print-button";

export default async function GrnInvoicePrintPage({ params }: { params: { id: string } }) {
  if (!isSupabaseConfigured()) redirect("/login");
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: r } = await supabase
    .from("fg_receipts")
    .select("id,code,po_id,spk_id,brand_id,company_id,supplier_id,incoming_no,invoice_no,invoice_date")
    .eq("id", params.id).is("deleted_at", null).single();
  if (!r) notFound();
  if (!r.invoice_no) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-center text-eerie">
        <p className="text-lg font-bold">Invoice belum dibuat untuk GRN ini.</p>
        <p className="mt-1 text-sm text-muted-foreground">Buka Finished Goods → Incoming & QC → klik &quot;Buat Invoice&quot; pada batch yang sudah di-QC.</p>
      </div>
    );
  }

  const [lineRes, poRes, spkRes, brandRes, supRes, coRes] = await Promise.all([
    supabase.from("fg_receipt_lines").select("sku,size,product_name,qty_good,unit_cost").eq("receipt_id", r.id).is("deleted_at", null),
    supabase.from("production_pos").select("code,ppn_percent").eq("id", r.po_id).maybeSingle(),
    supabase.from("work_orders").select("code").eq("id", r.spk_id).maybeSingle(),
    supabase.from("brands").select("name").eq("id", r.brand_id).single(),
    r.supplier_id
      ? supabase.from("suppliers").select("name,phone,email,npwp,is_taxable,bank_name,bank_account_no,bank_account_name").eq("id", r.supplier_id).single()
      : Promise.resolve({ data: null }),
    supabase.from("companies").select("legal_name").eq("id", r.company_id).single(),
  ]);

  const lines = (lineRes.data ?? [])
    .map((l) => ({
      sku: (l.sku as string | null) ?? "—",
      size: (l.size as string | null) ?? "—",
      name: (l.product_name as string | null) ?? "",
      qty: Number(l.qty_good) || 0,
      price: Number(l.unit_cost) || 0,
    }))
    .filter((l) => l.qty > 0);

  const po = poRes.data as { code?: string; ppn_percent?: number } | null;
  const poCode = po?.code ?? "—";
  const spkCode = (spkRes.data as { code?: string } | null)?.code ?? "—";
  const brandName = brandRes.data?.name ?? "—";
  const sup = supRes.data as {
    name?: string; phone?: string; email?: string; npwp?: string; is_taxable?: boolean;
    bank_name?: string; bank_account_no?: string; bank_account_name?: string;
  } | null;
  const company = coRes.data?.legal_name ?? "Brand.Inc";
  const productName = lines[0]?.name ?? "—";

  const subtotal = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const totalQty = lines.reduce((s, l) => s + l.qty, 0);
  const ppnPercent = Number(po?.ppn_percent) || 0;
  const ppnAmount = subtotal * (ppnPercent / 100);
  const total = subtotal + ppnAmount;

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-eerie">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-black">{company}</h1>
          <p className="text-sm text-muted-foreground">Invoice Produksi (per GRN) · Tagihan Jasa Vendor</p>
        </div>
        <PrintButton />
      </div>

      <div className="mb-6 flex items-end justify-between border-t border-b border-border py-4">
        <div>
          <p className="text-2xl font-black tracking-tight">{r.invoice_no}</p>
          <p className="mt-1 text-lg font-bold">{productName}</p>
          <p className="text-sm text-muted-foreground">Tanggal: {(r.invoice_date as string) ?? "—"}</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-bold">GRN: <span className="font-mono">{r.code}</span> (batch {r.incoming_no as number})</p>
          <p className="text-muted-foreground">PO: {poCode} · SPK: {spkCode}</p>
          <p className="text-muted-foreground">Brand: {brandName} · nilai dari Good batch ini</p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-black uppercase tracking-wide text-muted-foreground">Ditagihkan oleh (Vendor)</p>
          <p className="font-bold">{sup?.name ?? "—"}</p>
          {sup?.phone && <p className="text-sm">{sup.phone}</p>}
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
            <th className="py-2">SKU</th>
            <th className="py-2">Ukuran</th>
            <th className="py-2 text-right">Good</th>
            <th className="py-2 text-right">Ongkos</th>
            <th className="py-2 text-right">Jumlah</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className="border-b border-border/60">
              <td className="py-1.5 font-mono text-xs">{l.sku}</td>
              <td className="py-1.5">{l.size}</td>
              <td className="py-1.5 text-right tabular-nums">{l.qty}</td>
              <td className="py-1.5 text-right tabular-nums">{formatIDR(l.price)}</td>
              <td className="py-1.5 text-right tabular-nums">{formatIDR(l.qty * l.price)}</td>
            </tr>
          ))}
          <tr className="text-muted-foreground">
            <td className="py-1.5 font-semibold" colSpan={4}>Subtotal ({totalQty} pcs good)</td>
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
          <p className="text-sm font-semibold">{sup.bank_name} · {sup.bank_account_no ?? "—"} · a.n. {sup.bank_account_name ?? sup.name ?? "—"}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Rekening vendor belum diisi di Master Data.</p>
        )}
      </div>

      <div className="mt-10 grid grid-cols-2 gap-8 text-sm">
        <div>
          <p className="mb-12 text-muted-foreground">Diterima & diverifikasi (Finance),</p>
          <p className="border-t border-border pt-1 font-semibold">{company}</p>
        </div>
        <div>
          <p className="mb-12 text-muted-foreground">Hormat kami (Vendor),</p>
          <p className="border-t border-border pt-1 font-semibold">{sup?.name ?? "—"}</p>
        </div>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Tagihan jasa atas GRN {r.code} (Good batch ini). Batch/repair lain ditagih terpisah per GRN masing-masing.
      </p>
    </div>
  );
}
