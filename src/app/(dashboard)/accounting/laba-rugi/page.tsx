import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { coaCategory } from "@/lib/coa";
import { PnlView, type Entry, type Expense, type BrandOpt, type ChannelOpt } from "./pnl-view";

async function getData(): Promise<{ entries: Entry[]; expenses: Expense[]; brands: BrandOpt[]; channels: ChannelOpt[] }> {
  if (!isSupabaseConfigured()) return { entries: [], expenses: [], brands: [], channels: [] };
  const supabase = createClient();
  const [entRes, expRes, brandRes, chanRes, prRes, cpRes, soRes, soLineRes, srRes, srLineRes] = await Promise.all([
    supabase.from("sales_entries").select("id,brand_id,channel_id,period,entry_date,gross,discount,hpp,commission,ppn,notes").is("deleted_at", null).order("entry_date", { ascending: false }),
    supabase.from("expenses").select("brand_id,category,amount,expense_date").is("deleted_at", null),
    supabase.from("brands").select("id,name").is("deleted_at", null).order("name"),
    supabase.from("sales_channels").select("id,name,is_active").is("deleted_at", null).order("name"),
    supabase.from("payment_requests").select("id,brand_id,category,type,amount,status,settled_amount,settled_at,paid_at,scheduled_date,source_pr_id,created_at").is("deleted_at", null),
    supabase.from("cash_purchases").select("pr_id").is("deleted_at", null),
    supabase.from("sales_orders").select("id,brand_id,order_date,discount,commission,ppn").is("deleted_at", null),
    supabase.from("sales_order_lines").select("order_id,qty,retail,price,cogm").is("deleted_at", null),
    supabase.from("sales_returns").select("id,brand_id,return_date").is("deleted_at", null),
    supabase.from("sales_return_lines").select("return_id,qty,price,cogm").is("deleted_at", null),
  ]);

  const brands = (brandRes.data ?? []).map((b) => ({ id: b.id as string, name: b.name as string }));
  const chanName = (id: string | null) => (chanRes.data ?? []).find((c) => c.id === id)?.name ?? "";
  const entries: Entry[] = (entRes.data ?? []).map((e) => ({
    id: e.id as string, brandId: (e.brand_id as string | null) ?? null, channel: chanName((e.channel_id as string | null) ?? null),
    period: (e.period as string | null) ?? "", date: (e.entry_date as string | null) ?? null,
    gross: Number(e.gross) || 0, discount: Number(e.discount) || 0, hpp: Number(e.hpp) || 0,
    commission: Number(e.commission) || 0, ppn: Number(e.ppn) || 0, notes: (e.notes as string | null) ?? "",
  }));
  const expenses: Expense[] = (expRes.data ?? []).map((e) => ({
    brandId: (e.brand_id as string | null) ?? null, category: coaCategory(e.category as string | null),
    amount: Number(e.amount) || 0, date: (e.expense_date as string | null) ?? null,
  }));

  // Beban dari Payment Request yang benar-benar jadi biaya (tidak dobel dgn inventory).
  const inventoryPrIds = new Set((cpRes.data ?? []).map((c) => (c.pr_id as string | null) ?? "").filter(Boolean));
  const REALIZED = new Set(["approved", "scheduled", "paid"]);
  const dPart = (v: unknown) => (typeof v === "string" && v ? v.slice(0, 10) : null);
  for (const p of prRes.data ?? []) {
    const id = p.id as string;
    const type = (p.type as string) ?? "";
    const status = (p.status as string) ?? "";
    const brandId = (p.brand_id as string | null) ?? null;
    const category = coaCategory(p.category as string | null);
    const sourcePr = (p.source_pr_id as string | null) ?? null;
    let amount = 0;
    let date: string | null = null;
    if (type === "cash_advance") {
      // CA yang dipakai beli bahan (ada cash purchase) = inventory, bukan beban.
      if (status !== "settled" || inventoryPrIds.has(id)) continue;
      amount = p.settled_amount != null ? Number(p.settled_amount) : Number(p.amount) || 0;
      date = dPart(p.settled_at) ?? dPart(p.paid_at) ?? dPart(p.scheduled_date) ?? dPart(p.created_at);
    } else if (type === "reimbursement") {
      // Reimbursement otomatis dari kelebihan CA (sourcePr terisi) sudah tercakup di realisasi CA → skip.
      if (sourcePr || !REALIZED.has(status)) continue;
      amount = Number(p.amount) || 0;
      date = dPart(p.paid_at) ?? dPart(p.scheduled_date) ?? dPart(p.created_at);
    } else if (type === "invoice") {
      if (!REALIZED.has(status)) continue;
      amount = Number(p.amount) || 0;
      date = dPart(p.paid_at) ?? dPart(p.scheduled_date) ?? dPart(p.created_at);
    } else continue;
    if (amount > 0) expenses.push({ brandId, category, amount, date });
  }

  // Penjualan (Sales Order) → revenue + COGS otomatis per brand (accrual).
  const soLines = soLineRes.data ?? [];
  for (const o of soRes.data ?? []) {
    const lines = soLines.filter((l) => l.order_id === o.id);
    // Bruto = harga retail × qty; Neto = harga jual × qty; Diskon = selisihnya (hindari dobel diskon).
    const gross = lines.reduce((s, l) => { const q = Number(l.qty) || 0; const retail = Number(l.retail) || Number(l.price) || 0; return s + q * retail; }, 0);
    const net = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
    const hpp = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.cogm) || 0), 0);
    if (gross <= 0 && hpp <= 0) continue;
    entries.push({
      id: `so-${o.id as string}`, brandId: (o.brand_id as string | null) ?? null, channel: "Penjualan", period: "",
      date: (o.order_date as string | null) ?? null, gross, discount: Math.max(0, gross - net), hpp,
      commission: Number(o.commission) || 0, ppn: Number(o.ppn) || 0, notes: "auto dari Sales",
    });
  }

  // Return Penjualan → balik revenue & COGS per brand (entri negatif).
  const srLines = srLineRes.data ?? [];
  for (const r of srRes.data ?? []) {
    const lines = srLines.filter((l) => l.return_id === r.id);
    const net = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
    const hpp = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.cogm) || 0), 0);
    if (net <= 0 && hpp <= 0) continue;
    entries.push({
      id: `sr-${r.id as string}`, brandId: (r.brand_id as string | null) ?? null, channel: "Retur", period: "",
      date: (r.return_date as string | null) ?? null, gross: net, discount: 0, hpp,
      commission: 0, ppn: 0, notes: "retur penjualan", isReturn: true,
    });
  }

  const channels: ChannelOpt[] = (chanRes.data ?? []).filter((c) => c.is_active !== false).map((c) => ({ id: c.id as string, name: c.name as string }));

  return { entries, expenses, brands, channels };
}

export default async function LabaRugiPage() {
  const { entries, expenses, brands, channels } = await getData();
  return (
    <div className="mx-auto max-w-4xl">
      <PnlView entries={entries} expenses={expenses} brands={brands} channels={channels} />
    </div>
  );
}
