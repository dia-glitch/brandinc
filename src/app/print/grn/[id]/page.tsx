import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { PrintButton } from "./print-button";

export default async function GRNPrintPage({ params }: { params: { id: string } }) {
  if (!isSupabaseConfigured()) redirect("/login");
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: r } = await supabase
    .from("fg_receipts")
    .select("id,code,po_id,spk_id,brand_id,company_id,supplier_id,receipt_date,incoming_no,good_warehouse_id,damage_warehouse_id,notes")
    .eq("id", params.id).is("deleted_at", null).single();
  if (!r) notFound();

  const [lineRes, poRes, brandRes, supRes, coRes, whRes] = await Promise.all([
    supabase.from("fg_receipt_lines").select("sku,size,product_name,qty_incoming,qty_good,qty_repair,qty_damage").eq("receipt_id", r.id).is("deleted_at", null),
    supabase.from("production_pos").select("code").eq("id", r.po_id).maybeSingle(),
    supabase.from("brands").select("name").eq("id", r.brand_id).single(),
    r.supplier_id ? supabase.from("suppliers").select("name").eq("id", r.supplier_id).single() : Promise.resolve({ data: null }),
    supabase.from("companies").select("legal_name").eq("id", r.company_id).single(),
    supabase.from("warehouses").select("id,name").is("deleted_at", null),
  ]);

  const lines = lineRes.data ?? [];
  const poCode = (poRes.data as { code?: string } | null)?.code ?? "—";
  const brandName = brandRes.data?.name ?? "—";
  const supplierName = (supRes.data as { name?: string } | null)?.name ?? "—";
  const company = coRes.data?.legal_name ?? "Brand.Inc";
  const whs = whRes.data ?? [];
  const whName = (id: string | null) => whs.find((w) => w.id === id)?.name ?? "—";
  const productName = (lines[0]?.product_name as string | undefined) ?? "—";

  const tGood = lines.reduce((s, l) => s + (Number(l.qty_good) || 0), 0);
  const tRepair = lines.reduce((s, l) => s + (Number(l.qty_repair) || 0), 0);
  const tDamage = lines.reduce((s, l) => s + (Number(l.qty_damage) || 0), 0);
  const tIncoming = lines.reduce((s, l) => s + (Number(l.qty_incoming) || 0), 0);

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-eerie">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-black">{company}</h1>
          <p className="text-sm text-muted-foreground">Bukti Penerimaan Barang + QC (GRN)</p>
        </div>
        <PrintButton />
      </div>

      <div className="mb-6 flex items-end justify-between border-t border-b border-border py-4">
        <div>
          <p className="text-2xl font-black tracking-tight">{r.code}</p>
          <p className="mt-1 text-lg font-bold">{productName}</p>
          <p className="text-sm text-muted-foreground">Incoming batch ke-{r.incoming_no as number}</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-bold">Ref. PO: <span className="font-mono">{poCode}</span></p>
          <p className="text-muted-foreground">Brand: {brandName}</p>
          <p className="text-muted-foreground">Vendor: {supplierName}</p>
          <p className="text-muted-foreground">Tgl: {(r.receipt_date as string) ?? "—"}</p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-2">
        <Field label="Gudang Barang Jadi" value={whName(r.good_warehouse_id as string | null)} />
        <Field label="Gudang Damage" value={r.damage_warehouse_id ? whName(r.damage_warehouse_id as string) : "—"} />
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-bold uppercase text-muted-foreground">
            <th className="py-2">SKU</th><th className="py-2">Ukuran</th>
            <th className="py-2 text-right">Incoming</th><th className="py-2 text-right">Good</th>
            <th className="py-2 text-right">Repair</th><th className="py-2 text-right">Damage</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className="border-b border-border/60">
              <td className="py-1.5 font-mono text-xs">{l.sku as string}</td>
              <td className="py-1.5">{(l.size as string) ?? "—"}</td>
              <td className="py-1.5 text-right tabular-nums">{Number(l.qty_incoming) || 0}</td>
              <td className="py-1.5 text-right tabular-nums">{Number(l.qty_good) || 0}</td>
              <td className="py-1.5 text-right tabular-nums">{Number(l.qty_repair) || 0}</td>
              <td className="py-1.5 text-right tabular-nums">{Number(l.qty_damage) || 0}</td>
            </tr>
          ))}
          <tr className="font-black">
            <td className="py-2" colSpan={2}>Total</td>
            <td className="py-2 text-right tabular-nums">{tIncoming}</td>
            <td className="py-2 text-right tabular-nums">{tGood}</td>
            <td className="py-2 text-right tabular-nums">{tRepair}</td>
            <td className="py-2 text-right tabular-nums">{tDamage}</td>
          </tr>
        </tbody>
      </table>

      {tRepair > 0 && (
        <p className="mt-4 rounded-xl border border-border bg-muted/40 p-3 text-sm">
          <b>{tRepair} pcs</b> retur ke vendor untuk repair — akan diterima pada incoming batch berikutnya.
        </p>
      )}

      {(r.notes as string) && (
        <div className="mt-4">
          <p className="mb-1 text-xs font-black uppercase tracking-wide text-muted-foreground">Catatan</p>
          <p className="whitespace-pre-line text-sm">{r.notes as string}</p>
        </div>
      )}

      <div className="mt-10 grid grid-cols-3 gap-6 text-sm">
        <Sign label="QC" />
        <Sign label="Gudang" />
        <Sign label="Vendor" name={supplierName} />
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
function Sign({ label, name }: { label: string; name?: string }) {
  return (
    <div>
      <p className="mb-12 text-muted-foreground">{label},</p>
      <p className="border-t border-border pt-1 font-semibold">{name ?? "—"}</p>
    </div>
  );
}
