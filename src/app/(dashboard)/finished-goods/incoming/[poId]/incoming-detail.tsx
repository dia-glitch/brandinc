"use client";

import Link from "next/link";
import { ArrowLeft, Printer, FileText, Package, QrCode } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { QCDialog } from "../qc-dialog";
import { RepairDialog } from "../repair-dialog";
import type { IncRow, IncLine } from "../incoming-list";
import type { WarehouseOpt } from "../incoming-form";

export type POInfo = {
  poId: string; poCode: string; spkCode: string; supplier: string;
  product: string; brand: string; totalQtyPo: number; status: string;
};

const num = (v: string | number) => Number(v) || 0;
const sum = (r: IncRow, f: (l: IncLine) => number) => r.lines.reduce((a, l) => a + f(l), 0);

export function IncomingDetail({ info, rows, warehouses, canEdit }: { info: POInfo; rows: IncRow[]; warehouses: WarehouseOpt[]; canEdit: boolean }) {
  const initial = rows[0];
  const repairBatches = rows.slice(1);
  const qtyIn = initial ? sum(initial, (l) => num(l.qty_incoming)) : 0;
  const good1 = initial ? sum(initial, (l) => num(l.qty_good)) : 0;
  const repair = rows.reduce((s, b) => s + sum(b, (l) => num(l.qty_repair)), 0);
  const qtyBalik = repairBatches.reduce((s, b) => s + sum(b, (l) => num(l.qty_incoming)), 0);
  const good2 = repairBatches.reduce((s, b) => s + sum(b, (l) => num(l.qty_good)), 0);
  const damage = rows.reduce((s, b) => s + sum(b, (l) => num(l.qty_damage)), 0);
  const notRet = Math.max(0, repair - qtyBalik);
  const totalRcv = good1 + good2;

  const anyInbound = rows.some((b) => b.status === "inbound");
  const anyRepair = rows.some((b) => b.status === "repair");
  const overall = anyInbound ? <Badge tone="info">Menunggu QC</Badge> : anyRepair ? <Badge tone="accent">Menunggu Repair</Badge> : <Badge tone="success">Selesai</Badge>;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/finished-goods/incoming" className="grid h-10 w-10 place-items-center rounded-full border border-border hover:bg-muted"><ArrowLeft className="h-4 w-4" /></Link>
          <div>
            <h1 className="text-2xl font-extrabold">Detail Inbound</h1>
            <p className="font-mono text-xs text-muted-foreground">{info.poCode}</p>
          </div>
        </div>
        <Link href={`/finished-goods/incoming/${info.poId}/barcode`} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-bold hover:bg-muted">
          <QrCode className="h-4 w-4" /> Cetak Barcode
        </Link>
      </div>

      {/* Informasi PO */}
      <div className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">Informasi PO</h2>
          {overall}
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <Info label="PO Number" value={info.poCode} mono />
          <Info label="SPK Number" value={info.spkCode} mono />
          <Info label="Supplier" value={info.supplier} />
          <Info label="Product" value={info.product} />
          <Info label="Brand" value={info.brand} />
          <Info label="Total Qty PO" value={`${info.totalQtyPo} pcs`} />
        </div>
        {/* Ringkasan progress */}
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-muted/40 p-3 text-center sm:grid-cols-4 lg:grid-cols-7">
          <Stat label="Qty In" value={qtyIn} tone="emerald" />
          <Stat label="Good 1" value={good1} tone="blue" />
          <Stat label="→ Repair" value={repair} tone="danger" />
          <Stat label="Qty Balik" value={qtyBalik} tone="emerald" />
          <Stat label="Good 2" value={good2} tone="blue" />
          <Stat label="Damage" value={damage} tone="danger" />
          <Stat label="Total RCV" value={totalRcv} tone="eerie" strong />
        </div>
        {notRet > 0 && <p className="mt-2 text-xs font-semibold text-danger">{notRet} pcs tidak kembali dari repair (dianggap hilang di vendor).</p>}
      </div>

      {/* Batch cards */}
      {rows.map((b) => <BatchCard key={b.id} row={b} warehouses={warehouses} canEdit={canEdit} />)}
    </div>
  );
}

function BatchCard({ row, warehouses, canEdit }: { row: IncRow; warehouses: WarehouseOpt[]; canEdit: boolean }) {
  const qtyIn = sum(row, (l) => num(l.qty_incoming));
  const good = sum(row, (l) => num(l.qty_good));
  const done = row.status !== "inbound";

  const title = row.incoming_no === 1 ? "Initial Incoming" : `Repair Batch ${row.incoming_no}`;
  const badge = row.status === "inbound" ? <Badge tone="info">Menunggu QC</Badge> : row.status === "repair" ? <Badge tone="accent">Repair · retur vendor</Badge> : <Badge tone="success">QC Done</Badge>;

  return (
    <div className="card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-base font-extrabold"><Package className="h-4 w-4" /> {title} — <span className="font-mono text-sm text-muted-foreground">{row.code}</span></h3>
        <div className="flex flex-wrap items-center gap-2">
          {badge}
          {canEdit && row.status === "inbound" && (
            <QCDialog receipt={{ id: row.id, code: row.code, brandId: row.brand_id, incomingNo: row.incoming_no, lines: row.lines }} warehouses={warehouses} />
          )}
          {canEdit && row.status === "repair" && (
            <RepairDialog receipt={{ id: row.id, code: row.code, lines: row.lines.map((l) => ({ sku: (l.sku as string) ?? "", size: (l.size as string) ?? "", qtyRepair: num(l.qty_repair) })) }} />
          )}
          {done && good > 0 && (
            row.invoice_no ? (
              <a href={`/print/grninvoice/${row.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 px-3 py-1.5 text-xs font-bold text-emerald-600 hover:bg-emerald-50"><FileText className="h-4 w-4" /> Invoice {row.invoice_no}</a>
            ) : canEdit ? (
              <Link href="/finished-goods/invoice" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold hover:bg-muted"><FileText className="h-4 w-4" /> Buat Reference</Link>
            ) : null
          )}
          <a href={`/print/grn/${row.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground hover:bg-muted"><Printer className="h-4 w-4" /> Print</a>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <Info label="Receipt No." value={row.code} mono />
        <Info label="Tanggal Terima" value={row.receipt_date ?? "—"} />
        <Info label="Qty Diterima" value={`${qtyIn} pcs`} />
        {done && <Info label="Good / Damage" value={`${good} / ${sum(row, (l) => num(l.qty_damage))}`} />}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2">SKU</th>
              <th className="px-4 py-2">Size</th>
              <th className="px-4 py-2 text-right">Qty In</th>
              {done && <th className="px-4 py-2 text-right text-blue-600">Good</th>}
              {done && <th className="px-4 py-2 text-right text-danger">Repair</th>}
              {done && <th className="px-4 py-2 text-right text-danger">Damage</th>}
            </tr>
          </thead>
          <tbody>
            {row.lines.map((l) => (
              <tr key={l.id} className="border-t border-border/60">
                <td className="px-4 py-2"><span className="rounded-md bg-honeydew/40 px-2 py-0.5 font-mono text-xs font-bold">{l.sku ?? "—"}</span></td>
                <td className="px-4 py-2 font-semibold">{l.size ?? "—"}</td>
                <td className="px-4 py-2 text-right tabular-nums font-semibold">{num(l.qty_incoming)}</td>
                {done && <td className="px-4 py-2 text-right tabular-nums text-blue-600">{num(l.qty_good) || "—"}</td>}
                {done && <td className="px-4 py-2 text-right tabular-nums text-danger">{num(l.qty_repair) || "—"}</td>}
                {done && <td className="px-4 py-2 text-right tabular-nums text-danger">{num(l.qty_damage) || "—"}</td>}
              </tr>
            ))}
            <tr className="border-t border-border bg-muted/30 font-bold">
              <td className="px-4 py-2" colSpan={2}>Total</td>
              <td className="px-4 py-2 text-right tabular-nums">{qtyIn}</td>
              {done && <td className="px-4 py-2 text-right tabular-nums text-blue-600">{good}</td>}
              {done && <td className="px-4 py-2 text-right tabular-nums text-danger">{sum(row, (l) => num(l.qty_repair))}</td>}
              {done && <td className="px-4 py-2 text-right tabular-nums text-danger">{sum(row, (l) => num(l.qty_damage))}</td>}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={"mt-0.5 break-words font-bold " + (mono ? "font-mono text-sm" : "")}>{value}</p>
    </div>
  );
}

function Stat({ label, value, tone, strong }: { label: string; value: number; tone: "emerald" | "blue" | "danger" | "eerie"; strong?: boolean }) {
  const cls = tone === "emerald" ? "text-emerald-700" : tone === "blue" ? "text-blue-600" : tone === "danger" ? "text-danger" : "text-eerie";
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={"tabular-nums " + cls + " " + (strong ? "text-xl font-black" : "text-lg font-extrabold")}>{value || "—"}</p>
    </div>
  );
}
