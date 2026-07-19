"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Ban, RotateCcw, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ListFilter } from "@/components/ui/list-filter";
import { cancelSPK, restoreSPK } from "./actions";

export type SPKLine = { id: string; sku: string | null; size: string | null; product_name: string | null; ratio: number | null; qty: string | number };
export type SPKRow = {
  id: string;
  code: string;
  spk_date: string | null;
  due_delivery: string | null;
  brand_name: string;
  supplier_name: string;
  supplier_type: string | null;
  merchandiser: string | null;
  button_accessories: string | null;
  care_label: string | null;
  vendor_comment: string | null;
  image_url: string | null;
  status: string;
  notes: string | null;
  lines: SPKLine[];
  specs: SPKSpec[];
};
export type SPKSpec = { name: string | null; type: string | null; values: Record<string, number> | null };

export function SPKList({ rows }: { rows: SPKRow[] }) {
  const [q, setQ] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const brandOpts = useMemo(() => Array.from(new Set(rows.map((r) => r.brand_name))).filter((b) => b && b !== "—").sort(), [rows]);
  const query = q.trim().toLowerCase();
  const list = rows
    .filter((r) => !brandFilter || r.brand_name === brandFilter)
    .filter((r) => !query || r.code.toLowerCase().includes(query) || r.supplier_name.toLowerCase().includes(query) || (r.lines[0]?.product_name ?? "").toLowerCase().includes(query));

  return (
    <div className="space-y-3">
      <ListFilter q={q} setQ={setQ} brandFilter={brandFilter} setBrandFilter={setBrandFilter} brandOpts={brandOpts} count={list.length} unit="SPK" placeholder="Cari kode SPK / supplier / produk…" />
      {list.length === 0 ? (
        <div className="card p-10 text-center text-sm font-medium text-muted-foreground">Tidak ada SPK yang cocok.</div>
      ) : (
      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <th className="w-8 py-2.5 pl-4"></th>
              <th className="py-2.5 pr-3">Kode SPK</th>
              <th className="hidden py-2.5 pr-3 lg:table-cell">Supplier</th>
              <th className="hidden py-2.5 pr-3 sm:table-cell">Due</th>
              <th className="py-2.5 pr-3">Item</th>
              <th className="py-2.5 pr-3">Total Qty</th>
              <th className="py-2.5 pr-3">Status</th>
              <th className="py-2.5 pr-4 text-right">Aksi</th>
            </tr>
          </thead>
          {list.map((r) => <SPKRowItem key={r.id} row={r} />)}
        </table>
      </div>
      )}
    </div>
  );
}

function SPKRowItem({ row }: { row: SPKRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const cancelled = row.status === "cancelled";
  const totalQty = row.lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);

  function doCancel() { startTransition(async () => { await cancelSPK(row.id); setConfirmCancel(false); router.refresh(); }); }
  function doRestore() { startTransition(async () => { await restoreSPK(row.id); router.refresh(); }); }

  return (
    <tbody className="border-b border-border last:border-b-0">
      <tr className={cn("font-semibold hover:bg-muted/40", cancelled && "opacity-60")}>
        <td className="py-2.5 pl-4">
          <button onClick={() => setOpen((v) => !v)} className="grid place-items-center text-muted-foreground">
            <ChevronRight className={cn("h-4 w-4 transition-transform", open && "rotate-90")} />
          </button>
        </td>
        <td className="cursor-pointer py-2.5 pr-3 font-mono text-xs font-bold" onClick={() => setOpen((v) => !v)}>
          {row.code}
          {cancelled && <Badge tone="danger" className="ml-2">Dibatalkan</Badge>}
        </td>
        <td className="hidden py-2.5 pr-3 font-medium text-muted-foreground lg:table-cell">
          {row.supplier_name}{row.supplier_type ? ` · ${row.supplier_type}` : ""}
        </td>
        <td className="hidden py-2.5 pr-3 font-medium text-muted-foreground sm:table-cell">{row.due_delivery ?? "—"}</td>
        <td className="py-2.5 pr-3"><Badge tone="neutral">{row.lines.length}</Badge></td>
        <td className="py-2.5 pr-3 tabular-nums">{totalQty}</td>
        <td className="py-2.5 pr-3">{cancelled ? <Badge tone="danger">Cancelled</Badge> : <Badge tone="success">Open</Badge>}</td>
        <td className="py-2.5 pr-4 text-right">
          <div className="inline-flex items-center gap-3">
          <a href={`/print/spk/${row.id}`} target="_blank" rel="noreferrer" title="Buka detail lengkap & print" className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground">
            <Printer className="h-4 w-4" /> Detail / Print
          </a>
          {cancelled ? (
            <button onClick={doRestore} disabled={pending} className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground">
              <RotateCcw className="h-4 w-4" /> Pulihkan
            </button>
          ) : confirmCancel ? (
            <span className="inline-flex items-center gap-1.5">
              <button onClick={() => setConfirmCancel(false)} className="text-xs font-bold text-muted-foreground hover:text-foreground">Batal</button>
              <button onClick={doCancel} disabled={pending} className="rounded-lg bg-danger px-2.5 py-1 text-xs font-bold text-white">Batalkan SPK</button>
            </span>
          ) : (
            <button onClick={() => setConfirmCancel(true)} className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-danger">
              <Ban className="h-4 w-4" /> Batalkan
            </button>
          )}
          </div>
        </td>
      </tr>

      {open && (
        <tr>
          <td colSpan={8} className="bg-muted/20 px-4 pb-4 pt-1">
            <div className="ml-8 space-y-3">
              <div className="overflow-hidden rounded-xl border border-border bg-surface">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs font-bold uppercase text-muted-foreground">
                    <th className="px-3 py-2">SKU</th><th className="px-3 py-2">Produk</th><th className="px-3 py-2">Ukuran</th>
                    <th className="px-3 py-2 text-right">Ratio</th><th className="px-3 py-2 text-right">Qty</th>
                  </tr></thead>
                  <tbody>
                    {row.lines.map((l) => (
                      <tr key={l.id} className="border-t border-border/60 font-semibold">
                        <td className="px-3 py-2 font-mono text-xs">{l.sku}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{l.product_name}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{l.size}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{l.ratio ?? "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{Number(l.qty) || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs font-medium text-muted-foreground">
                Detail lengkap (foto, size spec, catatan produksi, comment) ada di tombol <b>Detail / Print</b>.
              </p>
            </div>
          </td>
        </tr>
      )}
    </tbody>
  );
}

