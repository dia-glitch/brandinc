import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getRole } from "@/lib/roles";
import { canAct } from "@/lib/permissions";
import type { WarehouseOpt } from "../incoming-form";
import type { IncRow } from "../incoming-list";
import { IncomingDetail, type POInfo } from "./incoming-detail";

export default async function IncomingDetailPage({ params }: { params: { poId: string } }) {
  if (!isSupabaseConfigured()) notFound();
  const supabase = createClient();
  const poId = params.poId;

  const { data: po } = await supabase
    .from("production_pos")
    .select("id,code,brand_id,spk_id,supplier_id,status")
    .eq("id", poId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!po) notFound();

  const [poLineRes, spkRes, brandRes, supRes, rcptRes, whRes, varRes] = await Promise.all([
    supabase.from("production_po_lines").select("sku,size,product_name,qty,unit_cost,received_qty").eq("po_id", poId).is("deleted_at", null),
    po.spk_id ? supabase.from("work_orders").select("code").eq("id", po.spk_id as string).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("brands").select("id,name").is("deleted_at", null),
    supabase.from("suppliers").select("id,name").is("deleted_at", null),
    supabase.from("fg_receipts").select("id,code,po_id,brand_id,supplier_id,receipt_date,incoming_no,status,invoice_no").eq("po_id", poId).is("deleted_at", null).order("incoming_no", { ascending: true }),
    supabase.from("warehouses").select("id,name,kind,brand_id").is("deleted_at", null).order("name"),
    supabase.from("product_variants").select("id,sku").is("deleted_at", null),
  ]);

  const brands = brandRes.data ?? [];
  const suppliers = supRes.data ?? [];
  const brandName = (id: string | null) => brands.find((b) => b.id === id)?.name ?? "—";
  const supplierName = (id: string | null) => suppliers.find((s) => s.id === id)?.name ?? "—";
  const poLines = poLineRes.data ?? [];
  const receipts = rcptRes.data ?? [];

  const warehouses: WarehouseOpt[] = (whRes.data ?? []).map((w) => ({
    id: w.id as string, name: w.name as string, kind: (w.kind as string) ?? "warehouse", brandId: (w.brand_id as string | null) ?? null,
  }));

  // Baris receipt untuk PO ini.
  const receiptIds = receipts.map((r) => r.id as string);
  const { data: rLineData } = receiptIds.length
    ? await supabase.from("fg_receipt_lines").select("id,receipt_id,variant_id,sku,size,product_name,qty_incoming,qty_good,qty_repair,qty_damage,unit_cost").in("receipt_id", receiptIds).is("deleted_at", null)
    : { data: [] as unknown[] };
  const rLines = (rLineData ?? []) as Array<Record<string, unknown>>;
  const poCode = po.code as string;

  const rows: IncRow[] = receipts.map((r) => ({
    id: r.id as string,
    code: r.code as string,
    po_id: poId,
    po_code: poCode,
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

  const info: POInfo = {
    poId,
    poCode,
    spkCode: ((spkRes.data as { code?: string } | null)?.code as string) ?? "—",
    supplier: supplierName((po.supplier_id as string | null) ?? null),
    product: (poLines[0]?.product_name as string) ?? "—",
    brand: brandName((po.brand_id as string | null) ?? null),
    totalQtyPo: poLines.reduce((s, l) => s + (Number(l.qty) || 0), 0),
    status: (po.status as string) ?? "in_progress",
  };

  let canEdit = true;
  if (isSupabaseConfigured()) canEdit = canAct(await getRole(supabase), "fg_incoming_qc");

  return <IncomingDetail info={info} rows={rows} warehouses={warehouses} canEdit={canEdit} />;
}
