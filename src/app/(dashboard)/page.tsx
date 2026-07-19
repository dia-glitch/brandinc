import Link from "next/link";
import { ArrowUpRight, ArrowDownRight, TrendingUp } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getDashboardData, type DashData, type Period } from "@/lib/dashboard";
import { formatIDR } from "@/lib/utils";

const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Hari Ini" },
  { key: "week", label: "Minggu Ini" },
  { key: "month", label: "Bulan Ini" },
  { key: "year", label: "Tahun Ini" },
];

async function getData(period: Period): Promise<DashData | null> {
  if (!isSupabaseConfigured()) return null;
  return getDashboardData(createClient(), period);
}

const compact = (n: number) => {
  const a = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (a >= 1e9) return `${sign}Rp ${(a / 1e9).toFixed(2)} M`;
  if (a >= 1e6) return `${sign}Rp ${(a / 1e6).toFixed(1)} Jt`;
  if (a >= 1e3) return `${sign}Rp ${(a / 1e3).toFixed(0)} rb`;
  return formatIDR(n);
};

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const sp = await searchParams;
  const period: Period = (["today", "week", "month", "year"].includes(sp.period ?? "") ? sp.period : "month") as Period;
  const d = await getData(period);
  const delta = d ? d.netSales - d.netSalesPrev : 0;
  const deltaPct = d && d.netSalesPrev > 0 ? (delta / d.netSalesPrev) * 100 : null;
  const itemsPerOrder = d && d.orders > 0 ? d.qty / d.orders : 0;
  const prevLabel = period === "today" ? "kemarin" : period === "week" ? "minggu lalu" : period === "year" ? "tahun lalu" : "bulan lalu";
  const maxProdQty = d && d.topProducts.length ? Math.max(...d.topProducts.map((p) => p.qty)) : 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Ringkasan Bisnis 👋</h1>
          <p className="text-sm font-medium text-muted-foreground">Penjualan, laba &amp; stok — {d ? d.periodLabel : "—"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PERIODS.map((p) => (
            <Link key={p.key} href={p.key === "month" ? "/" : `/?period=${p.key}`} data-active={period === p.key} className="pill">{p.label}</Link>
          ))}
        </div>
      </div>

      {!d ? (
        <div className="card p-10 text-center text-sm font-medium text-muted-foreground">Data belum tersedia.</div>
      ) : (
      <>
      {/* KPI operasional (tanpa metrik keuangan: kas/AR/AP) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12">
        <KpiTile className="bg-primary text-primary-foreground lg:col-span-5" arrowClass="bg-vanila text-eerie" down={delta < 0}
          label={`Penjualan Neto — ${d.periodLabel}`} value={compact(d.netSales)} big
          sub={<span className="text-vanila">{delta >= 0 ? "▲" : "▼"} {compact(Math.abs(delta))}{deltaPct !== null ? ` (${delta >= 0 ? "+" : "−"}${Math.abs(deltaPct).toFixed(0)}%)` : ""} vs {prevLabel}</span>} />
        <KpiTile className="bg-vanila text-eerie lg:col-span-4" arrowClass="bg-eerie text-vanila"
          label="Total Order" value={String(d.orders)} big
          sub={<span className="text-muted-foreground">{d.qty} pcs terjual</span>} />
        <KpiTile className="bg-alice text-eerie lg:col-span-3" arrowClass="bg-surface text-eerie"
          label="Gross Margin" value={`${(d.grossMargin * 100).toFixed(1)}%`} big
          sub={<span className="text-muted-foreground">Laba kotor {compact(d.grossProfit)}</span>} />

        <KpiTile className="card lg:col-span-3" label="COGS (HPP)" value={compact(d.cogs)} down
          sub={<span className="text-muted-foreground">beban pokok penjualan</span>} />
        <KpiTile className="card lg:col-span-3" label="Retur Penjualan" value={compact(d.returnValue)} down
          sub={<span className="text-muted-foreground">{d.returnQty} pcs dikembalikan</span>} />
        <KpiTile className="bg-honeydew text-eerie lg:col-span-3" arrowClass="bg-surface text-eerie"
          label="Nilai Persediaan" value={compact(d.inventoryValue)}
          sub={<span className="text-muted-foreground">jadi {compact(d.fgValue)} · bahan {compact(d.rawValue)}</span>} />
        <KpiTile className="card lg:col-span-3" label="Item / Order" value={itemsPerOrder.toFixed(1)}
          sub={<span className="text-muted-foreground">rata-rata pcs · AOV {compact(d.orders > 0 ? d.netSales / d.orders : 0)}</span>} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <CardHeader>
            <CardTitle>Tren Penjualan Neto vs Order</CardTitle>
            <div className="ml-auto flex gap-4 text-xs font-semibold text-muted-foreground">
              <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-eerie" /> Penjualan</span>
              <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-vanila" /> Order</span>
            </div>
          </CardHeader>
          {d.chart.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">Belum ada penjualan.</p> : <RevenueChart data={d.chart} />}
          <p className="px-6 pb-4 text-xs font-medium text-muted-foreground">8 bulan terakhir (tidak terpengaruh filter periode).</p>
        </Card>

        {/* Breakdown per brand */}
        <Card className="lg:col-span-4">
          <CardHeader><CardTitle>Per Brand — {d.periodLabel}</CardTitle></CardHeader>
          <div className="px-6 pb-6">
            {d.brands.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada data.</p> : (
              <BreakdownList rows={d.brands.map((b) => ({ label: b.name, sub: `${b.orders} order · ${b.qty} pcs`, value: b.net }))} total={d.brands.reduce((s, b) => s + b.net, 0)} />
            )}
          </div>
        </Card>
      </div>

      {/* Breakdown per channel */}
      <Card>
        <CardHeader><CardTitle>Penjualan per Channel — {d.periodLabel}</CardTitle></CardHeader>
        <div className="px-6 pb-6">
          {d.channels.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada data.</p> : (
            <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
              <BreakdownList rows={d.channels.map((c) => ({ label: c.name, sub: `${c.grup === "offline" ? "Offline" : "Online"} · ${c.orders} order · ${c.qty} pcs`, value: c.net }))} total={d.channels.reduce((s, c) => s + c.net, 0)} />
            </div>
          )}
        </div>
      </Card>

      {/* Produk terlaris — bagian bawah */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Produk Terlaris — {d.periodLabel}</CardTitle>
        </CardHeader>
        {d.topProducts.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">Belum ada penjualan pada periode ini.</p>
        ) : (
          <div className="grid grid-cols-1 gap-x-8 gap-y-3 px-6 pb-6 md:grid-cols-2">
            {d.topProducts.map((p, i) => (
              <div key={p.sku} className="flex items-center gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-black text-primary-foreground">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-bold">{p.name}</p>
                    <p className="shrink-0 text-sm font-black tabular-nums">{p.qty} pcs</p>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-vanila" style={{ width: `${maxProdQty > 0 ? (p.qty / maxProdQty) * 100 : 0}%` }} />
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-muted-foreground tabular-nums">{compact(p.revenue)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      </>
      )}
    </div>
  );
}

function BreakdownList({ rows, total }: { rows: { label: string; sub: string; value: number }[]; total: number }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-sm font-bold">{r.label}</p>
            <p className="shrink-0 text-sm font-black tabular-nums">{compact(r.value)}</p>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${(Math.abs(r.value) / max) * 100}%` }} />
            </div>
            <span className="shrink-0 text-[11px] font-semibold text-muted-foreground tabular-nums">{total > 0 ? ((r.value / total) * 100).toFixed(0) : 0}%</span>
          </div>
          <p className="mt-0.5 text-xs font-medium text-muted-foreground">{r.sub}</p>
        </div>
      ))}
    </div>
  );
}

function KpiTile({ className = "", arrowClass = "bg-muted text-eerie", label, value, sub, big, down }: {
  className?: string; arrowClass?: string; label: string; value: string; sub?: React.ReactNode; big?: boolean; down?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 ${className}`}>
      <span className={`absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full ${arrowClass}`}>
        {down ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
      </span>
      <p className="text-sm font-semibold opacity-70">{label}</p>
      <p className={`mt-3 font-black leading-none tracking-tight ${big ? "text-3xl" : "text-2xl"}`}>{value}</p>
      {sub && <p className="mt-2 text-xs font-semibold">{sub}</p>}
    </div>
  );
}
