"use client";

import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";

export type LedgerLoc = { id: string; name: string; kind: string };
export type LedgerRow = {
  sku: string; product: string; parentSku: string; brand: string; brandId: string | null;
  qty: Record<string, number>; total: number;
};

function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => { const s = String(v ?? ""); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const csv = [headers, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function LedgerView({ locations, rows, brands }: { locations: LedgerLoc[]; rows: LedgerRow[]; brands: { id: string; name: string }[] }) {
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState("");
  const [loc, setLoc] = useState("");

  const cols = useMemo(() => (loc ? locations.filter((l) => l.id === loc) : locations), [locations, loc]);
  const query = q.trim().toLowerCase();
  const list = useMemo(() => rows
    .filter((r) => !brand || r.brandId === brand)
    .filter((r) => !query || (r.sku + " " + r.product + " " + r.parentSku).toLowerCase().includes(query))
    .filter((r) => !loc || (r.qty[loc] ?? 0) > 0), [rows, brand, query, loc]);

  const colTotals = useMemo(() => {
    const t: Record<string, number> = {}; let grand = 0;
    for (const r of list) for (const c of cols) { const v = r.qty[c.id] ?? 0; t[c.id] = (t[c.id] ?? 0) + v; grand += v; }
    return { t, grand };
  }, [list, cols]);

  function exportCSV() {
    const headers = ["SKU", "Produk", "Brand", ...cols.map((c) => c.name), "Total"];
    const data = list.map((r) => [r.sku, r.product, r.brand, ...cols.map((c) => r.qty[c.id] ?? 0), loc ? (r.qty[loc] ?? 0) : r.total]);
    downloadCSV("inventory-ledger.csv", headers, data);
  }

  return (
    <div className="mx-auto max-w-full space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Distribution</p>
        <h1 className="text-2xl font-extrabold">Inventory Ledger</h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">Stok tersedia per lokasi (gudang &amp; store) — sumber kebenaran stok berjalan. SOLD keluar dari sistem saat penjualan.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari SKU / nama produk…" className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm font-medium outline-none focus:border-primary/40" />
        </div>
        <select value={brand} onChange={(e) => setBrand(e.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none focus:border-primary/40">
          <option value="">Semua Brand</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={loc} onChange={(e) => setLoc(e.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none focus:border-primary/40">
          <option value="">Semua Lokasi</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <span className="text-sm font-semibold text-muted-foreground">{list.length} SKU</span>
        <button onClick={exportCSV} className="ml-auto inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground hover:brightness-110">
          <Download className="h-4 w-4" /> Download CSV
        </button>
      </div>

      {list.length === 0 ? (
        <div className="card p-10 text-center text-sm font-medium text-muted-foreground">Tidak ada stok yang cocok.</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <th className="sticky left-0 z-10 bg-surface px-4 py-3">SKU</th>
                {cols.map((c) => <th key={c.id} className="px-3 py-3 text-right whitespace-nowrap">{c.name}</th>)}
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.sku} className="border-t border-border/60 hover:bg-muted/30">
                  <td className="sticky left-0 z-10 bg-surface px-4 py-2.5">
                    <div className="font-mono text-xs font-bold">{r.sku}</div>
                    <div className="text-[11px] font-medium text-muted-foreground">{r.product}{r.brand !== "—" ? ` · ${r.brand}` : ""}</div>
                  </td>
                  {cols.map((c) => {
                    const v = r.qty[c.id] ?? 0;
                    return <td key={c.id} className={"px-3 py-2.5 text-right tabular-nums " + (v ? "font-semibold" : "text-muted-foreground/40")}>{v || "·"}</td>;
                  })}
                  <td className="px-4 py-2.5 text-right font-black tabular-nums">{loc ? (r.qty[loc] ?? 0) : r.total}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-border bg-muted/40 font-black">
                <td className="sticky left-0 z-10 bg-muted/40 px-4 py-2.5 text-xs uppercase tracking-wide">Total</td>
                {cols.map((c) => <td key={c.id} className="px-3 py-2.5 text-right tabular-nums">{colTotals.t[c.id] || "·"}</td>)}
                <td className="px-4 py-2.5 text-right tabular-nums">{colTotals.grand}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
