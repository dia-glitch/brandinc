import type { createClient } from "@/lib/supabase/server";
import { getSkuCosting } from "@/lib/costing";

type SB = ReturnType<typeof createClient>;

export type Period = "today" | "week" | "month" | "year";

export type BrandStat = { name: string; net: number; qty: number; orders: number };
export type ChannelStat = { name: string; grup: string; net: number; qty: number; orders: number };
export type ProductStat = { sku: string; name: string; qty: number; revenue: number };

export type DashData = {
  period: Period;
  periodLabel: string;
  netSales: number; netSalesPrev: number;
  orders: number; qty: number;
  cogs: number; grossProfit: number; grossMargin: number;
  returnValue: number; returnQty: number;
  inventoryValue: number; fgValue: number; rawValue: number;
  brands: BrandStat[];
  channels: ChannelStat[];
  topProducts: ProductStat[];
  chart: { m: string; revenue: number; orders: number }[];
};

const ID_MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const ID_MONTHS_FULL = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function ymd(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

function ranges(period: Period) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start: Date, end: Date, prevStart: Date, prevEnd: Date, label: string;
  if (period === "today") {
    start = today;
    end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    prevStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    prevEnd = today;
    label = "Hari Ini";
  } else if (period === "week") {
    const dow = (today.getDay() + 6) % 7; // Senin = 0
    start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dow);
    end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
    prevStart = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 7);
    prevEnd = start;
    label = "Minggu Ini";
  } else if (period === "year") {
    start = new Date(today.getFullYear(), 0, 1);
    end = new Date(today.getFullYear() + 1, 0, 1);
    prevStart = new Date(today.getFullYear() - 1, 0, 1);
    prevEnd = start;
    label = `Tahun ${today.getFullYear()}`;
  } else {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
    end = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    prevStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    prevEnd = start;
    label = `${ID_MONTHS_FULL[today.getMonth()]} ${today.getFullYear()}`;
  }
  return { startS: ymd(start), endS: ymd(end), prevStartS: ymd(prevStart), prevEndS: ymd(prevEnd), label };
}

export async function getDashboardData(supabase: SB, period: Period = "month"): Promise<DashData> {
  const { startS, endS, prevStartS, prevEndS, label } = ranges(period);
  const inCur = (d: string) => d >= startS && d < endS;
  const inPrev = (d: string) => d >= prevStartS && d < prevEndS;

  const [soRes, soLineRes, srRes, srLineRes, fgBalRes, varRes, matBalRes, brandRes, chanRes, skuCost] = await Promise.all([
    supabase.from("sales_orders").select("id,order_date,brand_id,channel_id").is("deleted_at", null),
    supabase.from("sales_order_lines").select("order_id,sku,product_name,qty,price,cogm").is("deleted_at", null),
    supabase.from("sales_returns").select("id,return_date,brand_id,channel_id").is("deleted_at", null),
    supabase.from("sales_return_lines").select("return_id,sku,product_name,qty,price,cogm").is("deleted_at", null),
    supabase.from("stock_balances").select("variant_id,qty_on_hand,moving_avg_cost,stock_status").eq("stock_status", "available").is("deleted_at", null),
    supabase.from("product_variants").select("id,sku").is("deleted_at", null),
    supabase.from("material_stock_balances").select("qty_on_hand,moving_avg_cost").is("deleted_at", null),
    supabase.from("brands").select("id,name").is("deleted_at", null),
    supabase.from("sales_channels").select("id,name,grup").is("deleted_at", null),
    getSkuCosting(supabase),
  ]);

  const brandName = new Map((brandRes.data ?? []).map((b) => [b.id as string, (b.name as string) ?? "—"]));
  const chanInfo = new Map((chanRes.data ?? []).map((c) => [c.id as string, { name: (c.name as string) ?? "—", grup: (c.grup as string) ?? "online" }]));
  const orderInfo = new Map((soRes.data ?? []).map((o) => [o.id as string, {
    date: ((o.order_date as string | null) ?? "").slice(0, 10),
    brand: (o.brand_id as string | null) ?? "",
    chan: (o.channel_id as string | null) ?? "",
  }]));

  // Akumulator periode terpilih
  let netSales = 0, netSalesPrev = 0, cogs = 0, qty = 0;
  const orderSet = new Set<string>();
  const brandAgg = new Map<string, { net: number; qty: number; orders: Set<string> }>();
  const chanAgg = new Map<string, { net: number; qty: number; orders: Set<string> }>();
  const prodAgg = new Map<string, { name: string; qty: number; revenue: number }>();
  const netByMonth = new Map<string, number>();
  const ordersByMonth = new Map<string, Set<string>>();

  for (const l of soLineRes.data ?? []) {
    const info = orderInfo.get(l.order_id as string);
    if (!info || !info.date) continue;
    const q = Number(l.qty) || 0;
    const amt = q * (Number(l.price) || 0);
    const cost = q * (Number(l.cogm) || 0);
    const mon = info.date.slice(0, 7);
    netByMonth.set(mon, (netByMonth.get(mon) ?? 0) + amt);
    if (!ordersByMonth.has(mon)) ordersByMonth.set(mon, new Set());
    ordersByMonth.get(mon)!.add(l.order_id as string);

    if (inPrev(info.date)) netSalesPrev += amt;
    if (!inCur(info.date)) continue;
    netSales += amt; cogs += cost; qty += q; orderSet.add(l.order_id as string);

    const bk = info.brand;
    if (!brandAgg.has(bk)) brandAgg.set(bk, { net: 0, qty: 0, orders: new Set() });
    const b = brandAgg.get(bk)!; b.net += amt; b.qty += q; b.orders.add(l.order_id as string);

    const ck = info.chan;
    if (!chanAgg.has(ck)) chanAgg.set(ck, { net: 0, qty: 0, orders: new Set() });
    const c = chanAgg.get(ck)!; c.net += amt; c.qty += q; c.orders.add(l.order_id as string);

    const sku = (l.sku as string) ?? (l.product_name as string) ?? "—";
    if (!prodAgg.has(sku)) prodAgg.set(sku, { name: (l.product_name as string) ?? sku, qty: 0, revenue: 0 });
    const p = prodAgg.get(sku)!; p.qty += q; p.revenue += amt;
  }

  // Retur mengurangi net/cogs/qty & breakdown pada periode retur.
  const retInfo = new Map((srRes.data ?? []).map((r) => [r.id as string, {
    date: ((r.return_date as string | null) ?? "").slice(0, 10),
    brand: (r.brand_id as string | null) ?? "",
    chan: (r.channel_id as string | null) ?? "",
  }]));
  let returnValue = 0, returnQty = 0;
  for (const l of srLineRes.data ?? []) {
    const info = retInfo.get(l.return_id as string);
    if (!info || !info.date) continue;
    const q = Number(l.qty) || 0;
    const amt = q * (Number(l.price) || 0);
    if (!inCur(info.date)) continue;
    returnValue += amt; returnQty += q;
    netSales -= amt; cogs -= q * (Number(l.cogm) || 0); qty -= q;

    const b = brandAgg.get(info.brand); if (b) { b.net -= amt; b.qty -= q; }
    const c = chanAgg.get(info.chan); if (c) { c.net -= amt; c.qty -= q; }
    const sku = (l.sku as string) ?? "";
    const p = prodAgg.get(sku); if (p) { p.qty -= q; p.revenue -= amt; }
  }

  const grossProfit = netSales - cogs;
  const grossMargin = netSales > 0 ? grossProfit / netSales : 0;

  const brands: BrandStat[] = Array.from(brandAgg.entries())
    .map(([id, v]) => ({ name: brandName.get(id) ?? "Tanpa Brand", net: v.net, qty: v.qty, orders: v.orders.size }))
    .filter((b) => b.qty !== 0 || b.net !== 0)
    .sort((a, b) => b.net - a.net);
  const channels: ChannelStat[] = Array.from(chanAgg.entries())
    .map(([id, v]) => { const ci = chanInfo.get(id); return { name: ci?.name ?? "Tanpa Channel", grup: ci?.grup ?? "—", net: v.net, qty: v.qty, orders: v.orders.size }; })
    .filter((c) => c.qty !== 0 || c.net !== 0)
    .sort((a, b) => b.net - a.net);
  const topProducts: ProductStat[] = Array.from(prodAgg.entries())
    .map(([sku, v]) => ({ sku, name: v.name, qty: v.qty, revenue: v.revenue }))
    .filter((p) => p.qty > 0)
    .sort((a, b) => b.qty - a.qty || b.revenue - a.revenue)
    .slice(0, 8);

  // Nilai persediaan (operasional)
  const skuOf = new Map((varRes.data ?? []).map((v) => [v.id as string, (v.sku as string) ?? ""]));
  const fgValue = (fgBalRes.data ?? []).reduce((s, b) => {
    const q = Number(b.qty_on_hand) || 0;
    const cogm = skuCost.get(skuOf.get(b.variant_id as string) ?? "")?.cogm ?? (Number(b.moving_avg_cost) || 0);
    return s + q * cogm;
  }, 0);
  const rawValue = (matBalRes.data ?? []).reduce((s, b) => s + (Number(b.qty_on_hand) || 0) * (Number(b.moving_avg_cost) || 0), 0);

  // Tren 8 bulan (revenue neto & jumlah order) — konteks jangka panjang.
  const allMonths = Array.from(new Set([...netByMonth.keys(), ...ordersByMonth.keys()])).filter(Boolean).sort();
  const chart = allMonths.slice(-8).map((m) => ({ m: ID_MONTHS[Number(m.slice(5, 7)) - 1] ?? m, revenue: Math.round(netByMonth.get(m) ?? 0), orders: ordersByMonth.get(m)?.size ?? 0 }));

  return {
    period, periodLabel: label,
    netSales, netSalesPrev, orders: orderSet.size, qty,
    cogs, grossProfit, grossMargin,
    returnValue, returnQty,
    inventoryValue: fgValue + rawValue, fgValue, rawValue,
    brands, channels, topProducts, chart,
  };
}
