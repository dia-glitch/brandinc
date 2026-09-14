"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { formatIDR } from "@/lib/utils";
import { updateLaunchDate } from "./actions";

export type Bucket = "unset" | "pre" | "b0" | "b30" | "b60" | "b90";
export type BrandOpt = { id: string; name: string };

export type LifeRow = {
  id: string; parentSku: string; product: string; brand: string; brandId: string | null;
  launchDate: string | null; ageDays: number | null; bucket: Bucket;
  sellThrough: number | null; received: number; qty: number; value: number;
};
export type SkuRow = LifeRow & { sku: string; size: string };

const BUCKET: Record<Bucket, { label: string; cls: string }> = {
  unset: { label: "Belum di-set", cls: "bg-muted text-muted-foreground" },
  pre: { label: "Pra-launch", cls: "bg-indigo-100 text-indigo-700" },
  b0: { label: "0–30 hr", cls: "bg-emerald-100 text-emerald-700" },
  b30: { label: "31–60 hr", cls: "bg-lime-100 text-lime-700" },
  b60: { label: "61–90 hr", cls: "bg-amber-100 text-amber-700" },
  b90: { label: "90+ hr", cls: "bg-red-100 text-red-700" },
};

const SORTS: { value: string; label: string }[] = [
  { value: "age", label: "Umur — tertua dulu" },
  { value: "st_high", label: "Sell-through tertinggi" },
  { value: "st_low", label: "Sell-through terendah" },
  { value: "value", label: "Nilai stok terbesar" },
];

function ageLabel(ageDays: number | null) {
  return ageDays === null ? "—" : ageDays < 0 ? `H-${Math.abs(ageDays)}` : `${ageDays} hr`;
}

function sortRows<T extends LifeRow>(rows: T[], key: string): T[] {
  const arr = [...rows];
  if (key === "st_high") arr.sort((a, b) => (b.sellThrough ?? -1) - (a.sellThrough ?? -1) || b.value - a.value);
  else if (key === "st_low") arr.sort((a, b) => (a.sellThrough ?? 2) - (b.sellThrough ?? 2) || b.value - a.value);
  else if (key === "value") arr.sort((a, b) => b.value - a.value);
  else arr.sort((a, b) => (b.ageDays ?? -1) - (a.ageDays ?? -1) || b.value - a.value);
  return arr;
}

function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const csv = [headers, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const stPct = (v: number | null) => (v === null ? "" : Math.round(v * 100));

export function LifecycleView({ rows, skuRows, brands, canEdit }: { rows: LifeRow[]; skuRows: SkuRow[]; brands: BrandOpt[]; canEdit: boolean }) {
  const [tab, setTab] = useState<"produk" | "sku">("produk");
  const [query, setQuery] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [sort, setSort] = useState("age");

  const applyFilter = <T extends LifeRow>(data: T[], withSku: boolean) => {
    const q = query.trim().toLowerCase();
    return data.filter((r) => {
      if (brandFilter && r.brandId !== brandFilter) return false;
      if (!q) return true;
      const sr = r as unknown as SkuRow;
      const hay = r.parentSku + " " + r.product + " " + r.brand + (withSku ? " " + sr.sku + " " + sr.size : "");
      return hay.toLowerCase().includes(q);
    });
  };

  const productList = useMemo(() => sortRows(applyFilter(rows, false), sort), [rows, query, brandFilter, sort]);
  const skuList = useMemo(() => sortRows(applyFilter(skuRows, true), sort), [skuRows, query, brandFilter, sort]);

  // Kartu ringkasan mengikuti filter brand (level produk).
  const summary = useMemo(() => {
    const base = brandFilter ? rows.filter((r) => r.brandId === brandFilter) : rows;
    let totalValue = 0, launched = 0, unset = 0, oldValue = 0;
    for (const r of base) {
      totalValue += r.value;
      if (r.bucket === "unset") unset++;
      else if (r.ageDays !== null && r.ageDays >= 0) launched++;
      if (r.bucket === "b90") oldValue += r.value;
    }
    return { totalValue, launched, unset, oldValue };
  }, [rows, brandFilter]);

  function exportCurrent() {
    if (tab === "produk") {
      downloadCSV("lifecycle-produk.csv",
        ["Parent SKU", "Produk", "Brand", "Launch Date", "Umur (hari)", "Sell-through %", "Sisa Qty", "Nilai COGM", "Aging"],
        productList.map((r) => [r.parentSku, r.product, r.brand, r.launchDate ?? "", r.ageDays ?? "", stPct(r.sellThrough), r.qty, r.value, BUCKET[r.bucket].label]));
    } else {
      downloadCSV("lifecycle-sku.csv",
        ["Parent SKU", "SKU", "Ukuran", "Produk", "Brand", "Launch Date", "Umur (hari)", "Sell-through %", "Sisa Qty", "Nilai COGM", "Aging"],
        skuList.map((r) => [r.parentSku, r.sku, r.size, r.product, r.brand, r.launchDate ?? "", r.ageDays ?? "", stPct(r.sellThrough), r.qty, r.value, BUCKET[r.bucket].label]));
    }
  }

  const count = tab === "produk" ? productList.length : skuList.length;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Analitik Produk</p>
        <h1 className="text-2xl font-extrabold">📅 Lifecycle Produk — Launch &amp; Aging</h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          Isi <b>Launch Date</b> tiap produk (setelah rencana fix). Tanggal ini jadi pemicu perhitungan
          umur produk, sell-through, dan aging stock. Satu tanggal per produk (parent SKU).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card label="Nilai Stok (COGM)" value={formatIDR(summary.totalValue)} />
        <Card label="Produk Sudah Launch" value={String(summary.launched)} />
        <Card label="Belum Di-set Launch" value={String(summary.unset)} tone={summary.unset ? "warn" : undefined} />
        <Card label="Stok Tua (90+ hr)" value={formatIDR(summary.oldValue)} tone={summary.oldValue ? "danger" : undefined} />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setTab("produk")} data-active={tab === "produk"} className="pill">Produk</button>
        <button onClick={() => setTab("sku")} data-active={tab === "sku"} className="pill">SKU (detail)</button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tab === "sku" ? "Cari SKU / produk / brand…" : "Cari produk / parent SKU / brand…"}
          className="h-10 w-full max-w-xs rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none focus:border-primary/40"
        />
        <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none focus:border-primary/40">
          <option value="">Semua Brand</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none focus:border-primary/40">
          {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <span className="text-sm font-semibold text-muted-foreground">{count} baris</span>
        <button onClick={exportCurrent} className="ml-auto inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground hover:brightness-110">
          <Download className="h-4 w-4" /> Download CSV
        </button>
      </div>

      {tab === "produk" ? (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Parent SKU / Produk</th>
                <th className="px-4 py-3">Brand</th>
                <th className="px-4 py-3">Launch Date</th>
                <th className="px-4 py-3">Umur</th>
                <th className="px-4 py-3">Sell-through</th>
                <th className="px-4 py-3 text-right">Sisa Qty</th>
                <th className="px-4 py-3 text-right">Nilai (COGM)</th>
                <th className="px-4 py-3">Aging</th>
              </tr>
            </thead>
            <tbody>
              {productList.map((r) => <Row key={r.id} r={r} canEdit={canEdit} />)}
              {productList.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-sm font-medium text-muted-foreground">Tidak ada produk.</td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Ukuran</th>
                <th className="px-4 py-3">Produk</th>
                <th className="px-4 py-3">Brand</th>
                <th className="px-4 py-3">Launch</th>
                <th className="px-4 py-3">Umur</th>
                <th className="px-4 py-3">Sell-through</th>
                <th className="px-4 py-3 text-right">Sisa Qty</th>
                <th className="px-4 py-3 text-right">Nilai (COGM)</th>
                <th className="px-4 py-3">Aging</th>
              </tr>
            </thead>
            <tbody>
              {skuList.map((r) => <SkuRowItem key={r.id} r={r} />)}
              {skuList.length === 0 && <tr><td colSpan={10} className="px-4 py-10 text-center text-sm font-medium text-muted-foreground">Tidak ada SKU.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs font-medium text-muted-foreground">
        Sell-through = total terjual ÷ total masuk (dari Incoming). Aging dihitung dari hari sejak launch.
        Sisa qty &amp; nilai = stok <b>Good</b> yang masih tersedia. Launch date diisi di tab <b>Produk</b> (berlaku ke semua SKU-nya).
      </p>
    </div>
  );
}

function Card({ label, value, tone }: { label: string; value: string; tone?: "warn" | "danger" }) {
  const color = tone === "danger" ? "text-red-600" : tone === "warn" ? "text-amber-600" : "text-foreground";
  return (
    <div className="card p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={"mt-1 text-xl font-extrabold tabular-nums " + color}>{value}</p>
    </div>
  );
}

function STBar({ v }: { v: number | null }) {
  if (v === null) return <span className="text-muted-foreground">—</span>;
  const st = Math.round(v * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-16 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${st}%` }} /></div>
      <span className="tabular-nums text-xs font-bold">{st}%</span>
    </div>
  );
}

function Row({ r, canEdit }: { r: LifeRow; canEdit: boolean }) {
  const router = useRouter();
  const [val, setVal] = useState(r.launchDate ?? "");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const dirty = (val || null) !== (r.launchDate ?? null);

  function save() {
    setErr(null);
    start(async () => {
      const res = await updateLaunchDate(r.id, val || null);
      if (res.ok) router.refresh();
      else setErr(res.error);
    });
  }

  const b = BUCKET[r.bucket];
  return (
    <tr className="border-t border-border align-middle">
      <td className="px-4 py-3">
        <div className="font-bold">{r.parentSku}</div>
        <div className="text-xs font-medium text-muted-foreground">{r.product}</div>
      </td>
      <td className="px-4 py-3 font-medium text-muted-foreground">{r.brand}</td>
      <td className="px-4 py-3">
        {canEdit ? (
          <div className="flex items-center gap-2">
            <input type="date" value={val} onChange={(e) => setVal(e.target.value)} className="h-9 w-[150px] rounded-lg border border-border bg-background px-2 text-sm font-semibold outline-none focus:border-primary/40" />
            {dirty && <button onClick={save} disabled={pending} className="rounded-lg bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground disabled:opacity-50">{pending ? "…" : "Simpan"}</button>}
            {err && <span className="text-xs font-semibold text-red-600">{err}</span>}
          </div>
        ) : (
          <span className="font-medium">{r.launchDate ?? <span className="text-muted-foreground">—</span>}</span>
        )}
      </td>
      <td className="px-4 py-3 tabular-nums font-semibold">{ageLabel(r.ageDays)}</td>
      <td className="px-4 py-3"><STBar v={r.sellThrough} /></td>
      <td className="px-4 py-3 text-right tabular-nums font-semibold">{r.qty}</td>
      <td className="px-4 py-3 text-right tabular-nums font-semibold">{formatIDR(r.value)}</td>
      <td className="px-4 py-3"><span className={"inline-block rounded-full px-2.5 py-0.5 text-xs font-bold " + b.cls}>{b.label}</span></td>
    </tr>
  );
}

function SkuRowItem({ r }: { r: SkuRow }) {
  const b = BUCKET[r.bucket];
  return (
    <tr className="border-t border-border align-middle">
      <td className="px-4 py-3 font-mono text-xs font-bold">{r.sku}</td>
      <td className="px-4 py-3 font-semibold">{r.size}</td>
      <td className="px-4 py-3">
        <div className="font-semibold">{r.product}</div>
        <div className="text-xs font-medium text-muted-foreground">{r.parentSku}</div>
      </td>
      <td className="px-4 py-3 font-medium text-muted-foreground">{r.brand}</td>
      <td className="px-4 py-3 text-xs font-medium">{r.launchDate ?? <span className="text-muted-foreground">—</span>}</td>
      <td className="px-4 py-3 tabular-nums font-semibold">{ageLabel(r.ageDays)}</td>
      <td className="px-4 py-3"><STBar v={r.sellThrough} /></td>
      <td className="px-4 py-3 text-right tabular-nums font-semibold">{r.qty}</td>
      <td className="px-4 py-3 text-right tabular-nums font-semibold">{formatIDR(r.value)}</td>
      <td className="px-4 py-3"><span className={"inline-block rounded-full px-2.5 py-0.5 text-xs font-bold " + b.cls}>{b.label}</span></td>
    </tr>
  );
}
