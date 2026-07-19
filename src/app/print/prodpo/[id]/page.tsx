import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { formatIDR } from "@/lib/utils";
import { PrintButton } from "./print-button";

export default async function ProdPOPrintPage({ params }: { params: { id: string } }) {
  if (!isSupabaseConfigured()) redirect("/login");
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: po } = await supabase
    .from("production_pos")
    .select("id,code,spk_id,po_date,due_delivery,brand_id,company_id,supplier_id,status,notes,ppn_percent")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single();
  if (!po) notFound();

  const [lineRes, spkRes, brandRes, supRes, coRes] = await Promise.all([
    supabase.from("production_po_lines").select("sku,size,product_name,qty_spk,qty,unit_cost").eq("po_id", po.id).is("deleted_at", null),
    supabase.from("work_orders").select("code").eq("id", po.spk_id).maybeSingle(),
    supabase.from("brands").select("name").eq("id", po.brand_id).single(),
    po.supplier_id
      ? supabase.from("suppliers").select("name,phone,email,npwp,is_taxable,bank_name,bank_account_no,bank_account_name").eq("id", po.supplier_id).single()
      : Promise.resolve({ data: null }),
    supabase.from("companies").select("legal_name").eq("id", po.company_id).single(),
  ]);

  const lines = (lineRes.data ?? []).map((l) => ({
    sku: (l.sku as string | null) ?? "—",
    size: (l.size as string | null) ?? "—",
    productName: (l.product_name as string | null) ?? "",
    qtySpk: Number(l.qty_spk) || 0,
    qty: Number(l.qty) || 0,
    unitCost: Number(l.unit_cost) || 0,
  }));
  const spkCode = (spkRes.data as { code?: string } | null)?.code ?? "—";
  const brandName = brandRes.data?.name ?? "—";
  const sup = supRes.data as {
    name?: string; phone?: string; email?: string; npwp?: string; is_taxable?: boolean;
    bank_name?: string; bank_account_no?: string; bank_account_name?: string;
  } | null;
  const company = coRes.data?.legal_name ?? "Brand.Inc";
  const productName = lines[0]?.productName ?? "—";

  const subtotal = lines.reduce((s, l) => s + l.qty * l.unitCost, 0);
  const totalQty = lines.reduce((s, l) => s + l.qty, 0);
  const ppnPercent = Number(po.ppn_percent) || 0;
  const ppnAmount = subtotal * (ppnPercent / 100);
  const total = subtotal + ppnAmount;
  const statusLabel = po.status === "cancelled" ? "DIBATALKAN" : "OPEN";

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-eerie">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-black">{company}</h1>
          <p className="text-sm text-muted-foreground">PO Produksi — Order Jasa (Ongkos WIP)</p>
        </div>
        <PrintButton />
      </div>

      <div className="mb-6 flex items-end justify-between border-t border-b border-border py-4">
        <div>
          <p className="text-2xl font-black tracking-tight">{po.code}</p>
          <p className="mt-1 text-lg font-bold">{productName}</p>
          <p className="text-sm text-muted-foreground">Status: {statusLabel}</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-bold">Ref. SPK: <span className="font-mono">{spkCode}</span></p>
          <p className="text-muted-foreground">Brand: {brandName}</p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="col-span-2 sm:col-span-1">
          <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Vendor / Makloon</p>
          <p className="font-bold">{sup?.name ?? "—"}</p>
          {sup?.phone && <p className="text-sm">{sup.phone}</p>}
          <p className="text-sm">{sup?.is_taxable ? "PKP" : "Non-PKP"}{sup?.npwp ? ` · NPWP ${sup.npwp}` : ""}</p>
        </div>
        <Field label="Tanggal PO" value={(po.po_date as string) ?? "—"} />
        <Field label="Due Delivery" value={(po.due_delivery as string) ?? "—"} />
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-bold uppercase text-muted-foreground">
            <th className="py-2">SKU</th>
            <th className="py-2">Ukuran</th>
            <th className="py-2 text-right">Qty SPK</th>
            <th className="py-2 text-right">Qty PO</th>
            <th className="py-2 text-right">Ongkos WIP</th>
            <th className="py-2 text-right">Jumlah</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className="border-b border-border/60">
              <td className="py-1.5 font-mono text-xs">{l.sku}</td>
              <td className="py-1.5">{l.size}</td>
              <td className="py-1.5 text-right tabular-nums text-muted-foreground">{l.qtySpk}</td>
              <td className="py-1.5 text-right tabular-nums">{l.qty}</td>
              <td className="py-1.5 text-right tabular-nums">{formatIDR(l.unitCost)}</td>
              <td className="py-1.5 text-right tabular-nums">{formatIDR(l.qty * l.unitCost)}</td>
            </tr>
          ))}
          <tr className="text-muted-foreground">
            <td className="py-1.5 font-semibold" colSpan={5}>Subtotal ({totalQty} pcs)</td>
            <td className="py-1.5 text-right tabular-nums">{formatIDR(subtotal)}</td>
          </tr>
          <tr className="text-muted-foreground">
            <td className="py-1.5 font-semibold" colSpan={5}>PPN {ppnPercent}%</td>
            <td className="py-1.5 text-right tabular-nums">{formatIDR(ppnAmount)}</td>
          </tr>
          <tr className="text-base font-black">
            <td className="py-2.5" colSpan={5}>TOTAL</td>
            <td className="py-2.5 text-right tabular-nums">{formatIDR(total)}</td>
          </tr>
        </tbody>
      </table>

      {(po.notes as string) && (
        <div className="mt-6">
          <p className="mb-1 text-xs font-black uppercase tracking-wide text-muted-foreground">Catatan</p>
          <p className="whitespace-pre-line text-sm">{po.notes as string}</p>
        </div>
      )}

      <div className="mt-10 grid grid-cols-2 gap-8 text-sm">
        <div>
          <p className="mb-12 text-muted-foreground">Dibuat oleh,</p>
          <p className="border-t border-border pt-1 font-semibold">{company}</p>
        </div>
        <div>
          <p className="mb-12 text-muted-foreground">Disetujui vendor,</p>
          <p className="border-t border-border pt-1 font-semibold">{sup?.name ?? "—"}</p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
