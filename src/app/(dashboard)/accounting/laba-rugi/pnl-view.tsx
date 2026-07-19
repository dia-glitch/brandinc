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

function thisMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function monthLabel(m: string) {
  if (!m) return "";
  const [y, mo] = m.split("-");
  const names = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  return `${names[Number(mo) - 1] ?? mo} ${y}`;
}

export function PnlView({ entries, expenses, brands, channels }: { entries: Entry[]; expenses: Expense[]; brands: BrandOpt[]; channels: ChannelOpt[] }) {
  const [scope, setScope] = useState(""); // "" = Group; else brandId
  const [month, setMonth] = useState(thisMonth());
  const [open, setOpen] = useState(false);

  const inMonth = (d: string | null) => !month || (d ?? "").startsWith(month);
  const isGroup = scope === "";
  const brandName = brands.find((b) => b.id === scope)?.name ?? "Semua Brand (Group)";

  const ent = useMemo(() => entries.filter((e) => (isGroup || e.brandId === scope) && inMonth(e.date)), [entries, scope, month]);
  const exp = useMemo(() => expenses.filter((e) => (isGroup || e.brandId === scope) && inMonth(e.date)), [expenses, scope, month]);

  const salesEnt = ent.filter((e) => !e.isReturn);
  const retEnt = ent.filter((e) => e.isReturn);
  const gross = salesEnt.reduce((s, e) => s + e.gross, 0);
  const discount = salesEnt.reduce((s, e) => s + e.discount, 0);
  const returnsAmt = retEnt.reduce((s, e) => s + e.gross, 0);   // retur penjualan (contra revenue)
  const returnsCogs = retEnt.reduce((s, e) => s + e.hpp, 0);    // COGS barang retur (balik)
  const hpp = salesEnt.reduce((s, e) => s + e.hpp, 0) - returnsCogs;
  const commission = salesEnt.reduce((s, e) => s + e.commission, 0);
  const ppn = ent.reduce((s, e) => s + e.ppn, 0);
  const netSales = gross - discount - returnsAmt;
  const grossProfit = netSales - hpp;

  const opexByCat = useMemo(() => {
    const m = new Map<string, number>();
    exp.forEach((e) => m.set(e.category, (m.get(e.category) ?? 0) + e.amount));
    return Array.from(m.entries()).map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount);
  }, [exp]);
  const indukTotal = isGroup ? expenses.filter((e) => !e.brandId && inMonth(e.date)).reduce((s, e) => s + e.amount, 0) : 0;
  const totalOpex = commission + opexByCat.reduce((s, c) => s + c.amount, 0);
  const operatingProfit = grossProfit - totalOpex;

  function download() {
    const rows: [string, number][] = [
      ["Penjualan Bruto", gross], ["Diskon Penjualan", -discount], ["Retur Penjualan", -returnsAmt], ["Penjualan Neto", netSales],
      ["HPP", -hpp], ["Laba Kotor", grossProfit], ["Komisi Channel", -commission],
      ...opexByCat.map((c) => [`Beban · ${c.label}`, -c.amount] as [string, number]),
      ["Total Beban Operasional", -totalOpex], ["Laba Usaha", operatingProfit], ["Estimasi PPN (memo)", ppn],
    ];
    const csv = "﻿" + ["Keterangan,Nilai", ...rows.map((r) => `"${r[0]}",${r[1]}`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `laba-rugi-${isGroup ? "group" : brandName}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Accounting</p>
          <h1 className="text-2xl font-extrabold">Laba Rugi (P&amp;L)</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">Per brand &amp; konsolidasi group. Beban kategori Umum (tanpa brand) = beban induk, muncul di Group.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={download} className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm font-bold hover:bg-muted"><Download className="h-4 w-4" /> Download</button>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Input Penjualan</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <select value={scope} onChange={(e) => setScope(e.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-bold outline-none focus:border-primary/40">
          <option value="">Semua Brand (Group)</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <div className="flex items-center gap-2 text-sm">
          <span className="font-bold text-muted-foreground">Bulan</span>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-semibold outline-none focus:border-primary/40" />
        </div>
      </div>

      <div className="card p-0">
        <div className="border-b border-border px-5 py-3"><h2 className="text-sm font-black uppercase tracking-wide">Laporan Laba Rugi · {brandName} · {monthLabel(month)}</h2></div>
        <table className="w-full text-sm">
          <tbody>
            <Head label="Pendapatan" />
            <Line label="Penjualan Bruto" value={gross} />
            <Line label="Diskon Penjualan" value={-discount} muted />
            {returnsAmt > 0 && <Line label="Retur Penjualan" value={-returnsAmt} muted />}
            <Sub label="Penjualan Neto" value={netSales} />
            <Head label="Beban Pokok Penjualan" />
            <Line label="Harga Pokok Penjualan (HPP)" value={-hpp} muted />
            <Sub label="Laba Kotor" value={grossProfit} />
            <Head label="Beban Operasional" />
            <Line label="Komisi Channel / Konsinyasi" value={-commission} muted />
            {opexByCat.map((c) => <Line key={c.label} label={`Beban · ${c.label}`} value={-c.amount} muted />)}
            {opexByCat.length === 0 && commission === 0 && <tr><td className="px-5 py-2.5 text-sm text-muted-foreground" colSpan={2}>Belum ada beban pada scope ini.</td></tr>}
            <Sub label="Total Beban Operasional" value={-totalOpex} />
            <Total label="LABA USAHA (Operating Profit)" value={operatingProfit} />
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="card px-4 py-2.5"><p className="text-xs font-bold uppercase text-muted-foreground">Estimasi PPN Keluaran</p><p className="text-lg font-black tabular-nums">{formatIDR(ppn)}</p></div>
        <div className="card px-4 py-2.5"><p className="text-xs font-bold uppercase text-muted-foreground">Margin Kotor</p><p className="text-lg font-black tabular-nums">{netSales > 0 ? Math.round((grossProfit / netSales) * 100) : 0}%</p></div>
        {isGroup && <div className="card px-4 py-2.5"><p className="text-xs font-bold uppercase text-muted-foreground">Beban Induk (Umum)</p><p className="text-lg font-black tabular-nums">{formatIDR(indukTotal)}</p></div>}
      </div>

      <EntryList entries={ent} brands={brands} />

      {open && <SalesForm brands={brands} channels={channels} defaultBrand={scope} onClose={() => setOpen(false)} />}
    </div>
  );
}

function EntryList({ entries, brands }: { entries: Entry[]; brands: BrandOpt[] }) {
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
                <td className="py-2.5 pr-4 text-right"><button disabled={pending} onClick={() => startTransition(async () => { await deleteSalesEntry(e.id); router.refresh(); })} className="text-muted-foreground hover:text-danger"><Trash2 className="h-4 w-4" /></button></td>
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
