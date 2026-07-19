import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { IncomingForm, type POOpt, type WarehouseOpt } from "./incoming-form";
import { IncomingList, type IncRow } from "./incoming-list";

async function getData() {
  if (!isSupabaseConfigured()) return { pos: [] as POOpt[], warehouses: [] as WarehouseOpt[], rows: [] as IncRow[] };
  const supabase = createClient();
  const [poRes, poLineRes, varRes, brandRes, supRes, whRes, rcptRes, rLineRes] = await Promise.all([
    supabase.from("production_pos").select("id,code,brand_id,spk_id,supplier_id,status").is("deleted_at", null).order("code", { ascending: false }),
    supabase.from("production_po_lines").select("po_id,sku,size,product_name,qty,unit_cost,received_qty").is("deleted_at", null),
    supabase.from("product_variants").select("id,sku").is("deleted_at", null),
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
  const variantBySku = new Map<string, string>();
  (varRes.data ?? []).forEach((v) => variantBySku.set(v.sku as string, v.id as string));
  const poCodeById = new Map<string, string>();
  (poRes.data ?? []).forEach((p) => poCodeById.set(p.id as string, p.code as string));
  const poLines = poLineRes.data ?? [];

  const warehouses = (whRes.data ?? []).map((w) => ({ id: w.id as string, name: w.name as string, kind: (w.kind as string) ?? "warehouse", brandId: (w.brand_id as string | null) ?? null }));

  // PO yang sudah pernah diterima (punya fg_receipt) tidak boleh diterima lagi (initial 1x).
  const receivedPoIds = new Set<string>((rcptRes.data ?? []).map((r) => (r.po_id as string) ?? ""));

  const pos: POOpt[] = (poRes.data ?? [])
    .filter((p) => (p.status as string) !== "cancelled" && !receivedPoIds.has(p.id as string))
    .map((p) => ({
      id: p.id as string,
      code: p.code as string,
      brandId: (p.brand_id as string) ?? "",
      brandName: brandName((p.brand_id as string | null) ?? null),
      spkId: (p.spk_id as string | null) ?? null,
      supplierId: (p.supplier_id as string | null) ?? null,
      lines: poLines.filter((l) => l.po_id === p.id).map((l) => ({
        variantId: variantBySku.get((l.sku as string) ?? "") ?? null,
        sku: (l.sku as string | null) ?? "",
        size: (l.size as string | null) ?? "",
        productName: (l.product_name as string | null) ?? "",
        qtyPo: Number(l.qty) || 0,
        alreadyGood: Number(l.received_qty) || 0,
        unitCost: Number(l.unit_cost) || 0,
      })),
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

  return { pos, warehouses, rows };
}

export default async function IncomingPage() {
  const { pos, warehouses, rows } = await getData();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Finished Goods</p>
          <h1 className="text-2xl font-extrabold">Incoming &amp; QC</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            {rows.length} penerimaan. Alur bertahap: Inbound → Proses QC → (Repair → Terima Repair → QC lagi). Good ke gudang brand, Damage ke gudang damage.
          </p>
        </div>
        <IncomingForm pos={pos} />
      </div>

      {rows.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="font-bold">Belum ada penerimaan</p>
          <p className="mt-1 text-sm font-medium text-muted-foreground">Klik &quot;Inbound Barang&quot;: pilih PO Produksi → catat qty datang. QC menyusul di tahap berikutnya.</p>
        </div>
      ) : (
        <IncomingList rows={rows} warehouses={warehouses} />
      )}
    </div>
  );
}
