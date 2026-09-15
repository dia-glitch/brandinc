"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { WarehouseOpt } from "./incoming-form";

export type IncLine = {
  id: string; variant_id: string | null; sku: string | null; size: string | null;
  product_name?: string | null;
  qty_incoming: string | number; qty_good: string | number; qty_repair: string | number; qty_damage: string | number; unit_cost: string | number;
};
export type IncRow = {
  id: string; code: string; po_id: string; po_code: string; brand_id: string | null; brand_name: string; supplier_name: string;
  product_name: string; receipt_date: string | null; incoming_no: number; status: string; invoice_no: string | null; po_closed: boolean; lines: IncLine[];
};
// Setiap PO Produksi yang sudah dibuat otomatis muncul (walau belum ada penerimaan).
export type POStub = { poId: string; poCode: string; brand: string; brandId: string | null; supplier: string; product: string; closed: boolean };

const num = (v: string | number) => Number(v) || 0;
const sumLines = (r: IncRow, f: (l: IncLine) => number) => r.lines.reduce((a, l) => a + f(l), 0);

type Group = { poId: string; poCode: string; brand: string; brandId: string | null; supplier: string; product: string; closed: boolean; batches: IncRow[] };

export function IncomingList({ rows, pos = [], canEdit = true }: { rows: IncRow[]; pos?: POStub[]; warehouses?: WarehouseOpt[]; canEdit?: boolean }) {
  const [brandFilter, setBrandFilter] = useState("");
  const [q, setQ] = useState("");
  const [view, setView] = useState<"aktif" | "selesai">("aktif");
  void canEdit;

  const groups = useMemo(() => {
    const m = new Map<string, Group>();
    // 1) Semua PO dulu (biar yang belum diterima pun tampil).
    for (const p of pos) m.set(p.poId, { poId: p.poId, poCode: p.poCode, brand: p.brand, brandId: p.brandId, supplier: p.supplier, product: p.product, closed: p.closed, batches: [] });
    // 2) Tempelkan batch penerimaan ke PO-nya.
    for (const r of rows) {
      let g = m.get(r.po_id);
      if (!g) { g = { poId: r.po_id, poCode: r.po_code, brand: r.brand_name, brandId: r.brand_id, supplier: r.supplier_name, product: r.product_name, closed: r.po_closed, batches: [] }; m.set(r.po_id, g); }
      g.batches.push(r);
      if (!g.product && r.product_name) g.product = r.product_name;
    }
    return Array.from(m.values()).map((g) => ({ ...g, batches: g.batches.sort((a, b) => a.incoming_no - b.incoming_no) }));
  }, [rows, pos]);

  const brandOpts = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of groups) if (g.brandId) m.set(g.brandId, g.brand);
    return Array.from(m.entries()).map(([id, name]) => ({ id, name }));
  }, [groups]);

  const query = q.trim().toLowerCase();
  const aktifCount = groups.filter((g) => !g.closed).length;
  const selesaiCount = groups.filter((g) => g.closed).length;
  const list = groups
    .filter((g) => (view === "selesai" ? g.closed : !g.closed))
    .filter((g) => (!brandFilter || g.brandId === brandFilter))
    .filter((g) => !query || g.poCode.toLowerCase().includes(query) || (g.product ?? "").toLowerCase().includes(query));

  const belumDiterima = groups.filter((g) => !g.closed && g.batches.length === 0).length;

  return (
    <div className="space-y-3">
      <div className="flex w-fit rounded-xl border border-border bg-background p-0.5">
        {([["aktif", "Aktif", aktifCount], ["selesai", "Selesai", selesaiCount]] as const).map(([v, label, n]) => (
          <button key={v} onClick={() => setView(v)} data-active={view === v}
            className={"inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-bold transition " + (view === v ? "bg-eerie text-white" : "text-muted-foreground hover:text-foreground")}>
            {label} <span className={"rounded-full px-1.5 text-[11px] " + (view === v ? "bg-white/20" : "bg-muted")}>{n}</span>
          </button>
        ))}
      </div>
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
        {belumDiterima > 0 && <span className="rounded-full bg-vanila px-3 py-1.5 text-xs font-bold text-eerie">{belumDiterima} PO belum diterima</span>}
      </div>

      {list.length === 0 ? (
        <div className="card p-10 text-center text-sm font-medium text-muted-foreground">Tidak ada data yang cocok dengan filter.</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[1080px] text-sm">
            <thead>
              <tr className="text-xs font-black uppercase tracking-wide">
                <th colSpan={4}></th>
                <th colSpan={3} className="border-b-2 border-emerald-500 py-2 text-center text-emerald-700">Initial</th>
                <th colSpan={4} className="border-b-2 border-danger py-2 text-center text-danger">Repair Loop</th>
                <th colSpan={1} className="border-b-2 border-eerie py-2 text-center">Hasil</th>
                <th></th><th></th>
              </tr>
              <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pl-4 pr-3">PO Number</th>
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
              {list.map((g) => <GroupRow key={g.poId} group={g} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function GroupRow({ group }: { group: Group }) {
  const empty = group.batches.length === 0;
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
  const closed = group.closed;
  const overall = empty ? <Badge tone="accent">Belum diterima</Badge>
    : closed ? <Badge tone="success">Selesai (Delivered)</Badge>
    : anyInbound ? <Badge tone="info">Menunggu QC</Badge>
    : anyRepair ? <Badge tone="accent">Menunggu Repair</Badge>
    : (totalRcv >= qtyIn && qtyIn > 0) ? <Badge tone="accent">Lengkap · siap tutup</Badge>
    : <Badge tone="neutral">Berjalan</Badge>;

  const batchLabel = empty ? "belum ada batch" : `${group.batches.length} batch`;

  return (
    <tr className={"border-t border-border font-semibold hover:bg-muted/40 " + (empty ? "bg-vanila/10" : "")}>
      <td className="py-3 pl-4 pr-3"><span className="font-mono text-xs text-primary">{group.poCode}</span><br /><span className="text-xs font-medium text-muted-foreground">{group.brand} · {batchLabel}</span></td>
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
      <td className="py-3 pr-3">{overall}</td>
      <td className="py-3 pr-4 text-right">
        <Link href={`/finished-goods/incoming/${group.poId}`} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold hover:bg-muted">
          <Eye className="h-4 w-4" /> {empty ? "Terima" : "Detail"}
        </Link>
      </td>
    </tr>
  );
}
