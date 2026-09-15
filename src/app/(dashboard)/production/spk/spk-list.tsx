"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, RotateCcw, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ListFilter } from "@/components/ui/list-filter";
import { cancelSPK, restoreSPK, setSpkStatus } from "./actions";

export type SPKLine = { id: string; sku: string | null; size: string | null; product_name: string | null; ratio: number | null; qty: string | number };
export type SPKSpec = { name: string | null; type: string | null; values: Record<string, number> | null };
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
  completed: boolean;
  notes: string | null;
  lines: SPKLine[];
  specs: SPKSpec[];
};

/** Nama produk ringkas dari lines (produk pertama + "+N" bila beda). */
function productLabel(row: SPKRow): string {
  const names = Array.from(new Set(row.lines.map((l) => l.product_name).filter(Boolean))) as string[];
  if (names.length === 0) return "—";
  return names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`;
}

export function SPKList({ rows, canEdit = true }: { rows: SPKRow[]; canEdit?: boolean }) {
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
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <th className="py-2.5 pl-4 pr-3">Kode SPK</th>
                <th className="py-2.5 pr-3">Produk</th>
                <th className="py-2.5 pr-3">Brand</th>
                <th className="hidden py-2.5 pr-3 lg:table-cell">Supplier</th>
                <th className="hidden py-2.5 pr-3 sm:table-cell">Due</th>
                <th className="py-2.5 pr-3 text-right">Qty</th>
                <th className="py-2.5 pr-3">Status</th>
                <th className="py-2.5 pr-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => <SPKRowItem key={r.id} row={r} canEdit={canEdit} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SPKRowItem({ row, canEdit = true }: { row: SPKRow; canEdit?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const cancelled = row.status === "cancelled";
  const completed = row.completed && !cancelled;
  const totalQty = row.lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);
  // Normalisasi status lama ("open") → "handover".
  const stStatus = row.status === "draft" ? "draft" : "handover";

  function doCancel() { startTransition(async () => { await cancelSPK(row.id); setConfirmCancel(false); router.refresh(); }); }
  function doRestore() { startTransition(async () => { await restoreSPK(row.id); router.refresh(); }); }
  function changeStatus(v: string) { startTransition(async () => { await setSpkStatus(row.id, v as "draft" | "handover"); router.refresh(); }); }

  return (
    <tr className={cn("border-b border-border font-semibold last:border-0 hover:bg-muted/40", cancelled && "opacity-60")}>
      <td className="py-2.5 pl-4 pr-3 font-mono text-xs font-bold">{row.code}</td>
      <td className="py-2.5 pr-3">{productLabel(row)}</td>
      <td className="py-2.5 pr-3 font-medium text-muted-foreground">{row.brand_name}</td>
      <td className="hidden py-2.5 pr-3 font-medium text-muted-foreground lg:table-cell">{row.supplier_name}{row.supplier_type ? ` · ${row.supplier_type}` : ""}</td>
      <td className="hidden py-2.5 pr-3 font-medium text-muted-foreground sm:table-cell">{row.due_delivery ?? "—"}</td>
      <td className="py-2.5 pr-3 text-right tabular-nums">{totalQty}</td>
      <td className="py-2.5 pr-3">
        {cancelled ? (
          <Badge tone="danger">Dibatalkan</Badge>
        ) : completed ? (
          <Badge tone="success">Completed</Badge>
        ) : canEdit ? (
          <select value={stStatus} disabled={pending} onChange={(e) => changeStatus(e.target.value)}
            className="h-8 rounded-lg border border-border bg-background px-2 text-xs font-bold outline-none focus:border-primary/40">
            <option value="draft">Draft</option>
            <option value="handover">Hand over to Produksi</option>
          </select>
        ) : (
          <Badge tone={stStatus === "draft" ? "neutral" : "accent"}>{stStatus === "draft" ? "Draft" : "Hand over"}</Badge>
        )}
      </td>
      <td className="py-2.5 pr-4 text-right">
        <div className="inline-flex items-center gap-3">
          <a href={`/print/spk/${row.id}`} target="_blank" rel="noreferrer" title="Buka detail lengkap & print" className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground">
            <Printer className="h-4 w-4" /> Detail / Print
          </a>
          {canEdit && !completed && (cancelled ? (
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
          ))}
        </div>
      </td>
    </tr>
  );
}
