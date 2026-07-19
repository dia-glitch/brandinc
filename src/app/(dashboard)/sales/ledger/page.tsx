import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { LedgerView, type LedgerRow, type Opt } from "./ledger-view";

async function getData(): Promise<{ rows: LedgerRow[]; brands: Opt[]; channels: Opt[] }> {
  if (!isSupabaseConfigured()) return { rows: [], brands: [], channels: [] };
  const supabase = createClient();
  const [soRes, lineRes, brandRes, chanRes, srRes, srLineRes] = await Promise.all([
    supabase.from("sales_orders").select("id,code,brand_id,channel_id,settlement,ext_order_id,order_date").is("deleted_at", null),
    supabase.from("sales_order_lines").select("order_id,ext_order_id,sku,size,product_name,qty,retail,price,cogm").is("deleted_at", null),
    supabase.from("brands").select("id,name").is("deleted_at", null).order("name"),
    supabase.from("sales_channels").select("id,name").is("deleted_at", null).order("name"),
    supabase.from("sales_returns").select("id,code,brand_id,channel_id,settlement,return_date").is("deleted_at", null),
    supabase.from("sales_return_lines").select("return_id,sku,size,product_name,qty,price,cogm").is("deleted_at", null),
  ]);

  const brands = (brandRes.data ?? []).map((b) => ({ id: b.id as string, name: b.name as string }));
  const channels = (chanRes.data ?? []).map((c) => ({ id: c.id as string, name: c.name as string }));
  const brandName = (id: string | null) => brands.find((b) => b.id === id)?.name ?? "—";
  const chanName = (id: string | null) => channels.find((c) => c.id === id)?.name ?? "—";
  const orders = new Map((soRes.data ?? []).map((o) => [o.id as string, o]));

  const rows: LedgerRow[] = [];
  for (const l of lineRes.data ?? []) {
    const o = orders.get(l.order_id as string);
    if (!o) continue;
    const qty = Number(l.qty) || 0;
    const retail = Number(l.retail) || 0;
    const price = Number(l.price) || 0;
    const cogm = Number(l.cogm) || 0;
    const gross = qty * retail;
    const net = qty * price;
    const cogs = qty * cogm;
    rows.push({
      date: (o.order_date as string | null) ?? null, code: o.code as string,
      orderId: (l.ext_order_id as string | null) || (o.ext_order_id as string | null) || "",
      brand: brandName((o.brand_id as string | null) ?? null), brandId: (o.brand_id as string | null) ?? null,
      channel: chanName((o.channel_id as string | null) ?? null), settlement: (o.settlement as string) ?? "ar",
      sku: (l.sku as string | null) ?? "", product: (l.product_name as string | null) ?? "", size: (l.size as string | null) ?? "",
      qty, retail, price, discount: Math.max(0, gross - net), cogm, net, cogs, profit: net - cogs,
    });
  }
  // Baris RETUR (negatif) — supaya pergerakan terlihat −n.
  const returns = new Map((srRes.data ?? []).map((r) => [r.id as string, r]));
  for (const l of srLineRes.data ?? []) {
    const r = returns.get(l.return_id as string);
    if (!r) continue;
    const qty = -(Number(l.qty) || 0);
    const price = Number(l.price) || 0;
    const cogm = Number(l.cogm) || 0;
    if (qty === 0) continue;
    rows.push({
      date: (r.return_date as string | null) ?? null, code: r.code as string, orderId: "",
      brand: brandName((r.brand_id as string | null) ?? null), brandId: (r.brand_id as string | null) ?? null,
      channel: chanName((r.channel_id as string | null) ?? null), settlement: (r.settlement as string) ?? "ar",
      sku: (l.sku as string | null) ?? "", product: (l.product_name as string | null) ?? "", size: (l.size as string | null) ?? "",
      qty, retail: price, price, discount: 0, cogm, net: qty * price, cogs: qty * cogm, profit: qty * price - qty * cogm,
    });
  }

  rows.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || a.sku.localeCompare(b.sku));

  return { rows, brands, channels };
}

export default async function SalesLedgerPage() {
  const { rows, brands, channels } = await getData();
  return (
    <div className="mx-auto max-w-7xl">
      <LedgerView rows={rows} brands={brands} channels={channels} />
    </div>
  );
}
