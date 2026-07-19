import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { PrintButton } from "./print-button";
import { SpkImageUploader } from "./spk-image-uploader";

export default async function SPKPrintPage({ params }: { params: { id: string } }) {
  if (!isSupabaseConfigured()) redirect("/login");
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: wo } = await supabase
    .from("work_orders")
    .select("id,code,spk_date,due_delivery,brand_id,company_id,supplier_id,supplier_type,merchandiser,button_accessories,care_label,vendor_comment,image_url,status,notes")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single();
  if (!wo) notFound();

  const [lineRes, specRes, brandRes, supRes, coRes] = await Promise.all([
    supabase.from("work_order_lines").select("sku,size,product_name,ratio,qty").eq("spk_id", wo.id).is("deleted_at", null),
    supabase.from("work_order_specs").select("name,values,sort_order").eq("spk_id", wo.id).is("deleted_at", null).order("sort_order"),
    supabase.from("brands").select("name,code").eq("id", wo.brand_id).single(),
    wo.supplier_id ? supabase.from("suppliers").select("name").eq("id", wo.supplier_id).single() : Promise.resolve({ data: null }),
    supabase.from("companies").select("legal_name").eq("id", wo.company_id).single(),
  ]);

  const lines = lineRes.data ?? [];
  const specs = specRes.data ?? [];
  const brandName = brandRes.data?.name ?? "—";
  const supplierName = (supRes.data as { name?: string } | null)?.name ?? "—";
  const company = coRes.data?.legal_name ?? "Brand.Inc";
  const productName = (lines[0]?.product_name as string | undefined) ?? "—";
  const totalQty = lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);
  const sizeCols = Array.from(new Set(lines.map((l) => l.size).filter(Boolean))) as string[];

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-eerie">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-black">{company}</h1>
          <p className="text-sm text-muted-foreground">Surat Perintah Kerja</p>
        </div>
        <PrintButton />
      </div>

      <div className="mb-6 border-t border-b border-border py-4">
        <p className="text-2xl font-black tracking-tight">{wo.code}</p>
        <p className="mt-1 text-lg font-bold">{productName}</p>
        <p className="text-sm text-muted-foreground">
          Status: {wo.status === "cancelled" ? "DIBATALKAN" : "OPEN"}
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="col-span-2 space-y-2 sm:col-span-1">
          {wo.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={wo.image_url as string} alt="produk" className="h-40 w-40 rounded-xl border border-border object-cover" />
          )}
          <SpkImageUploader spkId={wo.id as string} hasImage={Boolean(wo.image_url)} />
        </div>
        <Field label="Brand" value={brandName} />
        <Field label="Supplier" value={supplierName} />
        <Field label="Tipe Supplier" value={(wo.supplier_type as string) ?? "—"} />
        <Field label="Merchandiser" value={(wo.merchandiser as string) ?? "—"} />
        <Field label="Tanggal SPK" value={(wo.spk_date as string) ?? "—"} />
        <Field label="Due Delivery" value={(wo.due_delivery as string) ?? "—"} />
        <Field label="Total Qty" value={`${totalQty} pcs`} />
      </div>

      <Section title="Size & Qty">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-left text-xs font-bold uppercase text-muted-foreground">
            <th className="py-2">SKU</th><th className="py-2">Ukuran</th><th className="py-2 text-right">Ratio</th><th className="py-2 text-right">Qty</th>
          </tr></thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b border-border/60">
                <td className="py-1.5 font-mono text-xs">{l.sku}</td>
                <td className="py-1.5">{l.size}</td>
                <td className="py-1.5 text-right">{(l.ratio as number) ?? "—"}</td>
                <td className="py-1.5 text-right tabular-nums">{Number(l.qty) || 0}</td>
              </tr>
            ))}
            <tr className="font-black"><td className="py-2" colSpan={3}>Total</td><td className="py-2 text-right tabular-nums">{totalQty}</td></tr>
          </tbody>
        </table>
      </Section>

      {specs.length > 0 && (
        <Section title="Size Specification (cm)">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left text-xs font-bold uppercase text-muted-foreground">
              <th className="py-2">Pengukuran</th>{sizeCols.map((c) => <th key={c} className="py-2 text-center">{c}</th>)}
            </tr></thead>
            <tbody>
              {specs.map((sp, i) => {
                const vals = (sp.values as Record<string, number> | null) ?? {};
                return (
                  <tr key={i} className="border-b border-border/60">
                    <td className="py-1.5 font-semibold">{sp.name as string}</td>
                    {sizeCols.map((c) => <td key={c} className="py-1.5 text-center tabular-nums">{vals[c] ?? "—"}</td>)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>
      )}

      {((wo.button_accessories as string) || (wo.care_label as string)) && (
        <Section title="Catatan Produksi">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Button / Accessories" value={(wo.button_accessories as string) ?? "—"} />
            <Field label="Care Label Material" value={(wo.care_label as string) ?? "—"} />
          </div>
        </Section>
      )}

      {(wo.vendor_comment as string) && (
        <Section title="Comment untuk Vendor">
          <p className="whitespace-pre-line text-sm">{wo.vendor_comment as string}</p>
        </Section>
      )}
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
