"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatIDR } from "@/lib/utils";
import { createSalesEntry, deleteSalesEntry } from "./actions";

export type Entry = { id: string; brandId: string | null; channel: string; period: string; date: string | null; gross: number; discount: number; hpp: number; commission: number; ppn: number; notes: string; isReturn?: boolean };
export type Expense = { brandId: string | null; category: string; amount: number; date: string | null };
export type BrandOpt = { id: string; name: string };
export type ChannelOpt = { id: string; name: string };

const MON = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const MON_FULL = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
function thisMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function monthLabel(m: string) { if (!m) return ""; const [y, mo] = m.split("-"); return `${MON_FULL[Number(mo) - 1] ?? mo} ${y}`; }
function shortLabel(m: string) { const [y, mo] = m.split("-"); return `${MON[Number(mo) - 1] ?? mo} ${y.slice(2)}`; }
// N bulan berakhir di anchor (YYYY-MM), termasuk anchor.
function lastNMonths(anchor: string, n: number): string[] {
  const [y, mo] = anchor.split("-").map(Number);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(y, mo - 1 - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

type Metrics = {
  gross: number; discount: number; returnsAmt: number; hpp: number; commission: number; ppn: number;
  netSales: number; grossProfit: number; opexByCat: { label: string; amount: number }[]; opexOther: number; totalOpex: number; operatingProfit: number;
};

function computePnl(entries: Entry[], expenses: Expense[], scope: string, monthPrefix: string): Metrics {
  const isGroup = scope === "";
  const inM = (d: string | null) => !monthPrefix || (d ?? "").startsWith(monthPrefix);
  const ent = entries.filter((e) => (isGroup || e.brandId === scope) && inM(e.date));
  const exp = expenses.filter((e) => (isGroup || e.brandId === scope) && inM(e.date));
  const salesEnt = ent.filter((e) => !e.isReturn);
  const retEnt = ent.filter((e) => e.isReturn);
  const gross = salesEnt.reduce((s, e) => s + e.gross, 0);
  const discount = salesEnt.reduce((s, e) => s + e.discount, 0);
  const returnsAmt = retEnt.reduce((s, e) => s + e.gross, 0);
  const returnsCogs = retEnt.reduce((s, e) => s + e.hpp, 0);
  const hpp = salesEnt.reduce((s, e) => s + e.hpp, 0) - returnsCogs;
  const commission = salesEnt.reduce((s, e) => s + e.commission, 0);
  const ppn = ent.reduce((s, e) => s + e.ppn, 0);
  const netSales = gross - discount - returnsAmt;
  const grossProfit = netSales - hpp;
  const m = new Map<string, number>();
  exp.forEach((e) => m.set(e.category, (m.get(e.category) ?? 0) + e.amount));
  const opexByCat = Array.from(m.entries()).map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount);
  const opexOther = opexByCat.reduce((s, c) => s + c.amount, 0);
  const totalOpex = commission + opexOther;
  const operatingProfit = grossProfit - totalOpex;
  return { gross, discount, returnsAmt, hpp, commission, ppn, netSales, grossProfit, opexByCat, opexOther, totalOpex, operatingProfit };
}

type Mode = "bulan" | "3" | "6" | "tahun";

export function PnlView({ entries, expenses, brands, channels, canEdit = true }: { entries: Entry[]; expenses: Expense[]; brands: BrandOpt[]; channels: ChannelOpt[]; canEdit?: boolean }) {
  const [scope, setScope] = useState("");
  const [mode, setMode] = useState<Mode>("bulan");
  const [month, setMonth] = useState(thisMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const [open, setOpen] = useState(false);

  const isGroup = scope === "";
  const brandName = brands.find((b) => b.id === scope)?.name ?? "Semua Brand (Group)";

  // Kolom periode untuk mode komparasi.
  const periods = useMemo(() => {
    if (mode === "3") return lastNMonths(month, 3);
    if (mode === "6") return lastNMonths(month, 6);
    if (mode === "tahun") return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
    return [month];
  }, [mode, month, year]);

  const single = useMemo(() => computePnl(entries, expenses, scope, month), [entries, expenses, scope, month]);
  const cols = useMemo(() => periods.map((p) => ({ key: p, m: computePnl(entries, expenses, scope, p) })), [entries, expenses, scope, periods]);
  const totalM = useMemo(() => computePnl(entries, expenses, scope, mode === "tahun" ? String(year) : ""), [entries, expenses, scope, mode, year]);
  // Untuk 3/6 bulan: total = jumlah kolom (rentang tidak kontigu ke awal tahun).
  const rangeTotal = useMemo(() => {
    if (mode === "tahun") return totalM;
    const sum = (f: (m: Metrics) => number) => cols.reduce((s, c) => s + f(c.m), 0);
    return {
      netSales: sum((m) => m.netSales), hpp: sum((m) => m.hpp), grossProfit: sum((m) => m.grossProfit),
      commission: sum((m) => m.commission), opexOther: sum((m) => m.opexOther), totalOpex: sum((m) => m.totalOpex),
      operatingProfit: sum((m) => m.operatingProfit), ppn: sum((m) => m.ppn),
    };
  }, [cols, mode, totalM]);

  const indukTotal = isGroup ? expenses.filter((e) => !e.brandId && (mode === "bulan" ? (e.date ?? "").startsWith(month) : true)).reduce((s, e) => s + e.amount, 0) : 0;

  const periodTitle = mode === "bulan" ? monthLabel(month) : mode === "tahun" ? `Setahun ${year}` : `${periods.length} bulan (${shortLabel(periods[0])} – ${shortLabel(periods[periods.length - 1])})`;

  function download() {
    let csv: string;
    if (mode === "bulan") {
      const rows: [string, number][] = [
        ["Penjualan Neto", single.netSales], ["HPP", -single.hpp], ["Laba Kotor", single.grossProfit],
        ["Komisi Channel", -single.commission], ["Total Beban Operasional", -single.totalOpex], ["Laba Usaha", single.operatingProfit], ["Estimasi PPN", single.ppn],
      ];
      csv = "﻿" + ["Keterangan,Nilai", ...rows.map((r) => `"${r[0]}",${r[1]}`)].join("\n");
    } else {
      const head = ["Keterangan", ...cols.map((c) => shortLabel(c.key)), "Total"];
      const defs: [string, (m: Metrics) => number][] = [
        ["Penjualan Neto", (m) => m.netSales], ["HPP", (m) => -m.hpp], ["Laba Kotor", (m) => m.grossProfit],
        ["Komisi Channel", (m) => -m.commission], ["Beban Operasional", (m) => -m.opexOther], ["Laba Usaha", (m) => m.operatingProfit],
      ];
      const rt = rangeTotal as Metrics;
      const lines = defs.map(([label, f]) => [`"${label}"`, ...cols.map((c) => f(c.m)), f(rt)].join(","));
      csv = "﻿" + [head.join(","), ...lines].join("\n");
    }
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `laba-rugi-${isGroup ? "group" : brandName}-${mode}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  const MODES: { v: Mode; label: string }[] = [{ v: "bulan", label: "Bulanan" }, { v: "3", label: "3 Bulan" }, { v: "6", label: "6 Bulan" }, { v: "tahun", label: "Tahunan" }];
  const netProfit = mode === "bulan" ? single.operatingProfit : (rangeTotal as Metrics).operatingProfit;
  const netMargin = mode === "bulan" ? single.netSales : (rangeTotal as Metrics).netSales;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Accounting</p>
          <h1 className="text-2xl font-extrabold">Laba Rugi (P&amp;L)</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">Per brand &amp; konsolidasi group. Bandingkan 3 bulan, 6 bulan, atau setahun penuh. Beban kategori Umum (tanpa brand) = beban induk, muncul di Group.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={download} className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm font-bold hover:bg-muted"><Download className="h-4 w-4" /> Download</button>
          {canEdit && <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Input Penjualan</Button>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <select value={scope} onChange={(e) => setScope(e.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-bold outline-none focus:border-primary/40">
          <option value="">Semua Brand (Group)</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <div className="flex rounded-xl border border-border bg-background p-0.5">
          {MODES.map((m) => (
            <button key={m.v} onClick={() => setMode(m.v)} data-active={mode === m.v}
              className={"rounded-lg px-3 py-1.5 text-sm font-bold transition " + (mode === m.v ? "bg-eerie text-white" : "text-muted-foreground hover:text-foreground")}>
              {m.label}
            </button>
          ))}
        </div>
        {mode === "tahun" ? (
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-semibold outline-none focus:border-primary/40">
            {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <span className="font-bold text-muted-foreground">{mode === "bulan" ? "Bulan" : "s/d Bulan"}</span>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-semibold outline-none focus:border-primary/40" />
          </div>
        )}
      </div>

      {mode === "bulan" ? (
        <SingleReport m={single} brandName={brandName} periodTitle={periodTitle} isGroup={isGroup} indukTotal={indukTotal} />
      ) : (
        <ComparisonReport cols={cols} total={rangeTotal as Metrics} brandName={brandName} periodTitle={periodTitle} netProfit={netProfit} netMargin={netMargin} />
      )}

      {mode === "bulan" && <EntryList entries={entries.filter((e) => (isGroup || e.brandId === scope) && (e.date ?? "").startsWith(month))} brands={brands} canEdit={canEdit} />}

      {open && <SalesForm brands={brands} channels={channels} defaultBrand={scope} onClose={() => setOpen(false)} />}
    </div>
  );
}

function SingleReport({ m, brandName, periodTitle, isGroup, indukTotal }: { m: Metrics; brandName: string; periodTitle: string; isGroup: boolean; indukTotal: number }) {
  return (
    <>
      <div className="card p-0">
        <div className="border-b border-border px-5 py-3"><h2 className="text-sm font-black uppercase tracking-wide">Laporan Laba Rugi · {brandName} · {periodTitle}</h2></div>
        <table className="w-full text-sm">
          <tbody>
            <Head label="Pendapatan" />
            <Line label="Penjualan Bruto" value={m.gross} />
            <Line label="Diskon Penjualan" value={-m.discount} muted />
            {m.returnsAmt > 0 && <Line label="Retur Penjualan" value={-m.returnsAmt} muted />}
            <Sub label="Penjualan Neto" value={m.netSales} />
            <Head label="Beban Pokok Penjualan" />
            <Line label="Harga Pokok Penjualan (HPP)" value={-m.hpp} muted />
            <Sub label="Laba Kotor" value={m.grossProfit} />
            <Head label="Beban Operasional" />
            <Line label="Komisi Channel / Konsinyasi" value={-m.commission} muted />
            {m.opexByCat.map((c) => <Line key={c.label} label={`Beban · ${c.label}`} value={-c.amount} muted />)}
            {m.opexByCat.length === 0 && m.commission === 0 && <tr><td className="px-5 py-2.5 text-sm text-muted-foreground" colSpan={2}>Belum ada beban pada scope ini.</td></tr>}
            <Sub label="Total Beban Operasional" value={-m.totalOpex} />
            <Total label="LABA USAHA (Operating Profit)" value={m.operatingProfit} />
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <BigStat label="Estimasi PPN Keluaran" value={formatIDR(m.ppn)} />
        <BigStat label="Margin Kotor" value={`${m.netSales > 0 ? Math.round((m.grossProfit / m.netSales) * 100) : 0}%`} />
        {isGroup && <BigStat label="Beban Induk (Umum)" value={formatIDR(indukTotal)} />}
      </div>
    </>
  );
}

function ComparisonReport({ cols, total, brandName, periodTitle, netProfit, netMargin }: { cols: { key: string; m: Metrics }[]; total: Metrics; brandName: string; periodTitle: string; netProfit: number; netMargin: number }) {
  const rows: { label: string; f: (m: Metrics) => number; strong?: boolean; head?: boolean; neg?: boolean }[] = [
    { label: "Penjualan Neto", f: (m) => m.netSales, strong: true },
    { label: "HPP", f: (m) => -m.hpp, neg: true },
    { label: "Laba Kotor", f: (m) => m.grossProfit, strong: true },
    { label: "Komisi Channel", f: (m) => -m.commission, neg: true },
    { label: "Beban Operasional", f: (m) => -m.opexOther, neg: true },
    { label: "Total Beban Operasional", f: (m) => -m.totalOpex, neg: true, strong: true },
    { label: "Laba Usaha", f: (m) => m.operatingProfit, strong: true },
  ];
  return (
    <>
      <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Laba Usaha · {periodTitle}</p>
          <p className={"mt-1 text-3xl font-black tracking-tight " + (netProfit < 0 ? "text-danger" : "text-emerald-700")}>{formatIDR(netProfit)}</p>
          <p className="text-xs font-semibold text-muted-foreground">margin {netMargin > 0 ? Math.round((netProfit / netMargin) * 100) : 0}% · {brandName}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Penjualan Neto</p>
          <p className="mt-1 text-2xl font-black tracking-tight">{formatIDR(total.netSales)}</p>
          <p className="text-xs font-semibold text-muted-foreground">HPP {formatIDR(total.hpp)} · {cols.length} kolom</p>
        </div>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <th className="py-2.5 pl-4 pr-3 text-left">Keterangan</th>
              {cols.map((c) => <th key={c.key} className="py-2.5 px-3 text-right">{shortLabel(c.key)}</th>)}
              <th className="py-2.5 px-4 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className={"border-t border-border/60 " + (r.strong ? "bg-muted/20 font-extrabold" : "font-semibold")}>
                <td className={"py-2.5 pl-4 pr-3 " + (r.neg && !r.strong ? "text-muted-foreground" : "")}>{r.label}</td>
                {cols.map((c) => { const v = r.f(c.m); return <td key={c.key} className={"py-2.5 px-3 text-right tabular-nums " + (v < 0 ? "text-danger" : "")}>{v === 0 ? "—" : formatIDR(v)}</td>; })}
                <td className={"py-2.5 px-4 text-right tabular-nums font-extrabold " + (r.f(total) < 0 ? "text-danger" : "")}>{formatIDR(r.f(total))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function BigStat({ label, value }: { label: string; value: string }) {
  return <div className="card p-5"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-black tabular-nums tracking-tight">{value}</p></div>;
}

function EntryList({ entries, brands, canEdit = true }: { entries: Entry[]; brands: BrandOpt[]; canEdit?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const brandName = (id: string | null) => brands.find((b) => b.id === id)?.name ?? "—";
  if (entries.length === 0) return null;
  return (
    <div>
      <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Entri Penjualan ({entries.length})</p>
      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[760px] text-sm">
          <thead><tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <th className="py-2.5 pl-4 pr-3">Tgl</th><th className="py-2.5 pr-3">Brand</th><th className="py-2.5 pr-3">Channel</th><th className="py-2.5 pr-3">Periode</th>
            <th className="py-2.5 pr-3 text-right">Bruto</th><th className="py-2.5 pr-3 text-right">Diskon</th><th className="py-2.5 pr-3 text-right">HPP</th><th className="py-2.5 pr-4 text-right"></th>
          </tr></thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-t border-border font-semibold hover:bg-muted/40">
                <td className="py-2.5 pl-4 pr-3 font-medium text-muted-foreground">{e.date ?? "—"}</td>
                <td className="py-2.5 pr-3">{brandName(e.brandId)}</td>
                <td className="py-2.5 pr-3 font-medium text-muted-foreground">{e.channel || "—"}</td>
                <td className="py-2.5 pr-3 font-medium text-muted-foreground">{e.period || "—"}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{formatIDR(e.gross)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">{formatIDR(e.discount)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">{formatIDR(e.hpp)}</td>
                <td className="py-2.5 pr-4 text-right">{canEdit && <button disabled={pending} onClick={() => startTransition(async () => { await deleteSalesEntry(e.id); router.refresh(); })} className="text-muted-foreground hover:text-danger"><Trash2 className="h-4 w-4" /></button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SalesForm({ brands, channels, defaultBrand, onClose }: { brands: BrandOpt[]; channels: ChannelOpt[]; defaultBrand: string; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [brandId, setBrandId] = useState(defaultBrand || brands[0]?.id || "");
  const [channelId, setChannelId] = useState("");
  const [period, setPeriod] = useState("");
  const [gross, setGross] = useState("");
  const [discount, setDiscount] = useState("");
  const [hpp, setHpp] = useState("");
  const [commission, setCommission] = useState("");
  const [ppn, setPpn] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });

  function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    startTransition(async () => {
      const res = await createSalesEntry({ brandId, channelId: channelId || null, period, entryDate: date, gross: Number(gross) || 0, discount: Number(discount) || 0, hpp: Number(hpp) || 0, commission: Number(commission) || 0, ppn: Number(ppn) || 0, notes });
      if (!res.ok) { setError(res.error); return; }
      onClose(); router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-eerie/40 p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-6 shadow-soft">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-extrabold">Input Penjualan (P&amp;L)</h2><button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button></div>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Brand</label><select value={brandId} onChange={(e) => setBrandId(e.target.value)} className={inp + " px-3"}><option value="">— Pilih —</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
            <div><label className={lbl}>Channel</label><select value={channelId} onChange={(e) => setChannelId(e.target.value)} className={inp + " px-3"}><option value="">— Umum —</option>{channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Periode</label><input value={period} onChange={(e) => setPeriod(e.target.value)} className={inp} placeholder="mis. Juli 2026" /></div>
            <div><label className={lbl}>Tanggal</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inp} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Penjualan Bruto</label><input type="number" value={gross} onChange={(e) => setGross(e.target.value)} className={inp} placeholder="0" /></div>
            <div><label className={lbl}>Diskon Produk</label><input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} className={inp} placeholder="0" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className={lbl}>HPP (COGS)</label><input type="number" value={hpp} onChange={(e) => setHpp(e.target.value)} className={inp} placeholder="0" /></div>
            <div><label className={lbl}>Komisi Channel</label><input type="number" value={commission} onChange={(e) => setCommission(e.target.value)} className={inp} placeholder="0" /></div>
            <div><label className={lbl}>Est. PPN</label><input type="number" value={ppn} onChange={(e) => setPpn(e.target.value)} className={inp} placeholder="0" /></div>
          </div>
          <div><label className={lbl}>Catatan</label><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inp} placeholder="opsional" /></div>
          {error && <p className="text-sm font-semibold text-danger">{error}</p>}
          <div className="flex justify-end gap-2.5 pt-1"><Button type="button" variant="ghost" size="sm" onClick={onClose}>Batal</Button><Button type="submit" size="sm" disabled={pending}>{pending ? "Menyimpan…" : "Simpan"}</Button></div>
        </form>
      </div>
    </div>
  );
}

function Head({ label }: { label: string }) { return <tr className="bg-muted/40"><td className="px-5 py-2 text-xs font-black uppercase tracking-wide text-muted-foreground" colSpan={2}>{label}</td></tr>; }
function Line({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return <tr className="border-t border-border/60"><td className={`px-5 py-2.5 font-semibold ${muted ? "pl-8 text-muted-foreground" : ""}`}>{label}</td><td className="px-5 py-2.5 text-right tabular-nums">{formatIDR(value)}</td></tr>;
}
function Sub({ label, value }: { label: string; value: number }) {
  return <tr className="border-t border-border bg-muted/20 font-extrabold"><td className="px-5 py-2.5">{label}</td><td className="px-5 py-2.5 text-right tabular-nums">{formatIDR(value)}</td></tr>;
}
function Total({ label, value }: { label: string; value: number }) {
  return <tr className="border-t-2 border-foreground/70 text-base font-black"><td className="px-5 py-3">{label}</td><td className={`px-5 py-3 text-right tabular-nums ${value < 0 ? "text-danger" : "text-emerald-700"}`}>{formatIDR(value)}</td></tr>;
}

const lbl = "mb-1.5 block text-sm font-bold";
const inp = "h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm font-medium outline-none focus:border-primary/40";
