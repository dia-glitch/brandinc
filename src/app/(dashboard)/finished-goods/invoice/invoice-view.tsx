"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, FileDown, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatIDR } from "@/lib/utils";
import { createGrnInvoice } from "../incoming/actions";

export type InvRow = {
  id: string; code: string; poCode: string; product: string; brand: string; brandId: string | null;
  supplier: string; date: string | null; good: number; value: number; invoiceNo: string | null; invoiceDate: string | null;
};

export function InvoiceView({ rows, canInvoice }: { rows: InvRow[]; canInvoice: boolean }) {
  const [tab, setTab] = useState<"pending" | "log">("pending");
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState("");

  const brandOpts = useMemo(() => Array.from(new Set(rows.map((r) => r.brand))).filter((b) => b && b !== "—").sort(), [rows]);
  const query = q.trim().toLowerCase();
  const match = (r: InvRow) => (!brand || r.brand === brand) && (!query || (r.poCode + " " + r.code + " " + r.product + " " + r.supplier + " " + (r.invoiceNo ?? "")).toLowerCase().includes(query));

  const pending = rows.filter((r) => !r.invoiceNo && r.good > 0).filter(match);
  const log = rows.filter((r) => r.invoiceNo).filter(match);

  const stat = useMemo(() => {
    const inv = rows.filter((r) => r.good > 0 || r.invoiceNo);
    const notInv = rows.filter((r) => !r.invoiceNo && r.good > 0);
    return {
      total: inv.length,
      pending: notInv.length,
      done: rows.filter((r) => r.invoiceNo).length,
      pendingValue: notInv.reduce((s, r) => s + r.value, 0),
    };
  }, [rows]);

  const list = tab === "pending" ? pending : log;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Finished Goods</p>
        <h1 className="text-2xl font-extrabold">Invoice — Jasa Produksi</h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          Tiap penerimaan yang <b>sudah QC &amp; ada Good</b> masuk ke sini untuk diterbitkan invoice jasa ke supplier.
          Setelah dibuat, invoice masuk ke <b>Finance → Hutang (AP)</b>.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card label="Receipt QC" value={String(stat.total)} />
        <Card label="Belum Di-invoice" value={String(stat.pending)} tone={stat.pending ? "warn" : undefined} />
        <Card label="Sudah Di-invoice" value={String(stat.done)} />
        <Card label="Nilai Belum Di-invoice" value={formatIDR(stat.pendingValue)} tone={stat.pendingValue ? "danger" : undefined} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          <button onClick={() => setTab("pending")} data-active={tab === "pending"} className="pill">Belum di-invoice ({pending.length})</button>
          <button onClick={() => setTab("log")} data-active={tab === "log"} className="pill">Log ({log.length})</button>
        </div>
        <div className="relative ml-auto w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari PO / invoice / supplier…" className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm font-medium outline-none focus:border-primary/40" />
        </div>
        <select value={brand} onChange={(e) => setBrand(e.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none focus:border-primary/40">
          <option value="">Semua Brand</option>
          {brandOpts.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>

      {list.length === 0 ? (
        <div className="card p-10 text-center text-sm font-medium text-muted-foreground">
          {tab === "pending" ? "Tidak ada receiving yang menunggu invoice." : "Belum ada invoice."}
        </div>
      ) : tab === "pending" ? (
        <div className="space-y-2">
          {pending.map((r) => (
            <div key={r.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-bold">{r.poCode}</span>
                  <span className="font-mono text-xs text-muted-foreground">{r.code}</span>
                  <Badge tone="accent">{r.good} pcs Good</Badge>
                </div>
                <p className="mt-1 text-sm font-bold">{r.product} <span className="font-medium text-muted-foreground">· {r.brand} · {r.supplier}</span></p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-lg font-extrabold tabular-nums">{formatIDR(r.value)}</span>
                {canInvoice ? <InvoiceBtn id={r.id} /> : <span className="text-xs font-semibold text-muted-foreground">Menunggu Finance/QC</span>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Invoice No.</th>
                <th className="px-4 py-3">PO</th>
                <th className="px-4 py-3">Produk</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Tgl Invoice</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {log.map((r) => (
                <tr key={r.id} className="border-t border-border font-semibold">
                  <td className="px-4 py-3 font-mono text-xs text-emerald-600">{r.invoiceNo}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.poCode}</td>
                  <td className="px-4 py-3">{r.product}</td>
                  <td className="px-4 py-3 font-medium text-muted-foreground">{r.supplier}</td>
                  <td className="px-4 py-3 font-medium text-muted-foreground">{r.invoiceDate ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatIDR(r.value)}</td>
                  <td className="px-4 py-3 text-right">
                    <a href={`/print/grninvoice/${r.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold hover:bg-muted"><FileText className="h-4 w-4" /> Lihat</a>
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

function InvoiceBtn({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button size="sm" disabled={pending} onClick={() => start(async () => {
      const r = await createGrnInvoice(id);
      if (r.ok) { window.open(`/print/grninvoice/${id}`, "_blank"); router.refresh(); }
    })}>
      <FileDown className="h-4 w-4" /> {pending ? "Membuat…" : "Buat Invoice"}
    </Button>
  );
}

function Card({ label, value, tone }: { label: string; value: string; tone?: "warn" | "danger" }) {
  const color = tone === "danger" ? "text-red-600" : tone === "warn" ? "text-amber-600" : "text-foreground";
  return (
    <div className="card p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={"mt-1 text-xl font-extrabold tabular-nums " + color}>{value}</p>
    </div>
  );
}
