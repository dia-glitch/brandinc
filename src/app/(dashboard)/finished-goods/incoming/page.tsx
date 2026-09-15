import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getRole } from "@/lib/roles";
import { canAct } from "@/lib/permissions";
import type { WarehouseOpt } from "./incoming-form";
import { IncomingList, type IncRow, type POStub } from "./incoming-list";

async function getData() {
  if (!isSupabaseConfigured()) return { poStubs: [] as POStub[], warehouses: [] as WarehouseOpt[], rows: [] as IncRow[] };
  const supabase = createClient();
  const [poRes, poLineRes, brandRes, supRes, whRes, rcptRes, rLineRes] = await Promise.all([
    supabase.from("production_pos").select("id,code,brand_id,spk_id,supplier_id,status,delivered_at").is("deleted_at", null).order("code", { ascending: false }),
    supabase.from("production_po_lines").select("po_id,product_name").is("deleted_at", null),
    supabase.from("brands").select("id,name").is("deleted_at", null),
    supabase.from("suppliers").select("id,name").is("deleted_at", null),
    supabase.from("warehouses").select("id,name,kind,brand_id").is("deleted_at", null).order("name"),
    supabase.from("fg_receipts").select("id,code,po_id,brand_id,supplier_id,receipt_date,incoming_no,status,invoice_no").is("deleted_at", null).order("code", { ascending: false }),
    supabase.from("fg_receipt_lines").select("id,receipt_id,variant_id,sku,size,product_name,qty_incoming,qty_good,qty_repair,qty_damage,unit_cost").is("deleted_at", null),
  ]);

  const brands = (brandRes.data ?? []).map((b) => ({ id: b.id as string, name: b.name as string }));
  const suppliers = (supRes.data ?? []).map((s) => ({ id: s.id as string, name: s.name as string }));
  const brandName = (id: string | null) => brands.find((b) => b.id === id)?.name ?? "—";
  const supplierName = (id: string | null) => suppliers.find((s) => s.id === id)?.name ?? "—";
  const poCodeById = new Map<string, string>();
  const poClosedById = new Map<string, boolean>();
  (poRes.data ?? []).forEach((p) => { poCodeById.set(p.id as string, p.code as string); poClosedById.set(p.id as string, Boolean(p.delivered_at)); });

  const poLines = poLineRes.data ?? [];
  const productByPo = new Map<string, string>();
  for (const l of poLines) {
    const pid = l.po_id as string;
    if (!productByPo.has(pid) && l.product_name) productByPo.set(pid, l.product_name as string);
  }

  const warehouses = (whRes.data ?? []).map((w) => ({ id: w.id as string, name: w.name as string, kind: (w.kind as string) ?? "warehouse", brandId: (w.brand_id as string | null) ?? null }));

  // Semua PO Produksi (belum dibatalkan) otomatis muncul di daftar inbound.
  const poStubs: POStub[] = (poRes.data ?? [])
    .filter((p) => (p.status as string) !== "cancelled")
    .map((p) => ({
      poId: p.id as string,
      poCode: p.code as string,
      brand: brandName((p.brand_id as string | null) ?? null),
      brandId: (p.brand_id as string | null) ?? null,
      supplier: supplierName((p.supplier_id as string | null) ?? null),
      product: productByPo.get(p.id as string) ?? "—",
      closed: Boolean(p.delivered_at),
    }));

  const rLines = rLineRes.data ?? [];
  const rows: IncRow[] = (rcptRes.data ?? []).map((r) => ({
    id: r.id as string,
    code: r.code as string,
    po_id: (r.po_id as string) ?? "",
    po_code: poCodeById.get((r.po_id as string) ?? "") ?? "—",
    brand_id: (r.brand_id as string | null) ?? null,
    brand_name: brandName((r.brand_id as string | null) ?? null),
    supplier_name: supplierName((r.supplier_id as string | null) ?? null),
    receipt_date: (r.receipt_date as string | null) ?? null,
    incoming_no: (r.incoming_no as number) ?? 1,
    status: (r.status as string) ?? "inbound",
    invoice_no: (r.invoice_no as string | null) ?? null,
    po_closed: poClosedById.get((r.po_id as string) ?? "") ?? false,
    product_name: (rLines.find((l) => l.receipt_id === r.id)?.product_name as string | undefined) ?? "",
    lines: rLines.filter((l) => l.receipt_id === r.id).map((l) => ({
      id: l.id as string,
      variant_id: (l.variant_id as string | null) ?? null,
      sku: (l.sku as string | null) ?? null,
      size: (l.size as string | null) ?? null,
      product_name: (l.product_name as string | null) ?? null,
      qty_incoming: (l.qty_incoming as string | number) ?? 0,
      qty_good: (l.qty_good as string | number) ?? 0,
      qty_repair: (l.qty_repair as string | number) ?? 0,
      qty_damage: (l.qty_damage as string | number) ?? 0,
      unit_cost: (l.unit_cost as string | number) ?? 0,
    })),
  }));

  return { poStubs, warehouses, rows };
}

export default async function IncomingPage() {
  const { poStubs, warehouses, rows } = await getData();

  let canEdit = true;
  if (isSupabaseConfigured()) canEdit = canAct(await getRole(createClient()), "fg_incoming_qc");

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Finished Goods</p>
        <h1 className="text-2xl font-extrabold">Incoming &amp; QC</h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          {poStubs.length} PO Produksi. Setiap PO yang dibuat otomatis masuk ke sini — klik <b>Terima</b> untuk catat barang datang, lalu QC bertahap (Good ke gudang brand, Damage ke gudang damage).
        </p>
      </div>

      {poStubs.length === 0 && rows.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="font-bold">Belum ada PO Produksi</p>
          <p className="mt-1 text-sm font-medium text-muted-foreground">Buat PO Produksi dulu di Production → PO Produksi. Setelah dibuat, PO-nya otomatis muncul di sini untuk diterima.</p>
        </div>
      ) : (
        <IncomingList rows={rows} pos={poStubs} warehouses={warehouses} canEdit={canEdit} />
      )}
    </div>
  );
}
