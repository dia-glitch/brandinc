import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getRole } from "@/lib/roles";
import { canAct } from "@/lib/permissions";
import { InvoiceView, type InvRow } from "./invoice-view";

async function getData(): Promise<{ rows: InvRow[] }> {
  if (!isSupabaseConfigured()) return { rows: [] };
  const supabase = createClient();
  const [rcptRes, rLineRes, poRes, brandRes, supRes] = await Promise.all([
    supabase.from("fg_receipts").select("id,code,po_id,brand_id,supplier_id,receipt_date,incoming_no,status,invoice_no,invoice_date").is("deleted_at", null).order("code", { ascending: false }),
    supabase.from("fg_receipt_lines").select("receipt_id,product_name,qty_good,unit_cost").is("deleted_at", null),
    supabase.from("production_pos").select("id,code").is("deleted_at", null),
    supabase.from("brands").select("id,name").is("deleted_at", null),
    supabase.from("suppliers").select("id,name").is("deleted_at", null),
  ]);

  const poCode = new Map<string, string>();
  (poRes.data ?? []).forEach((p) => poCode.set(p.id as string, p.code as string));
  const brandName = (id: string | null) => (brandRes.data ?? []).find((b) => b.id === id)?.name ?? "—";
  const supName = (id: string | null) => (supRes.data ?? []).find((s) => s.id === id)?.name ?? "—";
  const lines = rLineRes.data ?? [];

  const rows: InvRow[] = (rcptRes.data ?? [])
    .filter((r) => (r.status as string) !== "inbound") // sudah QC
    .map((r) => {
      const rl = lines.filter((l) => l.receipt_id === r.id);
      const good = rl.reduce((s, l) => s + (Number(l.qty_good) || 0), 0);
      const value = rl.reduce((s, l) => s + (Number(l.qty_good) || 0) * (Number(l.unit_cost) || 0), 0);
      return {
        id: r.id as string,
        code: r.code as string,
        poCode: poCode.get((r.po_id as string) ?? "") ?? "—",
        product: (rl[0]?.product_name as string) ?? "—",
        brand: brandName((r.brand_id as string | null) ?? null),
        brandId: (r.brand_id as string | null) ?? null,
        supplier: supName((r.supplier_id as string | null) ?? null),
        date: (r.receipt_date as string | null) ?? null,
        good,
        value: Math.round(value),
        invoiceNo: (r.invoice_no as string | null) ?? null,
        invoiceDate: (r.invoice_date as string | null) ?? null,
      };
    })
    .filter((r) => r.good > 0 || r.invoiceNo);

  return { rows };
}

export default async function FGInvoicePage() {
  const { rows } = await getData();
  let canInvoice = true;
  if (isSupabaseConfigured()) canInvoice = canAct(await getRole(createClient()), "fg_incoming_qc");
  return <InvoiceView rows={rows} canInvoice={canInvoice} />;
}
