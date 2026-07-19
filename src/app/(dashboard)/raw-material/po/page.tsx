import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { POForm, type BrandOpt, type SupplierOpt, type MaterialOpt } from "@/app/(dashboard)/purchasing/po-form";
import { POList, type PORow } from "@/app/(dashboard)/purchasing/po-list";

async function getData() {
  if (!isSupabaseConfigured()) {
    return { rows: [] as PORow[], brands: [] as BrandOpt[], suppliers: [] as SupplierOpt[], materials: [] as MaterialOpt[] };
  }
  const supabase = createClient();
  const [poRes, lineRes, brandRes, supRes, matRes] = await Promise.all([
    supabase.from("purchase_orders").select("id,code,po_date,expected_date,brand_id,supplier_id,status,notes,ppn_percent,ppn_amount,invoice_no,invoice_date").is("deleted_at", null).order("code", { ascending: false }),
    supabase.from("purchase_order_lines").select("id,po_id,material_id,material_name,unit,qty,unit_price,received_qty").is("deleted_at", null),
    supabase.from("brands").select("id,name,code").is("deleted_at", null).order("name"),
    supabase.from("suppliers").select("id,name,is_taxable").is("deleted_at", null).order("name"),
    supabase.from("materials").select("id,name,code,unit,brand_id").is("deleted_at", null).eq("is_active", true).order("name"),
  ]);

  const brands = (brandRes.data ?? []).map((b) => ({ id: b.id as string, name: b.name as string, code: (b.code as string) ?? "" }));
  const suppliers = (supRes.data ?? []).map((s) => ({ id: s.id as string, name: s.name as string, is_taxable: Boolean(s.is_taxable) }));
  const materials = (matRes.data ?? []).map((m) => ({ id: m.id as string, name: m.name as string, code: (m.code as string | null) ?? null, unit: (m.unit as string | null) ?? null, brand_id: (m.brand_id as string | null) ?? null }));
  const brandName = (id: string | null) => brands.find((b) => b.id === id)?.name ?? "—";
  const supplierName = (id: string | null) => suppliers.find((s) => s.id === id)?.name ?? "—";
  const lines = lineRes.data ?? [];

  const rows: PORow[] = (poRes.data ?? []).map((p) => ({
    id: p.id as string,
    code: p.code as string,
    po_date: (p.po_date as string | null) ?? null,
    expected_date: (p.expected_date as string | null) ?? null,
    brand_name: brandName((p.brand_id as string | null) ?? null),
    supplier_name: supplierName((p.supplier_id as string | null) ?? null),
    status: (p.status as string) ?? "open",
    notes: (p.notes as string | null) ?? null,
    ppn_percent: Number(p.ppn_percent) || 0,
    ppn_amount: Number(p.ppn_amount) || 0,
    invoice_no: (p.invoice_no as string | null) ?? null,
    invoice_date: (p.invoice_date as string | null) ?? null,
    lines: lines.filter((l) => l.po_id === p.id).map((l) => ({
      id: l.id as string,
      material_id: (l.material_id as string | null) ?? null,
      material_name: (l.material_name as string | null) ?? null,
      unit: (l.unit as string | null) ?? null,
      qty: (l.qty as string | number) ?? 0,
      unit_price: (l.unit_price as string | number) ?? 0,
      received_qty: (l.received_qty as string | number) ?? 0,
    })),
  }));

  return { rows, brands, suppliers, materials };
}

export default async function RawMaterialPOPage() {
  const { rows, brands, suppliers, materials } = await getData();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Raw Material</p>
          <h1 className="text-2xl font-extrabold">Purchase Order — Bahan Baku</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            {rows.length} PO. Beli bahan ke supplier → terima dari PO → stok masuk (moving average). Semua dalam satu alur di sini.
          </p>
        </div>
        <POForm brands={brands} suppliers={suppliers} materials={materials} />
      </div>

      {rows.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="font-bold">Belum ada PO</p>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            Klik &quot;Buat PO&quot;: pilih Brand → Supplier → tambah bahan (qty &amp; harga). Bahan mengikuti brand.
          </p>
        </div>
      ) : (
        <POList rows={rows} />
      )}

      <p className="text-xs font-medium text-muted-foreground">
        Penerimaan bahan lewat tombol &quot;Terima&quot; di baris PO. Invoice ke supplier &amp; finance juga dari sini.
      </p>
    </div>
  );
}
