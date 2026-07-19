import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getAccounts } from "@/lib/finance";
import { getRole } from "@/lib/roles";
import { canAct } from "@/lib/permissions";
import { ARView, type ARRow, type ChannelOpt, type BrandOpt, type AccountOpt } from "./ar-view";

async function getData(): Promise<{ rows: ARRow[]; channels: ChannelOpt[]; brands: BrandOpt[]; accounts: AccountOpt[] }> {
  if (!isSupabaseConfigured()) return { rows: [], channels: [], brands: [], accounts: [] };
  const supabase = createClient();
  const [arRes, chanRes, brandRes, payRes, accs, soRes, soLineRes, srRes, srLineRes] = await Promise.all([
    supabase.from("receivables").select("id,code,channel_id,brand_id,bill_to,period,invoice_date,due_date,amount,notes").is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("sales_channels").select("id,name,grup,is_active").is("deleted_at", null).order("name"),
    supabase.from("brands").select("id,name").is("deleted_at", null).order("name"),
    supabase.from("payments").select("ref_key,amount").eq("ref_type", "ar_receipt").eq("direction", "in").is("deleted_at", null),
    getAccounts(supabase),
    supabase.from("sales_orders").select("id,code,brand_id,channel_id,settlement,order_date,commission,ppn").eq("settlement", "ar").is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("sales_order_lines").select("order_id,qty,price").is("deleted_at", null),
    supabase.from("sales_returns").select("id,order_id").is("deleted_at", null),
    supabase.from("sales_return_lines").select("return_id,qty,price").is("deleted_at", null),
  ]);

  const chanName = (id: string | null) => (chanRes.data ?? []).find((c) => c.id === id)?.name ?? "—";
  const brandName = (id: string | null) => (brandRes.data ?? []).find((b) => b.id === id)?.name ?? "Umum";
  const paidByCode = new Map<string, number>();
  (payRes.data ?? []).forEach((p) => { const k = (p.ref_key as string) ?? ""; if (k) paidByCode.set(k, (paidByCode.get(k) ?? 0) + (Number(p.amount) || 0)); });

  const rows: ARRow[] = (arRes.data ?? []).map((r) => {
    const amount = Number(r.amount) || 0;
    const paid = paidByCode.get(r.code as string) ?? 0;
    return {
      id: r.id as string, code: r.code as string, billTo: (r.bill_to as string | null) ?? "",
      channel: chanName((r.channel_id as string | null) ?? null), brand: brandName((r.brand_id as string | null) ?? null),
      period: (r.period as string | null) ?? "",
      invoiceDate: (r.invoice_date as string | null) ?? null, dueDate: (r.due_date as string | null) ?? null,
      amount, paid, status: paid <= 0 ? "unpaid" : paid >= amount ? "paid" : "partial", notes: (r.notes as string | null) ?? "", source: "manual" as const,
    };
  });

  // Penjualan konsinyasi (settlement=ar) → tampil sebagai piutang (nyambung otomatis).
  const soLines = soLineRes.data ?? [];
  const srLines = srLineRes.data ?? [];
  const retByOrder = new Map<string, number>();
  for (const sr of srRes.data ?? []) {
    const oid = (sr.order_id as string | null) ?? ""; if (!oid) continue;
    const v = srLines.filter((l) => l.return_id === sr.id).reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
    retByOrder.set(oid, (retByOrder.get(oid) ?? 0) + v);
  }
  for (const o of soRes.data ?? []) {
    const net = soLines.filter((l) => l.order_id === o.id).reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
    const amount = Math.max(0, net + (Number(o.ppn) || 0) - (Number(o.commission) || 0) - (retByOrder.get(o.id as string) ?? 0));
    if (amount <= 0) continue;
    const paid = paidByCode.get(o.code as string) ?? 0;
    rows.push({
      id: o.id as string, code: o.code as string, billTo: chanName((o.channel_id as string | null) ?? null),
      channel: chanName((o.channel_id as string | null) ?? null), brand: brandName((o.brand_id as string | null) ?? null),
      period: "", invoiceDate: (o.order_date as string | null) ?? null, dueDate: null,
      amount, paid, status: paid <= 0 ? "unpaid" : paid >= amount ? "paid" : "partial", notes: "Dari penjualan konsinyasi", source: "sales" as const,
    });
  }

  const brands: BrandOpt[] = (brandRes.data ?? []).map((b) => ({ id: b.id as string, name: b.name as string }));

  // Untuk form: prioritaskan store offline (konsinyasi), tetap tampilkan semua channel aktif.
  const channelsAll = (chanRes.data ?? []).filter((c) => c.is_active !== false);
  const channels: ChannelOpt[] = [
    ...channelsAll.filter((c) => (c.grup as string) === "offline"),
    ...channelsAll.filter((c) => (c.grup as string) !== "offline"),
  ].map((c) => ({ id: c.id as string, name: c.name as string }));

  return { rows, channels, brands, accounts: accs.map((a) => ({ id: a.id, name: a.name, balance: a.balance })) };
}

export default async function ARPage() {
  const { rows, channels, brands, accounts } = await getData();
  let canEdit = true, canReceive = true;
  if (isSupabaseConfigured()) {
    const role = await getRole(createClient());
    canEdit = canAct(role, "fin_other");
    canReceive = canAct(role, "sales_penerimaan");
  }
  return (
    <div className="mx-auto max-w-7xl">
      <ARView rows={rows} channels={channels} brands={brands} accounts={accounts} canEdit={canEdit} canReceive={canReceive} />
    </div>
  );
}
