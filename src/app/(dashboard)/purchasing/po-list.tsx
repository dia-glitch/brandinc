"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Ban, RotateCcw, PackageCheck, Printer, FileText, X, Search, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatIDR } from "@/lib/utils";
import { cancelPO, restorePO, receivePO, createInvoiceRef } from "./actions";

export type POLine = {
  id: string;
  material_id: string | null;
  material_name: string | null;
  unit: string | null;
  qty: string | number;
  unit_price: string | number;
  received_qty: string | number;
};
export type PORow = {
  id: string;
  code: string;
  po_date: string | null;
  expected_date: string | null;
  brand_name: string;
  supplier_name: string;
  status: string;
  notes: string | null;
  ppn_percent: number;
  ppn_amount: number;
  invoice_no: string | null;
  invoice_date: string | null;
  lines: POLine[];
};
const poTotal = (r: PORow) => r.lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unit_price) || 0), 0) + (Number(r.ppn_amount) || 0);

export function POList({ rows, canEdit = true }: { rows: PORow[]; canEdit?: boolean }) {
  const [q, setQ] = useState("");
  const [brandFilter, setBrandFilter] = useState("");

  const brandOpts = useMemo(() => Array.from(new Set(rows.map((r) => r.brand_name))).filter((b) => b && b !== "—").sort(), [rows]);
  const query = q.trim().toLowerCase();
  const list = rows
    .filter((r) => !brandFilter || r.brand_name === brandFilter)
    .filter((r) => !query || r.code.toLowerCase().includes(query) || r.supplier_name.toLowerCase().includes(query) || r.lines.some((l) => (l.material_name ?? "").toLowerCase().includes(query)));

  function downloadCsv() {
    const header = ["Kode PO", "Brand", "Supplier", "Tanggal", "Status", "Total", "Invoice"];
    const body = list.map((r) => [r.code, r.brand_name, r.supplier_name, r.po_date ?? "", r.status, poTotal(r), r.invoice_no ?? ""]);
    const csv = [header, ...body].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "purchase-order-bahan.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari kode PO / supplier / material…"
            className="h-11 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm font-medium outline-none focus:border-primary/40" />
        </div>
        <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} className="h-11 rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none focus:border-primary/40">
          <option value="">Semua Brand</option>
          {brandOpts.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <button onClick={downloadCsv} className="inline-flex h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-bold hover:bg-muted"><Download className="h-4 w-4" /> Download</button>
        {(q || brandFilter) && <button onClick={() => { setQ(""); setBrandFilter(""); }} className="h-11 rounded-xl border border-border px-4 text-sm font-bold hover:bg-muted">Reset</button>}
        <span className="ml-auto self-center text-sm font-medium text-muted-foreground">{list.length} PO</span>
      </div>

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
                <th className="py-2.5 pr-3">Supplier</th>
                <th className="hidden py-2.5 pr-3 sm:table-cell">Tanggal</th>
                <th className="py-2.5 pr-3 text-right">Total</th>
                <th className="py-2.5 pr-3">Status</th>
                <th className="py-2.5 pr-4 text-right">Aksi</th>
              </tr>
            </thead>
            {list.map((r) => <PORowItem key={r.id} row={r} canEdit={canEdit} />)}
          </table>
        </div>
      )}
    </div>
  );
}

function PORowItem({ row, canEdit = true }: { row: PORow; canEdit?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [receiving, setReceiving] = useState(false);

  const cancelled = row.status === "cancelled";
  const received = row.status === "received";
  const subtotal = row.lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unit_price) || 0), 0);
  const total = subtotal + (Number(row.ppn_amount) || 0);

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
        <td className="hidden py-2.5 pr-3 sm:table-cell font-medium text-muted-foreground">{row.po_date ?? "—"}</td>
        <td className="py-2.5 pr-3 text-right tabular-nums">{formatIDR(total)}</td>
        <td className="py-2.5 pr-3">
          {cancelled ? <Badge tone="danger">Batal</Badge> : received ? <Badge tone="success">Diterima</Badge> : <Badge tone="neutral">Dipesan</Badge>}
        </td>
        <td className="py-2.5 pr-4 text-right">
          <div className="flex items-center justify-end gap-1">
            <a href={`/print/po/${row.id}`} target="_blank" rel="noreferrer" title="Buka detail lengkap & print"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground">
              <Printer className="h-4 w-4" /> Detail / Print
            </a>
            {received && row.invoice_no && (
              <a href={`/print/invoice/${row.id}`} target="_blank" rel="noreferrer" title={`Invoice ${row.invoice_no}`}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:opacity-80">
                <FileText className="h-4 w-4" /> Invoice
              </a>
            )}
            {canEdit && received && !row.invoice_no && (
              <Button variant="ghost" size="sm" disabled={pending} title="Buat invoice reference untuk supplier & finance"
                onClick={() => startTransition(async () => {
                  const r = await createInvoiceRef(row.id);
                  if (r.ok) { window.open(`/print/invoice/${row.id}`, "_blank"); router.refresh(); }
                })}>
                <FileText className="h-4 w-4" /> Buat Invoice
              </Button>
            )}
            {canEdit && !cancelled && !received && (
              <Button variant="ghost" size="sm" onClick={() => setReceiving(true)} title="Terima bahan">
                <PackageCheck className="h-4 w-4" /> Terima
              </Button>
            )}
            {canEdit && (cancelled ? (
              <Button variant="ghost" size="icon" disabled={pending} title="Aktifkan lagi"
                onClick={() => startTransition(async () => { await restorePO(row.id); router.refresh(); })}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            ) : !received && (
              confirmCancel ? (
                <span className="inline-flex items-center gap-1">
                  <button className="rounded-lg bg-danger px-2 py-1 text-xs font-bold text-white" disabled={pending}
                    onClick={() => startTransition(async () => { await cancelPO(row.id); setConfirmCancel(false); router.refresh(); })}>Batalkan?</button>
                  <button className="rounded-lg border border-border px-2 py-1 text-xs font-bold" onClick={() => setConfirmCancel(false)}>Tidak</button>
                </span>
              ) : (
                <Button variant="ghost" size="icon" onClick={() => setConfirmCancel(true)} title="Batalkan PO"><Ban className="h-4 w-4" /></Button>
              )
            ))}
          </div>
        </td>
      </tr>

      {open && (
        <tr className="bg-muted/20">
          <td colSpan={8} className="px-5 py-3">
            <div className="overflow-x-auto rounded-xl border border-border bg-surface">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-bold uppercase text-muted-foreground">
                    <th className="px-3 py-2">Material</th>
                    <th className="px-3 py-2 text-right">Qty Pesan</th>
                    <th className="px-3 py-2">Satuan</th>
                    <th className="px-3 py-2 text-right">Harga</th>
                    <th className="px-3 py-2 text-right">Subtotal</th>
                    <th className="px-3 py-2 text-right">Diterima</th>
                  </tr>
                </thead>
                <tbody>
                  {row.lines.map((l) => (
                    <tr key={l.id} className="border-t border-border/60 font-semibold">
                      <td className="px-3 py-2">{l.material_name ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{Number(l.qty)}</td>
                      <td className="px-3 py-2 font-medium text-muted-foreground">{l.unit ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatIDR(Number(l.unit_price))}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatIDR((Number(l.qty) || 0) * (Number(l.unit_price) || 0))}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{Number(l.received_qty) > 0 ? Number(l.received_qty) : "—"}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-border font-semibold text-muted-foreground">
                    <td className="px-3 py-2" colSpan={4}>Subtotal</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatIDR(subtotal)}</td>
                    <td></td>
                  </tr>
                  <tr className="font-semibold text-muted-foreground">
                    <td className="px-3 py-2" colSpan={4}>PPN {Number(row.ppn_percent) || 0}%</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatIDR(Number(row.ppn_amount) || 0)}</td>
                    <td></td>
                  </tr>
                  <tr className="border-t border-border bg-muted/30 font-extrabold">
                    <td className="px-3 py-2" colSpan={4}>Total</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatIDR(total)}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
            {row.notes && <p className="mt-2 text-xs font-medium text-muted-foreground">Catatan: {row.notes}</p>}
          </td>
        </tr>
      )}

      {receiving && <ReceiveModal row={row} onClose={() => setReceiving(false)} />}
    </tbody>
  );
}

function ReceiveModal({ row, onClose }: { row: PORow; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [qtys, setQtys] = useState<Record<string, string>>(
    Object.fromEntries(row.lines.map((l) => [l.id, String(Number(l.qty) || "")]))
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const lines = row.lines
      .map((l) => ({ lineId: l.id, materialId: l.material_id ?? "", qty: Number(qtys[l.id]) || 0, unitPrice: Number(l.unit_price) || 0 }))
      .filter((l) => l.materialId && l.qty > 0);
    if (lines.length === 0) { setError("Isi qty terima minimal satu baris."); return; }
    startTransition(async () => {
      const res = await receivePO(row.id, lines);
      if (!res.ok) { setError(res.error); return; }
      onClose();
      router.refresh();
    });
  }

  return (
    <tr>
      <td>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-eerie/40 p-4">
          <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-surface p-6 text-left shadow-soft">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-extrabold">Terima Bahan · <span className="font-mono text-base">{row.code}</span></h2>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div className="rounded-xl bg-muted/60 px-3.5 py-2.5 text-sm font-semibold">
                Masuk ke <b>Gudang Bahan Baku</b> (otomatis, terpisah dari gudang finished goods).
              </div>

              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-bold uppercase text-muted-foreground">
                      <th className="px-3 py-2">Material</th>
                      <th className="px-3 py-2 text-right">Qty Pesan</th>
                      <th className="px-3 py-2 text-right">Qty Terima</th>
                      <th className="px-3 py-2 text-right">Harga</th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.lines.map((l) => (
                      <tr key={l.id} className="border-t border-border/60 font-semibold">
                        <td className="px-3 py-2">{l.material_name ?? "—"} <span className="text-xs font-medium text-muted-foreground">{l.unit ?? ""}</span></td>
                        <td className="px-3 py-2 text-right tabular-nums">{Number(l.qty)}</td>
                        <td className="px-3 py-2 text-right">
                          <input type="number" value={qtys[l.id] ?? ""} onChange={(e) => setQtys((p) => ({ ...p, [l.id]: e.target.value }))}
                            className="h-9 w-24 rounded-lg border border-border bg-background px-2 text-right text-sm font-semibold outline-none focus:border-primary/40" placeholder="0" />
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatIDR(Number(l.unit_price))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs font-medium text-muted-foreground">Qty terima bisa diubah bila jumlah datang tidak sama dengan pesanan. Nilai masuk memakai harga PO (moving average).</p>

              {error && <p className="text-sm font-semibold text-danger">{error}</p>}

              <div className="flex justify-end gap-2.5 pt-1">
                <Button type="button" variant="ghost" size="sm" onClick={onClose}>Batal</Button>
                <Button type="submit" size="sm" disabled={pending}>{pending ? "Memproses…" : "Terima & Masukkan Stok"}</Button>
              </div>
            </form>
          </div>
        </div>
      </td>
    </tr>
  );
}

