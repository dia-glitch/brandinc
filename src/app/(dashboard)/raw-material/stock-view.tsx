"use client";

import { useMemo, useState } from "react";
import { Search, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatIDR } from "@/lib/utils";

export type StockRow = {
  materialName: string;
  code: string | null;
  unit: string | null;
  categoryId: string | null;
  categoryName: string;
  categoryCode: string | null;
  brandId: string | null;
  brandName: string;
  qty: number;
  avg: number;
  value: number;
};
export type Opt = { id: string; name: string; code?: string | null };

export function StockView({ rows, categories, brands }: { rows: StockRow[]; categories: Opt[]; brands: Opt[] }) {
  const [catFilter, setCatFilter] = useState<string>("");
  const [brandFilter, setBrandFilter] = useState<string>("");
  const [q, setQ] = useState("");
  const [hideZero, setHideZero] = useState(false);

  const query = q.trim().toLowerCase();
  const filtered = useMemo(
    () => rows.filter((r) =>
      (!catFilter || r.categoryId === catFilter) &&
      (!brandFilter || r.brandId === brandFilter) &&
      (!hideZero || r.qty !== 0) &&
      (!query || r.materialName.toLowerCase().includes(query) || (r.code ?? "").toLowerCase().includes(query))),
    [rows, catFilter, brandFilter, hideZero, query]
  );

  function downloadCsv() {
    const header = ["Material", "Kode", "Kategori", "Brand", "Satuan", "Qty", "Avg Cost", "Nilai"];
    const body = filtered.map((r) => [r.materialName, r.code ?? "", r.categoryName, r.brandName, r.unit ?? "", r.qty, r.avg, r.value]);
    const csv = [header, ...body].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "stok-bahan-baku.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const totalValue = filtered.reduce((s, r) => s + r.value, 0);

  // Ringkasan per kategori + rincian per brand di dalamnya (dari data terfilter).
  const perCategory = useMemo(() => {
    const map = new Map<string, { name: string; code: string | null; value: number; brands: Map<string, { name: string; value: number }> }>();
    for (const r of filtered) {
      const key = r.categoryId ?? "none";
      const cur = map.get(key) ?? { name: r.categoryName, code: r.categoryCode, value: 0, brands: new Map() };
      cur.value += r.value;
      const bkey = r.brandId ?? "none";
      const b = cur.brands.get(bkey) ?? { name: r.brandName, value: 0 };
      b.value += r.value;
      cur.brands.set(bkey, b);
      map.set(key, cur);
    }
    return Array.from(map.values())
      .sort((a, b) => b.value - a.value)
      .map((c) => ({ ...c, brands: Array.from(c.brands.values()).sort((a, b) => b.value - a.value) }));
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Raw Material</p>
        <h1 className="text-2xl font-extrabold">Stok Bahan Baku</h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          Nilai persediaan{catFilter || brandFilter ? " (terfilter)" : ""}: <b className="text-foreground">{formatIDR(totalValue)}</b> · costing moving average.
        </p>
      </div>

      {/* Summary compact: per kategori (total besar) + rincian per brand */}
      {perCategory.length === 0 ? (
        <div className="card p-4 text-sm font-medium text-muted-foreground">Belum ada data.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {perCategory.map((c) => (
            <div key={c.name} className="card p-5">
              <div className="flex items-end justify-between border-b border-border pb-2.5">
                <span className="text-base font-bold">{c.name}</span>
                <div className="text-right">
                  <p className="text-2xl font-black leading-none tabular-nums">{formatIDR(c.value)}</p>
                  <p className="mt-1 text-xs font-semibold italic text-muted-foreground">Total Nilai</p>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                {c.brands.map((b) => (
                  <div key={b.name} className="flex items-center justify-between text-sm">
                    <span className="font-medium text-muted-foreground">{b.name}</span>
                    <span className="font-semibold tabular-nums">{formatIDR(b.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filter */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-[200px] flex-1">
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">Cari</label>
          <Search className="pointer-events-none absolute left-3 top-[38px] h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nama / kode material…"
            className="h-11 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm font-medium outline-none focus:border-primary/40" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">Kategori</label>
          <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className={sel}>
            <option value="">Semua Kategori</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.code ? `${c.code} · ` : ""}{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">Brand</label>
          <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} className={sel}>
            <option value="">Semua Brand</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <label className="flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-border px-3 text-sm font-bold">
          <input type="checkbox" checked={hideZero} onChange={(e) => setHideZero(e.target.checked)} className="h-4 w-4 accent-eerie" /> Sembunyikan stok 0
        </label>
        <button onClick={downloadCsv} className="inline-flex h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-bold hover:bg-muted"><Download className="h-4 w-4" /> Download</button>
        {(catFilter || brandFilter || q || hideZero) && (
          <button onClick={() => { setCatFilter(""); setBrandFilter(""); setQ(""); setHideZero(false); }}
            className="h-11 rounded-xl border border-border px-4 text-sm font-bold hover:bg-muted">Reset</button>
        )}
        <span className="ml-auto self-center text-sm font-medium text-muted-foreground">{filtered.length} material</span>
      </div>

      {/* Tabel stok */}
      {filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="font-bold">Tidak ada stok yang cocok</p>
          <p className="mt-1 text-sm font-medium text-muted-foreground">Ubah filter, atau terima bahan lewat Purchasing (PO).</p>
        </div>
      ) : (
        <div className="card p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3">Material</th>
                <th className="px-5 py-3">Kategori</th>
                <th className="px-5 py-3">Brand</th>
                <th className="px-5 py-3">Satuan</th>
                <th className="px-5 py-3 text-right">Qty</th>
                <th className="px-5 py-3 text-right">Avg Cost</th>
                <th className="px-5 py-3 text-right">Nilai</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={i} className="border-t border-border font-semibold hover:bg-muted/50">
                  <td className="px-5 py-3">
                    {r.materialName}
                    {r.code && <span className="ml-2 font-mono text-xs font-medium text-muted-foreground">{r.code}</span>}
                  </td>
                  <td className="px-5 py-3">
                    {r.categoryCode ? <Badge tone="neutral">{r.categoryCode}</Badge> : <span className="text-muted-foreground">—</span>}
                    <span className="ml-1.5 font-medium text-muted-foreground">{r.categoryName !== "—" ? r.categoryName : ""}</span>
                  </td>
                  <td className="px-5 py-3 font-medium text-muted-foreground">{r.brandName}</td>
                  <td className="px-5 py-3 font-medium text-muted-foreground">{r.unit ?? "—"}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{r.qty}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{formatIDR(r.avg)}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{formatIDR(r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs font-medium text-muted-foreground">
        Stok ini dipakai Material Issue: saat bahan dikeluarkan ke SPK, nilainya diambil dari Avg Cost di sini.
      </p>
    </div>
  );
}

const sel = "h-11 rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none focus:border-primary/40";
