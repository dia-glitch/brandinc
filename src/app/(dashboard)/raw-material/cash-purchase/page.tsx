import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getRole } from "@/lib/roles";
import { canAct } from "@/lib/permissions";
import { CPView, type CPRow, type MaterialOpt, type WarehouseOpt, type CashAdvanceOpt } from "./cp-view";
import type { Attachment } from "./actions";

async function getData(): Promise<{ rows: CPRow[]; materials: MaterialOpt[]; warehouses: WarehouseOpt[]; cashAdvances: CashAdvanceOpt[] }> {
  if (!isSupabaseConfigured()) return { rows: [], materials: [], warehouses: [], cashAdvances: [] };
  const supabase = createClient();
  const [matRes, whRes, cpRes, cpLineRes, caRes] = await Promise.all([
    supabase.from("materials").select("id,name,code,unit").is("deleted_at", null).eq("is_active", true).order("name"),
    supabase.from("warehouses").select("id,name,kind").is("deleted_at", null).order("name"),
    supabase.from("cash_purchases").select("id,code,pr_id,vendor,nota_no,warehouse_id,purchase_date,total,notes,attachments").is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("cash_purchase_lines").select("purchase_id,material_name,unit,qty,unit_price").is("deleted_at", null),
    supabase.from("payment_requests").select("id,code,payee,amount,type,status").eq("type", "cash_advance").eq("status", "paid").is("deleted_at", null).order("created_at", { ascending: false }),
  ]);

  const materials: MaterialOpt[] = (matRes.data ?? []).map((m) => ({ id: m.id as string, name: m.name as string, code: (m.code as string | null) ?? null, unit: (m.unit as string | null) ?? null }));
  const whAll = (whRes.data ?? []).map((w) => ({ id: w.id as string, name: w.name as string, kind: (w.kind as string) ?? "warehouse" }));
  const warehouses: WarehouseOpt[] = whAll.filter((w) => w.kind === "material" || w.kind === "warehouse").map((w) => ({ id: w.id, name: w.name }));
  const whName = (id: string | null) => whAll.find((w) => w.id === id)?.name ?? "—";

  const cpLines = cpLineRes.data ?? [];
  const cpList = cpRes.data ?? [];

  // Terpakai per cash advance = jumlah total pembelian tunai yang mengacu pr_id.
  const usedByPr = new Map<string, number>();
  for (const cp of cpList) {
    const pr = (cp.pr_id as string | null) ?? "";
    if (pr) usedByPr.set(pr, (usedByPr.get(pr) ?? 0) + (Number(cp.total) || 0));
  }
  const caCode = (id: string | null) => (caRes.data ?? []).find((c) => c.id === id)?.code ?? "—";

  const cashAdvances: CashAdvanceOpt[] = (caRes.data ?? []).map((c) => {
    const amount = Number(c.amount) || 0;
    const used = usedByPr.get(c.id as string) ?? 0;
    return { id: c.id as string, code: c.code as string, payee: (c.payee as string | null) ?? "", amount, used, remaining: Math.max(0, amount - used) };
  });

  const rows: CPRow[] = cpList.map((cp) => ({
    id: cp.id as string, code: cp.code as string, caCode: caCode((cp.pr_id as string | null) ?? null),
    vendor: (cp.vendor as string | null) ?? "", notaNo: (cp.nota_no as string | null) ?? "",
    warehouse: whName((cp.warehouse_id as string | null) ?? null), date: (cp.purchase_date as string | null) ?? null,
    total: Number(cp.total) || 0, notes: (cp.notes as string | null) ?? "",
    attachments: Array.isArray(cp.attachments) ? (cp.attachments as Attachment[]) : [],
    lines: cpLines.filter((l) => l.purchase_id === cp.id).map((l) => ({ name: (l.material_name as string | null) ?? "—", unit: (l.unit as string | null) ?? "", qty: Number(l.qty) || 0, unitPrice: Number(l.unit_price) || 0 })),
  }));

  return { rows, materials, warehouses, cashAdvances };
}

export default async function CashPurchasePage() {
  const { rows, materials, warehouses, cashAdvances } = await getData();
  let canEdit = true;
  if (isSupabaseConfigured()) canEdit = canAct(await getRole(createClient()), "rm_cash");
  return (
    <div className="mx-auto max-w-7xl">
      <CPView rows={rows} materials={materials} warehouses={warehouses} cashAdvances={cashAdvances} canEdit={canEdit} />
    </div>
  );
}
