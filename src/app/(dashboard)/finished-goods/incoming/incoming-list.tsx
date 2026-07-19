"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Printer, Search, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createGrnInvoice } from "./actions";
import { QCDialog } from "./qc-dialog";
import { RepairDialog } from "./repair-dialog";
import type { WarehouseOpt } from "./incoming-form";

export type IncLine = {
  id: string; variant_id: string | null; sku: string | null; size: string | null;
  product_name?: string | null;
  qty_incoming: string | number; qty_good: string | number; qty_repair: string | number; qty_damage: string | number; unit_cost: string | number;
};
export type IncRow = {
  id: string; code: string; po_id: string; po_code: string; brand_id: string | null; brand_name: string; supplier_name: string;
  product_name: string; receipt_date: string | null; incoming_no: number; status: string; invoice_no: string | null; lines: IncLine[];
};

const num = (v: string | number) => Number(v) || 0;
const sumLines = (r: IncRow, f: (l: IncLine) => number) => r.lines.reduce((a, l) => a + f(l), 0);

type Group = { poId: string; poCode: string; brand: string; supplier: string; product: string; batches: IncRow[] };

export function IncomingList({ rows, warehouses }: { rows: IncRow[]; warehouses: WarehouseOpt[] }) {
  const [brandFilter, setBrandFilter] = useState("");
  const [q, setQ] = useState("");

  const brandOpts = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) if (r.brand_id) m.set(r.brand_id, r.brand_name);
    return Array.from(m.entries()).map(([id, name]) => ({ id, name }));
  }, [rows]);

  const groups = new Map<string, Group & { brandId: string | null }>();
  for (const r of rows) {
    const g = groups.get(r.po_id) ?? { poId: r.po_id, poCode: r.po_code, brand: r.brand_name, brandId: r.brand_id, supplier: r.supplier_name, product: r.product_name, batches: [] };
    g.batches.push(r);
    if (!g.product && r.product_name) g.product = r.product_name;
    groups.set(r.po_id, g);
  }
  const query = q.trim().toLowerCase();
  const list = Array.from(groups.values())
    .filter((g) => (!brandFilter || g.brandId === brandFilter))
    .filter((g) => !query || g.poCode.toLowerCase().includes(query) || (g.product ?? "").toLowerCase().includes(query))
    .map((g) => ({ ...g, batches: g.batches.sort((a, b) => a.incoming_no - b.incoming_no) }));

  return (
    <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[220px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari SPK / kode PO / nama produk…"
          className="h-11 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm font-medium outline-none focus:border-primary/40" />
      </div>
      <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}
        className="h-11 rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none focus:border-primary/40">
        <option value="">Semua Brand</option>
        {brandOpts.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
      {(brandFilter || q) && (
        <button onClick={() => { setBrandFilter(""); setQ(""); }} className="h-11 rounded-xl border border-border px-4 text-sm font-bold hover:bg-muted">Reset</button>
      )}
    </div>

    {list.length === 0 ? (
      <div className="card p-10 text-center text-sm font-medium text-muted-foreground">Tidak ada data yang cocok dengan filter.</div>
    ) : (
    <div className="card overflow-x-auto p-0">
      <table className="w-full min-w-[1100px] text-sm">
        <thead>
          <tr className="text-xs font-black uppercase tracking-wide">
            <th className="w-8 py-2 pl-4"></th>
            <th colSpan={4}></th>
            <th colSpan={3} className="border-b-2 border-emerald-500 py-2 text-center text-emerald-700">Initial</th>
            <th colSpan={4} className="border-b-2 border-danger py-2 text-center text-danger">Repair Loop</th>
            <th colSpan={1} className="border-b-2 border-eerie py-2 text-center">Hasil</th>
            <th></th><th></th>
          </tr>
          <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pl-4"></th>
            <th className="py-2 pr-3">PO Number</th>
            <th className="py-2 pr-3">Produk</th>
            <th className="py-2 pr-3">Supplier</th>
            <th className="py-2 pr-3"></th>
            <th className="py-2 px-2 text-right text-emerald-700">Qty In</th>
            <th className="py-2 px-2 text-right text-blue-600">Good 1</th>
            <th className="py-2 px-2 text-right text-danger">→ Repair</th>
            <th className="py-2 px-2 text-right text-emerald-700">Qty Balik</th>
            <th className="py-2 px-2 text-right text-blue-600">Good 2</th>
            <th className="py-2 px-2 text-right text-danger">Damage</th>
            <th className="py-2 px-2 text-right text-danger">Not Ret.</th>
            <th className="py-2 px-2 text-right text-eerie">Total RCV</th>
            <th className="py-2 pr-3">Status</th>
            <th className="py-2 pr-4 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {list.map((g) => <GroupRow key={g.poId} group={g} warehouses={warehouses} />)}
        </tbody>
      </table>
    </div>
    )}
    </div>
  );
}

function GroupRow({ group, warehouses }: { group: Group & { brandId?: string | null }; warehouses: WarehouseOpt[] }) {
  const [open, setOpen] = useState(false);
  const initial = group.batches[0];
  const repairBatches = group.batches.slice(1);

  const qtyIn = initial ? sumLines(initial, (l) => num(l.qty_incoming)) : 0;
  const good1 = initial ? sumLines(initial, (l) => num(l.qty_good)) : 0;
  const repair = group.batches.reduce((s, b) => s + sumLines(b, (l) => num(l.qty_repair)), 0);
  const qtyBalik = repairBatches.reduce((s, b) => s + sumLines(b, (l) => num(l.qty_incoming)), 0);
  const good2 = repairBatches.reduce((s, b) => s + sumLines(b, (l) => num(l.qty_good)), 0);
  const damage = group.batches.reduce((s, b) => s + sumLines(b, (l) => num(l.qty_damage)), 0);
  const notRet = Math.max(0, repair - qtyBalik);
  const totalRcv = good1 + good2;

  const anyInbound = group.batches.some((b) => b.status === "inbound");
  const anyRepair = group.batches.some((b) => b.status === "repair");
  const overall = anyInbound
    ? <Badge tone="info">Menunggu QC</Badge>
    : anyRepair
    ? <Badge tone="accent">Menunggu Repair</Badge>
    : <Badge tone="success">Selesai</Badge>;

  // Indikator invoice per PO: batch yang layak ditagih (sudah QC & ada Good) vs yang sudah ada invoice.
  const invoiceable = group.batches.filter((b) => b.status !== "inbound" && sumLines(b, (l) => num(l.qty_good)) > 0);
  const invoiced = invoiceable.filter((b) => b.invoice_no);
  const invoiceBadge = invoiceable.length === 0
    ? null
    : invoiced.length === invoiceable.length
    ? <Badge tone="success">Invoice ✓</Badge>
    : invoiced.length === 0
    ? <Badge tone="danger">Invoice belum</Badge>
    : <Badge tone="accent">Invoice {invoiced.length}/{invoiceable.length}</Badge>;

  return (
    <>
      <tr className="border-t border-border font-semibold hover:bg-muted/40">
        <td className="py-3 pl-4">
          <button onClick={() => setOpen((o) => !o)} className="grid h-6 w-6 place-items-center rounded-lg hover:bg-muted">
            <ChevronRight className={cn("h-4 w-4 transition-transform", open && "rotate-90")} />
          </button>
        </td>
        <td className="py-3 pr-3"><span className="font-mono text-xs text-primary">{group.poCode}</span><br /><span className="text-xs font-medium text-muted-foreground">{group.brand} · {group.batches.length} batch</span></td>
        <td className="py-3 pr-3">{group.product || "—"}</td>
        <td className="py-3 pr-3 font-medium text-muted-foreground">{group.supplier}</td>
        <td></td>
        <td className="py-3 px-2 text-right font-bold tabular-nums text-emerald-700">{qtyIn || "—"}</td>
        <td className="py-3 px-2 text-right font-bold tabular-nums text-blue-600">{good1 || "—"}</td>
        <td className="py-3 px-2 text-right font-bold tabular-nums text-danger">{repair || "—"}</td>
        <td className="py-3 px-2 text-right font-bold tabular-nums text-emerald-700">{qtyBalik || "—"}</td>
        <td className="py-3 px-2 text-right font-bold tabular-nums text-blue-600">{good2 || "—"}</td>
        <td className="py-3 px-2 text-right font-bold tabular-nums text-danger">{damage || "—"}</td>
        <td className="py-3 px-2 text-right font-bold tabular-nums text-danger/70">{notRet || "—"}</td>
        <td className="py-3 px-2 text-right text-base font-black tabular-nums text-eerie">{totalRcv || "—"}</td>
        <td className="py-3 pr-3"><div className="flex flex-col items-start gap-1">{overall}{invoiceBadge}</div></td>
        <td className="py-3 pr-4 text-right"></td>
      </tr>

      {open && group.batches.map((b) => <BatchRow key={b.id} row={b} warehouses={warehouses} />)}
    </>
  );
}

function BatchRow({ row, warehouses }: { row: IncRow; warehouses: WarehouseOpt[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const inc = sumLines(row, (l) => num(l.qty_incoming));
  const good = sumLines(row, (l) => num(l.qty_good));
  const repair = sumLines(row, (l) => num(l.qty_repair));
  const damage = sumLines(row, (l) => num(l.qty_damage));

  const badge = row.status === "inbound"
    ? <Badge tone="info">Inbound · menunggu QC</Badge>
    : row.status === "repair"
    ? <Badge tone="accent">Repair · retur vendor</Badge>
    : <Badge tone="success">Selesai</Badge>;

  return (
    <tr className="border-t border-border/60 bg-muted/20 text-sm">
      <td></td>
      <td className="py-2 pr-3 pl-2"><span className="font-mono text-xs">{row.code}</span> <span className="text-xs text-muted-foreground">(batch {row.incoming_no})</span></td>
      <td className="py-2 pr-3 text-xs text-muted-foreground" colSpan={2}>{row.receipt_date ?? "—"}</td>
      <td></td>
      <td className="py-2 px-2 text-right tabular-nums text-emerald-700">{inc || "—"}</td>
      <td className="py-2 px-2 text-right tabular-nums text-blue-600">{good || "—"}</td>
      <td className="py-2 px-2 text-right tabular-nums text-danger">{repair || "—"}</td>
      <td colSpan={3}></td>
      <td className="py-2 px-2 text-right tabular-nums text-danger">{damage || "—"}</td>
      <td></td>
      <td className="py-2 pr-3">{badge}</td>
      <td className="py-2 pr-4 text-right">
        <div className="flex items-center justify-end gap-1">
          {row.status === "inbound" && (
            <QCDialog receipt={{ id: row.id, code: row.code, brandId: row.brand_id, incomingNo: row.incoming_no, lines: row.lines }} warehouses={warehouses} />
          )}
          {row.status === "repair" && (
            <RepairDialog receipt={{ id: row.id, code: row.code, lines: row.lines.map((l) => ({ sku: (l.sku as string) ?? "", size: (l.size as string) ?? "", qtyRepair: num(l.qty_repair) })) }} />
          )}
          {row.status !== "inbound" && good > 0 && (
            row.invoice_no ? (
              <a href={`/print/grninvoice/${row.id}`} target="_blank" rel="noreferrer" title={`Invoice ${row.invoice_no}`}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:opacity-80">
                <FileText className="h-4 w-4" /> Invoice
              </a>
            ) : (
              <Button variant="ghost" size="sm" disabled={pending} title="Terbitkan invoice jasa dari Good batch ini"
                onClick={() => startTransition(async () => { const r = await createGrnInvoice(row.id); if (r.ok) { window.open(`/print/grninvoice/${row.id}`, "_blank"); router.refresh(); } })}>
                <FileText className="h-4 w-4" /> Buat Invoice
              </Button>
            )
          )}
          <a href={`/print/grn/${row.id}`} target="_blank" rel="noreferrer" title="Detail & print"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground">
            <Printer className="h-4 w-4" /> Print
          </a>
        </div>
      </td>
    </tr>
  );
}
