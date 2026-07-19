"use client";

import { useState, useMemo } from "react";
import { Search, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatIDR } from "@/lib/utils";

export type CatalogRow = {
  variantId: string;
  parentSku: string;
  sku: string;
  product: string;
  brand: string;
  brandId: string | null;
  color: string;
  size: string;
  stock: number;
  cogm: number;
  retail: number;
  locked: boolean;
  aging: number | null;
};

function agingTone(days: number | null): string {
  if (days === null) return "text-muted-foreground";
  if (days >= 90) return "text-danger";
  if (days >= 45) return "text-amber-600";
  return "text-emerald-700";
}

export function CatalogTable({ rows, brands }: { rows: CatalogRow[]; brands: { id: string; name: string }[] }) {
  const [q, setQ] = useState("");
  const [brandFilter, setBrandFilter] = useState("");

  const query = q.trim().toLowerCase();
  const list = useMemo(() => rows
    .filter((r) => !brandFilter || r.brandId === brandFilter)
    .filter((r) => !query || r.sku.toLowerCase().includes(query) || r.product.toLowerCase().includes(query)),
    [rows, brandFilter, query]);

  function downloadCsv() {
    const header = ["Parent SKU", "SKU", "Produk", "Brand", "Warna", "Ukuran", "Stok", "COGM", "Retail", "Aging (hari)"];
    const body = list.map((r) => [r.parentSku, r.sku, r.product, r.brand, r.color, r.size, r.stock, r.cogm, r.retail, r.aging ?? ""]);
    const csv = [header, ...body].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "inventory-katalog.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari SKU / nama produk…"
            className="h-11 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm font-medium outline-none focus:border-primary/40" />
        </div>
        <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}
          className="h-11 rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none focus:border-primary/40">
          <option value="">Semua Brand</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        {(q || brandFilter) && <button onClick={() => { setQ(""); setBrandFilter(""); }} className="h-11 rounded-xl border border-border px-4 text-sm font-bold hover:bg-muted">Reset</button>}
        <button onClick={downloadCsv} className="inline-flex h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-bold hover:bg-muted"><Download className="h-4 w-4" /> Download</button>
        <span className="ml-auto self-center text-sm font-medium text-muted-foreground">{list.length} SKU</span>
      </div>

      {list.length === 0 ? (
        <div className="card p-10 text-center text-sm font-medium text-muted-foreground">Tidak ada SKU yang cocok.</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[1000px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <th className="py-2.5 pl-4 pr-3">Parent SKU</th>
                <th className="py-2.5 pr-3">SKU</th>
                <th className="py-2.5 pr-3">Produk</th>
                <th className="py-2.5 pr-3">Brand</th>
                <th className="py-2.5 pr-3">Warna</th>
                <th className="py-2.5 pr-3">Ukuran</th>
                <th className="py-2.5 pr-3 text-right">Stok</th>
                <th className="py-2.5 pr-3 text-right">Aging</th>
                <th className="py-2.5 pr-3 text-right">COGM</th>
                <th className="py-2.5 pr-4 text-right">Retail</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.variantId} className="border-t border-border font-semibold hover:bg-muted/40">
                  <td className="py-2.5 pl-4 pr-3 font-mono text-xs text-muted-foreground">{r.parentSku}</td>
                  <td className="py-2.5 pr-3 font-mono text-xs">{r.sku}</td>
                  <td className="py-2.5 pr-3">{r.product}</td>
                  <td className="py-2.5 pr-3 font-medium text-muted-foreground">{r.brand}</td>
                  <td className="py-2.5 pr-3 font-medium text-muted-foreground">{r.color || "—"}</td>
                  <td className="py-2.5 pr-3 font-medium text-muted-foreground">{r.size || "—"}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{r.stock || "—"}</td>
                  <td className={`py-2.5 pr-3 text-right tabular-nums font-bold ${agingTone(r.aging)}`}>{r.aging === null ? "—" : `${r.aging}h`}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{r.cogm > 0 ? formatIDR(r.cogm) : "—"}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">
                    {r.retail > 0 ? <span className="inline-flex items-center gap-1.5">{formatIDR(r.retail)}{r.locked && <Badge tone="success">🔒</Badge>}</span> : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
