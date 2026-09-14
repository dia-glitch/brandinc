"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { formatIDR } from "@/lib/utils";

export type FGRow = {
  parentSku: string; sku: string; product: string; brand: string;
  warehouse: string; status: string; qty: number; avg: number; value: number;
};

export function FGStockView({ rows }: { rows: FGRow[] }) {
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState("");

  const brandOpts = useMemo(
    () => Array.from(new Set(rows.map((r) => r.brand))).filter((b) => b && b !== "—").sort(),
    [rows]
  );
  const query = q.trim().toLowerCase();
  const list = rows
    .filter((r) => !brand || r.brand === brand)
    .filter((r) => !query || (r.sku + " " + r.parentSku + " " + r.product + " " + r.brand + " " + r.warehouse).toLowerCase().includes(query));

  const stat = useMemo(() => {
    let goodVal = 0, dmgVal = 0, goodQty = 0, dmgQty = 0;
    const skus = new Set<string>();
    for (const r of list) {
      skus.add(r.sku);
      if (r.status === "damaged") { dmgVal += r.value; dmgQty += r.qty; }
      else { goodVal += r.value; goodQty += r.qty; }
    }
    return { goodVal, dmgVal, goodQty, dmgQty, skuCount: skus.size };
  }, [list]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card label="Nilai Good (COGM)" value={formatIDR(stat.goodVal)} sub={`${stat.goodQty.toLocaleString("id-ID")} pcs`} />
        <Card label="Nilai Damage" value={formatIDR(stat.dmgVal)} tone={stat.dmgVal ? "danger" : undefined} sub={stat.dmgQty ? `${stat.dmgQty.toLocaleString("id-ID")} pcs` : "—"} />
        <Card label="Total Qty (Good)" value={`${stat.goodQty.toLocaleString("id-ID")} pcs`} />
        <Card label="Jumlah SKU" value={String(stat.skuCount)} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari SKU / produk / gudang…"
          className="h-10 w-full max-w-xs rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none focus:border-primary/40"
        />
        <select value={brand} onChange={(e) => setBrand(e.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none focus:border-primary/40">
          <option value="">Semua Brand</option>
          {brandOpts.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <span className="text-sm font-semibold text-muted-foreground">{list.length} baris</span>
      </div>

      {list.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="font-bold">Tidak ada stok cocok</p>
          <p className="mt-1 text-sm font-medium text-muted-foreground">Coba ubah filter brand atau kata kunci.</p>
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3">Parent SKU</th>
                <th className="px-5 py-3">SKU</th>
                <th className="px-5 py-3">Produk</th>
                <th className="px-5 py-3">Brand</th>
                <th className="px-5 py-3">Gudang</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Qty</th>
                <th className="px-5 py-3 text-right">COGM</th>
                <th className="px-5 py-3 text-right">Nilai COGM</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r, i) => (
                <tr key={i} className="border-t border-border font-semibold hover:bg-muted/50">
                  <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{r.parentSku}</td>
                  <td className="px-5 py-3 font-mono text-xs">{r.sku}</td>
                  <td className="px-5 py-3">{r.product}</td>
                  <td className="px-5 py-3 font-medium text-muted-foreground">{r.brand}</td>
                  <td className="px-5 py-3 font-medium text-muted-foreground">{r.warehouse}</td>
                  <td className="px-5 py-3">{r.status === "damaged" ? <Badge tone="danger">Damage</Badge> : <Badge tone="success">Good</Badge>}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{r.qty}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{formatIDR(r.avg)}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{formatIDR(r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Card({ label, value, tone, sub }: { label: string; value: string; tone?: "danger"; sub?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={"mt-1 text-xl font-extrabold tabular-nums " + (tone === "danger" ? "text-red-600" : "text-foreground")}>{value}</p>
      {sub && <p className="mt-0.5 text-xs font-medium text-muted-foreground">{sub}</p>}
    </div>
  );
}
