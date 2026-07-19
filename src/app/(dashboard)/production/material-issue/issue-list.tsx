"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Printer, Ban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatIDR } from "@/lib/utils";
import { ListFilter } from "@/components/ui/list-filter";
import { cancelMaterialIssue } from "./actions";

export type IssueLine = { id: string; material_name: string | null; unit: string | null; qty: string | number; unit_cost: string | number };
export type IssueRow = { id: string; code: string; spk_code: string; brand_name: string; warehouse_name: string; issue_date: string | null; status: string; notes: string | null; lines: IssueLine[] };

export function IssueList({ rows, canEdit = true }: { rows: IssueRow[]; canEdit?: boolean }) {
  const [q, setQ] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const brandOpts = useMemo(() => Array.from(new Set(rows.map((r) => r.brand_name))).filter((b) => b && b !== "—").sort(), [rows]);
  const query = q.trim().toLowerCase();
  const list = rows
    .filter((r) => !brandFilter || r.brand_name === brandFilter)
    .filter((r) => !query || r.code.toLowerCase().includes(query) || r.spk_code.toLowerCase().includes(query) || r.lines.some((l) => (l.material_name ?? "").toLowerCase().includes(query)));

  return (
    <div className="space-y-3">
      <ListFilter q={q} setQ={setQ} brandFilter={brandFilter} setBrandFilter={setBrandFilter} brandOpts={brandOpts} count={list.length} unit="issue" placeholder="Cari kode / SPK / material…" />
      {list.length === 0 ? (
        <div className="card p-10 text-center text-sm font-medium text-muted-foreground">Tidak ada material issue yang cocok.</div>
      ) : (
      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <th className="w-8 py-2.5 pl-4"></th>
              <th className="py-2.5 pr-3">Kode</th>
              <th className="py-2.5 pr-3">SPK</th>
              <th className="hidden py-2.5 pr-3 sm:table-cell">Gudang</th>
              <th className="hidden py-2.5 pr-3 sm:table-cell">Tgl</th>
              <th className="py-2.5 pr-3 text-right">Nilai Keluar</th>
              <th className="py-2.5 pr-3">Status</th>
              <th className="py-2.5 pr-4 text-right">Aksi</th>
            </tr>
          </thead>
          {list.map((r) => <Row key={r.id} row={r} canEdit={canEdit} />)}
        </table>
      </div>
      )}
    </div>
  );
}

function Row({ row, canEdit = true }: { row: IssueRow; canEdit?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const cancelled = row.status === "cancelled";
  const total = row.lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unit_cost) || 0), 0);

  return (
    <tbody className="border-b border-border">
      <tr className={cn("font-semibold hover:bg-muted/40", cancelled && "opacity-60")}>
        <td className="py-2.5 pl-4"><button onClick={() => setOpen((o) => !o)} className="grid h-6 w-6 place-items-center rounded-lg hover:bg-muted"><ChevronRight className={cn("h-4 w-4 transition-transform", open && "rotate-90")} /></button></td>
        <td className="py-2.5 pr-3 font-mono text-xs">{row.code}</td>
        <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">{row.spk_code}</td>
        <td className="hidden py-2.5 pr-3 sm:table-cell font-medium text-muted-foreground">{row.warehouse_name}</td>
        <td className="hidden py-2.5 pr-3 sm:table-cell font-medium text-muted-foreground">{row.issue_date ?? "—"}</td>
        <td className="py-2.5 pr-3 text-right tabular-nums">{formatIDR(total)}</td>
        <td className="py-2.5 pr-3">{cancelled ? <Badge tone="danger">Batal</Badge> : <Badge tone="success">Keluar</Badge>}</td>
        <td className="py-2.5 pr-4 text-right">
          <div className="flex items-center justify-end gap-1">
            <a href={`/print/mi/${row.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground"><Printer className="h-4 w-4" /> Print</a>
            {canEdit && !cancelled && (confirm ? (
              <span className="inline-flex items-center gap-1">
                <button className="rounded-lg bg-danger px-2 py-1 text-xs font-bold text-white" disabled={pending} onClick={() => startTransition(async () => { await cancelMaterialIssue(row.id); setConfirm(false); router.refresh(); })}>Batalkan?</button>
                <button className="rounded-lg border border-border px-2 py-1 text-xs font-bold" onClick={() => setConfirm(false)}>Tidak</button>
              </span>
            ) : (
              <Button variant="ghost" size="icon" onClick={() => setConfirm(true)} title="Batalkan (stok dikembalikan)"><Ban className="h-4 w-4" /></Button>
            ))}
          </div>
        </td>
      </tr>
      {open && (
        <tr className="bg-muted/20">
          <td colSpan={8} className="px-5 py-3">
            <div className="overflow-x-auto rounded-xl border border-border bg-surface">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs font-bold uppercase text-muted-foreground">
                  <th className="px-3 py-2">Material</th><th className="px-3 py-2">Satuan</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Avg Cost</th><th className="px-3 py-2 text-right">Nilai</th>
                </tr></thead>
                <tbody>
                  {row.lines.map((l) => (
                    <tr key={l.id} className="border-t border-border/60 font-semibold">
                      <td className="px-3 py-2">{l.material_name ?? "—"}</td>
                      <td className="px-3 py-2 font-medium text-muted-foreground">{l.unit ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{Number(l.qty)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatIDR(Number(l.unit_cost))}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatIDR((Number(l.qty) || 0) * (Number(l.unit_cost) || 0))}</td>
                    </tr>
                  ))}
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
