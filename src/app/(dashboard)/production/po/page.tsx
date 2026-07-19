import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getRole } from "@/lib/roles";
import { canAct } from "@/lib/permissions";
import { ProdPOForm, type SpkOpt, type SupplierOpt } from "./po-form";
import { ProdPOList, type ProdPORow } from "./po-list";

async function getData() {
  if (!isSupabaseConfigured()) return { rows: [] as ProdPORow[], spks: [] as SpkOpt[], suppliers: [] as SupplierOpt[] };
  const supabase = createClient();
  const [poRes, poLineRes, spkRes, spkLineRes, brandRes, supRes] = await Promise.all([
    supabase.from("production_pos").select("id,code,spk_id,po_date,due_delivery,brand_id,supplier_id,status,notes,ppn_percent,ppn_amount,invoice_no").is("deleted_at", null).order("code", { ascending: false }),
    supabase.from("production_po_lines").select("id,po_id,sku,size,product_name,qty_spk,qty,unit_cost,received_qty").is("deleted_at", null),
    supabase.from("work_orders").select("id,code,brand_id,supplier_id,due_delivery,status").is("deleted_at", null).order("code", { ascending: false }),
    supabase.from("work_order_lines").select("id,spk_id,sku,size,product_name,qty").is("deleted_at", null),
    supabase.from("brands").select("id,name").is("deleted_at", null),
    supabase.from("suppliers").select("id,name,is_taxable").is("deleted_at", null).order("name"),
  ]);

  const brands = (brandRes.data ?? []).map((b) => ({ id: b.id as string, name: b.name as string }));
  const suppliers = (supRes.data ?? []).map((s) => ({ id: s.id as string, name: s.name as string, is_taxable: Boolean(s.is_taxable) }));
  const brandName = (id: string | null) => brands.find((b) => b.id === id)?.name ?? "—";
  const supplierName = (id: string | null) => suppliers.find((s) => s.id === id)?.name ?? "—";
  const spkLines = spkLineRes.data ?? [];
  const spkCodeById = new Map<string, string>();
  (spkRes.data ?? []).forEach((s) => spkCodeById.set(s.id as string, s.code as string));

  // SPK yang bisa dibuat PO (belum dibatalkan).
  const spks: SpkOpt[] = (spkRes.data ?? [])
    .filter((s) => (s.status as string) !== "cancelled")
    .map((s) => ({
      id: s.id as string,
      code: s.code as string,
      brandId: (s.brand_id as string) ?? "",
      brandName: brandName((s.brand_id as string | null) ?? null),
      supplierId: (s.supplier_id as string | null) ?? null,
      supplierName: supplierName((s.supplier_id as string | null) ?? null),
      dueDelivery: (s.due_delivery as string | null) ?? null,
      lines: spkLines.filter((l) => l.spk_id === s.id).map((l) => ({
        id: l.id as string,
        sku: (l.sku as string | null) ?? "",
        size: (l.size as string | null) ?? "",
        productName: (l.product_name as string | null) ?? "",
        qty: Number(l.qty) || 0,
      })),
    }));

  const poLines = poLineRes.data ?? [];
  const rows: ProdPORow[] = (poRes.data ?? []).map((p) => ({
    id: p.id as string,
    code: p.code as string,
    spk_code: spkCodeById.get((p.spk_id as string) ?? "") ?? "—",
    po_date: (p.po_date as string | null) ?? null,
    due_delivery: (p.due_delivery as string | null) ?? null,
    brand_name: brandName((p.brand_id as string | null) ?? null),
    supplier_name: supplierName((p.supplier_id as string | null) ?? null),
    status: (p.status as string) ?? "open",
    notes: (p.notes as string | null) ?? null,
    ppn_percent: Number(p.ppn_percent) || 0,
    ppn_amount: Number(p.ppn_amount) || 0,
    invoice_no: (p.invoice_no as string | null) ?? null,
    lines: poLines.filter((l) => l.po_id === p.id).map((l) => ({
      id: l.id as string,
      sku: (l.sku as string | null) ?? null,
      size: (l.size as string | null) ?? null,
      product_name: (l.product_name as string | null) ?? null,
      qty_spk: (l.qty_spk as string | number) ?? 0,
      qty: (l.qty as string | number) ?? 0,
      unit_cost: (l.unit_cost as string | number) ?? 0,
      received_qty: (l.received_qty as string | number) ?? 0,
    })),
  }));

  return { rows, spks, suppliers };
}

export default async function ProductionPOPage() {
  const { rows, spks, suppliers } = await getData();

  let canEdit = true;
  if (isSupabaseConfigured()) canEdit = canAct(await getRole(createClient()), "prod_po");

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Produksi</p>
          <h1 className="text-2xl font-extrabold">PO Produksi</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            {rows.length} PO. Order jasa produksi (ongkos WIP) ke vendor — kode <b>PO-[Kode SPK]</b>, qty PO manual mengikuti cutting report.
          </p>
        </div>
        {canEdit && <ProdPOForm spks={spks} suppliers={suppliers} />}
      </div>

      {rows.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="font-bold">Belum ada PO Produksi</p>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            Klik &quot;Buat PO Produksi&quot;: pilih SPK → SKU-nya termuat otomatis → isi qty PO &amp; ongkos WIP.
          </p>
        </div>
      ) : (
        <ProdPOList rows={rows} canEdit={canEdit} />
      )}
    </div>
  );
}
