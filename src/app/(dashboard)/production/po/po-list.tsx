"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Ban, RotateCcw, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatIDR } from "@/lib/utils";
import { ListFilter } from "@/components/ui/list-filter";
import { cancelProductionPO, restoreProductionPO } from "./actions";

export type ProdPOLine = {
  id: string;
  sku: string | null;
  size: string | null;
  product_name: string | null;
  qty_spk: string | number;
  qty: string | number;
  unit_cost: string | number;
  received_qty: string | number;
};
export type ProdPORow = {
  id: string;
  code: string;
  spk_code: string;
  po_date: string | null;
  due_delivery: string | null;
  brand_name: string;
  supplier_name: string;
  status: string;
  notes: string | null;
  ppn_percent: number;
  ppn_amount: number;
  invoice_no: string | null;
  lines: ProdPOLine[];
};

export function ProdPOList({ rows }: { rows: ProdPORow[] }) {
  const [q, setQ] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const brandOpts = useMemo(() => Array.from(new Set(rows.map((r) => r.brand_name))).filter((b) => b && b !== "—").sort(), [rows]);
  const query = q.trim().toLowerCase();
  const list = rows
    .filter((r) => !brandFilter || r.brand_name === brandFilter)
    .filter((r) => !query || r.code.toLowerCase().includes(query) || r.spk_code.toLowerCase().includes(query) || r.supplier_name.toLowerCase().includes(query) || (r.lines[0]?.product_name ?? "").toLowerCase().includes(query));

  return (
    <div className="space-y-3">
      <ListFilter q={q} setQ={setQ} brandFilter={brandFilter} setBrandFilter={setBrandFilter} brandOpts={brandOpts} count={list.length} unit="PO" placeholder="Cari kode PO / SPK / vendor / produk…" />
      {list.length === 0 ? (
        <div className="card p-10 text-center text-sm font-medium text-muted-foreground">Tidak ada PO yang cocok.</div>
      ) : (
      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <th className="w-8 py-2.5 pl-4"></th>
              <th className="py-2.5 pr-3">Kode PO</th>
              <th className="hidden py-2.5 pr-3 lg:table-cell">Brand</th>
              <th className="py-2.5 pr-3">Vendor</th>
              <th className="hidden py-2.5 pr-3 sm:table-cell">Due</th>
              <th className="py-2.5 pr-3 text-right">Total</th>
              <th className="py-2.5 pr-3">Status</th>
              <th className="py-2.5 pr-4 text-right">Aksi</th>
            </tr>
          </thead>
          {list.map((r) => <ProdPORowItem key={r.id} row={r} />)}
        </table>
      </div>
      )}
    </div>
  );
}

function ProdPORowItem({ row }: { row: ProdPORow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const cancelled = row.status === "cancelled";
  const subtotal = row.lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unit_cost) || 0), 0);
  const total = subtotal + (Number(row.ppn_amount) || 0);
  const totalQty = row.lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);

  return (
    <tbody className="border-b border-border">
      <tr className={cn("font-semibold hover:bg-muted/40", cancelled && "opacity-60")}>
        <td className="py-2.5 pl-4">
          <button onClick={() => setOpen((o) => !o)} className="grid h-6 w-6 place-items-center rounded-lg hover:bg-muted">
            <ChevronRight className={cn("h-4 w-4 transition-transform", open && "rotate-90")} />
          </button>
        </td>
        <td className="py-2.5 pr-3 font-mono text-xs">{row.code}</td>
        <td className="hidden py-2.5 pr-3 lg:table-cell">{row.brand_name}</td>
        <td className="py-2.5 pr-3">{row.supplier_name}</td>
        <td className="hidden py-2.5 pr-3 sm:table-cell font-medium text-muted-foreground">{row.due_delivery ?? "—"}</td>
        <td className="py-2.5 pr-3 text-right tabular-nums">{formatIDR(total)}</td>
        <td className="py-2.5 pr-3">
          {cancelled ? <Badge tone="danger">Batal</Badge> : <Badge tone="neutral">Open</Badge>}
        </td>
        <td className="py-2.5 pr-4 text-right">
          <div className="flex items-center justify-end gap-1">
            <a href={`/print/prodpo/${row.id}`} target="_blank" rel="noreferrer" title="Buka detail lengkap & print"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground">
              <Printer className="h-4 w-4" /> Detail / Print
            </a>
            {cancelled ? (
              <Button variant="ghost" size="icon" disabled={pending} title="Aktifkan lagi"
                onClick={() => startTransition(async () => { await restoreProductionPO(row.id); router.refresh(); })}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            ) : (
              confirmCancel ? (
                <span className="inline-flex items-center gap-1">
                  <button className="rounded-lg bg-danger px-2 py-1 text-xs font-bold text-white" disabled={pending}
                    onClick={() => startTransition(async () => { await cancelProductionPO(row.id); setConfirmCancel(false); router.refresh(); })}>Batalkan?</button>
                  <button className="rounded-lg border border-border px-2 py-1 text-xs font-bold" onClick={() => setConfirmCancel(false)}>Tidak</button>
                </span>
              ) : (
                <Button variant="ghost" size="icon" onClick={() => setConfirmCancel(true)} title="Batalkan PO"><Ban className="h-4 w-4" /></Button>
              )
            )}
          </div>
        </td>
      </tr>

      {open && (
        <tr className="bg-muted/20">
          <td colSpan={8} className="px-5 py-3">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">Ref. SPK: <span className="font-mono">{row.spk_code}</span></p>
            <div className="overflow-x-auto rounded-xl border border-border bg-surface">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-bold uppercase text-muted-foreground">
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2">Ukuran</th>
                    <th className="px-3 py-2 text-right">Qty SPK</th>
                    <th className="px-3 py-2 text-right">Qty PO</th>
                    <th className="px-3 py-2 text-right">Ongkos WIP</th>
                    <th className="px-3 py-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {row.lines.map((l) => (
                    <tr key={l.id} className="border-t border-border/60 font-semibold">
                      <td className="px-3 py-2 font-mono text-xs">{l.sku ?? "—"}</td>
                      <td className="px-3 py-2">{l.size ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{Number(l.qty_spk)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{Number(l.qty)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatIDR(Number(l.unit_cost))}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatIDR((Number(l.qty) || 0) * (Number(l.unit_cost) || 0))}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-border font-semibold text-muted-foreground">
                    <td className="px-3 py-2" colSpan={5}>Subtotal ({totalQty} pcs)</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatIDR(subtotal)}</td>
                  </tr>
                  <tr className="font-semibold text-muted-foreground">
                    <td className="px-3 py-2" colSpan={5}>PPN {Number(row.ppn_percent) || 0}%</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatIDR(Number(row.ppn_amount) || 0)}</td>
                  </tr>
                  <tr className="border-t border-border bg-muted/30 font-extrabold">
                    <td className="px-3 py-2" colSpan={5}>Total</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatIDR(total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {row.notes && <p className="mt-2 text-xs font-medium text-muted-foreground">Catatan: {row.notes}</p>}
          </td>
        </tr>
      )}
    </tbody>
  );
}
