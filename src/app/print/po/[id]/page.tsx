import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { formatIDR } from "@/lib/utils";
import { PrintButton } from "./print-button";

export default async function POPrintPage({ params }: { params: { id: string } }) {
  if (!isSupabaseConfigured()) redirect("/login");
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: po } = await supabase
    .from("purchase_orders")
    .select("id,code,po_date,expected_date,brand_id,company_id,supplier_id,status,notes,ppn_percent,ppn_amount")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single();
  if (!po) notFound();

  const [lineRes, brandRes, supRes, coRes] = await Promise.all([
    supabase.from("purchase_order_lines").select("material_name,unit,qty,unit_price,received_qty").eq("po_id", po.id).is("deleted_at", null),
    supabase.from("brands").select("name,code").eq("id", po.brand_id).single(),
    po.supplier_id
      ? supabase.from("suppliers").select("name,phone,email,npwp,is_taxable,bank_name,bank_account_no,bank_account_name").eq("id", po.supplier_id).single()
      : Promise.resolve({ data: null }),
    supabase.from("companies").select("legal_name").eq("id", po.company_id).single(),
  ]);

  const lines = lineRes.data ?? [];
  const brandName = brandRes.data?.name ?? "—";
  const sup = supRes.data as {
    name?: string; phone?: string; email?: string; npwp?: string; is_taxable?: boolean;
    bank_name?: string; bank_account_no?: string; bank_account_name?: string;
  } | null;
  const company = coRes.data?.legal_name ?? "Brand.Inc";

  const subtotal = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unit_price) || 0), 0);
  const ppnAmount = Number(po.ppn_amount) || 0;
  const total = subtotal + ppnAmount;
  const statusLabel = po.status === "cancelled" ? "DIBATALKAN" : po.status === "received" ? "DITERIMA" : "DIPESAN";

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-eerie">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-black">{company}</h1>
          <p className="text-sm text-muted-foreground">Purchase Order — Bahan Baku</p>
        </div>
        <PrintButton />
      </div>

      <div className="mb-6 border-t border-b border-border py-4">
        <p className="text-2xl font-black tracking-tight">{po.code}</p>
        <p className="text-sm text-muted-foreground">Status: {statusLabel}</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Field label="Brand" value={brandName} />
        <Field label="Tanggal PO" value={(po.po_date as string) ?? "—"} />
        <Field label="Perkiraan Datang" value={(po.expected_date as string) ?? "—"} />
      </div>

      <Section title="Supplier">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Nama" value={sup?.name ?? "—"} />
          <Field label="Telepon" value={sup?.phone || "—"} />
          <Field label="Email" value={sup?.email || "—"} />
          <Field label="Status Pajak" value={sup?.is_taxable ? "PKP" : "Non-PKP"} />
          <Field label="NPWP" value={sup?.npwp || "—"} />
          <Field label="Bank" value={sup?.bank_name ? `${sup.bank_name} · ${sup.bank_account_no ?? ""}` : "—"} />
        </div>
      </Section>

      <Section title="Item Bahan">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-bold uppercase text-muted-foreground">
              <th className="py-2">Material</th>
              <th className="py-2 text-right">Qty</th>
              <th className="py-2">Satuan</th>
              <th className="py-2 text-right">Harga</th>
              <th className="py-2 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b border-border/60">
                <td className="py-1.5 font-semibold">{l.material_name as string}</td>
                <td className="py-1.5 text-right tabular-nums">{Number(l.qty) || 0}</td>
                <td className="py-1.5">{(l.unit as string) ?? "—"}</td>
                <td className="py-1.5 text-right tabular-nums">{formatIDR(Number(l.unit_price) || 0)}</td>
                <td className="py-1.5 text-right tabular-nums">{formatIDR((Number(l.qty) || 0) * (Number(l.unit_price) || 0))}</td>
              </tr>
            ))}
            <tr className="text-muted-foreground">
              <td className="py-1.5 font-semibold" colSpan={4}>Subtotal</td>
              <td className="py-1.5 text-right tabular-nums">{formatIDR(subtotal)}</td>
            </tr>
            <tr className="text-muted-foreground">
              <td className="py-1.5 font-semibold" colSpan={4}>PPN {Number(po.ppn_percent) || 0}%</td>
              <td className="py-1.5 text-right tabular-nums">{formatIDR(ppnAmount)}</td>
            </tr>
            <tr className="font-black">
              <td className="py-2" colSpan={4}>Total</td>
              <td className="py-2 text-right tabular-nums">{formatIDR(total)}</td>
            </tr>
          </tbody>
        </table>
      </Section>

      {(po.notes as string) && (
        <Section title="Catatan">
          <p className="whitespace-pre-line text-sm">{po.notes as string}</p>
        </Section>
      )}

      <div className="mt-10 grid grid-cols-2 gap-8 text-sm">
        <div>
          <p className="mb-12 text-muted-foreground">Dibuat oleh,</p>
          <p className="border-t border-border pt-1 font-semibold">{company}</p>
        </div>
        <div>
          <p className="mb-12 text-muted-foreground">Disetujui supplier,</p>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="mb-2 text-sm font-black uppercase tracking-wide">{title}</h2>
      {children}
    </div>
  );
}
