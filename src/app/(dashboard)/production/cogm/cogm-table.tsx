"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Unlock, Check } from "lucide-react";
import { formatIDR } from "@/lib/utils";
import { ListFilter } from "@/components/ui/list-filter";
import { saveRetail, setLock } from "./actions";

export type CogmRow = {
  spkId: string;
  spkCode: string;
  product: string;
  brand: string;
  totalMaterial: number;
  totalWip: number;
  qtyGood: number;
  retailPrice: number;
  ppnPercent: number;
  locked: boolean;
};

export function CogmTable({ rows, canEdit = true }: { rows: CogmRow[]; canEdit?: boolean }) {
  const [q, setQ] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const brandOpts = useMemo(() => Array.from(new Set(rows.map((r) => r.brand))).filter((b) => b && b !== "—").sort(), [rows]);
  const query = q.trim().toLowerCase();
  const list = rows
    .filter((r) => !brandFilter || r.brand === brandFilter)
    .filter((r) => !query || r.spkCode.toLowerCase().includes(query) || r.product.toLowerCase().includes(query));

  return (
    <div className="space-y-3">
      <ListFilter q={q} setQ={setQ} brandFilter={brandFilter} setBrandFilter={setBrandFilter} brandOpts={brandOpts} count={list.length} unit="SPK" placeholder="Cari SPK / produk…" />
    <div className="card overflow-x-auto p-0">
      <table className="w-full min-w-[1000px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <th className="py-2.5 pl-4 pr-3">SPK / Produk</th>
            <th className="py-2.5 pr-3 text-right">Total Material</th>
            <th className="py-2.5 pr-3 text-right">Total WIP</th>
            <th className="py-2.5 pr-3 text-right">Qty Good</th>
            <th className="py-2.5 pr-3 text-right">COGM / pcs</th>
            <th className="py-2.5 pr-3 text-right">Retail (incl PPN)</th>
            <th className="py-2.5 pr-3 text-right">Est PPN</th>
            <th className="py-2.5 pr-3 text-right">Margin</th>
            <th className="py-2.5 pr-4 text-right">Margin %</th>
          </tr>
        </thead>
        <tbody>
          {list.map((r) => <Row key={r.spkId} row={r} canEdit={canEdit} />)}
        </tbody>
      </table>
    </div>
    </div>
  );
}

function Row({ row, canEdit = true }: { row: CogmRow; canEdit?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [retail, setRetail] = useState(row.retailPrice ? String(row.retailPrice) : "");
  const [err, setErr] = useState<string | null>(null);

  const cogmTotal = row.totalMaterial + row.totalWip;
  const cogmUnit = row.qtyGood > 0 ? cogmTotal / row.qtyGood : 0;

  const retailNum = Number(retail) || 0;
  const ppn = row.ppnPercent || 11;
  const ppnAmount = retailNum > 0 ? retailNum * (ppn / (100 + ppn)) : 0; // PPN terkandung di harga jual
  const net = retailNum - ppnAmount;
  const margin = retailNum > 0 && cogmUnit > 0 ? net - cogmUnit : 0;
  const marginPct = net > 0 ? (margin / net) * 100 : 0;
  const changed = retailNum !== row.retailPrice;

  function save() {
    setErr(null);
    startTransition(async () => { const r = await saveRetail(row.spkId, retailNum); if (!r.ok) { setErr(r.error); return; } router.refresh(); });
  }
  function toggleLock() {
    setErr(null);
    startTransition(async () => { const r = await setLock(row.spkId, !row.locked); if (!r.ok) { setErr(r.error); return; } router.refresh(); });
  }

  return (
    <tr className="border-t border-border font-semibold hover:bg-muted/40">
      <td className="py-3 pl-4 pr-3">
        <span className="font-mono text-xs text-primary">{row.spkCode}</span>
        <br /><span className="text-sm">{row.product || "—"}</span>
        <span className="ml-1.5 text-xs font-medium text-muted-foreground">{row.brand}</span>
      </td>
      <td className="py-3 pr-3 text-right tabular-nums">{formatIDR(row.totalMaterial)}</td>
      <td className="py-3 pr-3 text-right tabular-nums">{formatIDR(row.totalWip)}</td>
      <td className="py-3 pr-3 text-right tabular-nums">{row.qtyGood || "—"}</td>
      <td className="py-3 pr-3 text-right tabular-nums font-black">{row.qtyGood > 0 ? formatIDR(cogmUnit) : "—"}</td>
      <td className="py-3 pr-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <input type="number" value={retail} disabled={row.locked || !canEdit}
            onChange={(e) => setRetail(e.target.value)}
            className="h-9 w-28 rounded-lg border border-border bg-background px-2 text-right text-sm font-semibold outline-none focus:border-primary/40 disabled:opacity-60"
            placeholder="0" />
          {canEdit && !row.locked && changed && (
            <button type="button" onClick={save} disabled={pending} title="Simpan" className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50"><Check className="h-4 w-4" /></button>
          )}
          {canEdit && (
          <button type="button" onClick={toggleLock} disabled={pending} title={row.locked ? "Buka kunci" : "Kunci harga"}
            className={`grid h-9 w-9 place-items-center rounded-lg border ${row.locked ? "border-emerald-500 text-emerald-600" : "border-border text-muted-foreground"} hover:bg-muted`}>
            {row.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
          </button>
          )}
        </div>
        {err && <p className="mt-1 text-right text-xs font-semibold text-danger">{err}</p>}
      </td>
      <td className="py-3 pr-3 text-right tabular-nums text-muted-foreground">{retailNum > 0 ? formatIDR(ppnAmount) : "—"}</td>
      <td className="py-3 pr-3 text-right tabular-nums font-bold text-emerald-700">{margin ? formatIDR(margin) : "—"}</td>
      <td className="py-3 pr-4 text-right tabular-nums font-bold">{margin ? `${marginPct.toFixed(1)}%` : "—"}</td>
    </tr>
  );
}
