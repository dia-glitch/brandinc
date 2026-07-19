"use client";

import { useState, useMemo, useTransition, Fragment } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, X, Trash2, ChevronRight, Search, ArrowRight, CheckCircle2, Upload, Download, PackageCheck, FileText, Truck, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchSelect } from "@/components/ui/search-select";
import { cn, formatIDR } from "@/lib/utils";
import { createRequest, packTransfer, unpackTransfer, completeTransfer, deleteTransfer, type TransferLineInput, type PackLineInput } from "./actions";

export type TransferLine = { lineId: string; variantId: string; sku: string; productName: string; size: string; qty: number; qtyPacked: number | null; anomalyNote: string; unitCost: number };
export type TransferRow = {
  id: string; code: string; brand: string; fromWarehouseId: string; from: string; to: string; date: string | null; notes: string; qty: number;
  status: string; requestedBy: string; packedBy: string; packedAt: string | null; completedAt: string | null;
  lines: TransferLine[];
};
export type StockOpt = { variantId: string; warehouseId: string; sku: string; size: string; productName: string; brandId: string | null; avail: number; unitCost: number };
export type WarehouseOpt = { id: string; name: string; kind: string; brandId: string | null };

const STATUS: Record<string, { label: string; cls: string }> = {
  requested: { label: "Request", cls: "bg-amber-100 text-amber-700" },
  packed: { label: "Siap Kirim", cls: "bg-blue-100 text-blue-700" },
  completed: { label: "Selesai", cls: "bg-emerald-100 text-emerald-700" },
  cancelled: { label: "Batal", cls: "bg-muted text-muted-foreground" },
};
function StatusBadge({ s }: { s: string }) {
  const st = STATUS[s] ?? STATUS.requested;
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold", st.cls)}>{st.label}</span>;
}

type AnomalyRow = { code: string; date: string | null; from: string; sku: string; productName: string; size: string; requested: number; packed: number; diff: number; reason: string; status: string };

export function DistributionView({ rows, stock, warehouses, canSubmit = true, canProcess = true }: { rows: TransferRow[]; stock: StockOpt[]; warehouses: WarehouseOpt[]; canSubmit?: boolean; canProcess?: boolean }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [bulk, setBulk] = useState(false);
  const [tab, setTab] = useState<"all" | "requested" | "packed" | "completed" | "anomali">("all");
  const query = q.trim().toLowerCase();
  const list = rows.filter((r) => (tab === "all" || r.status === tab) && (!query || r.code.toLowerCase().includes(query) || r.from.toLowerCase().includes(query) || r.to.toLowerCase().includes(query)));
  const count = (s: string) => rows.filter((r) => r.status === s).length;

  // Anomali: baris yang sudah di-packing dengan qty real ≠ qty diminta.
  const anomalies: AnomalyRow[] = [];
  for (const r of rows) {
    for (const l of r.lines) {
      if (l.qtyPacked != null && Math.abs(l.qtyPacked - l.qty) > 0.0001) {
        anomalies.push({ code: r.code, date: r.completedAt ?? r.packedAt ?? r.date, from: r.from, sku: l.sku, productName: l.productName, size: l.size, requested: l.qty, packed: l.qtyPacked, diff: l.qty - l.qtyPacked, reason: l.anomalyNote, status: r.status });
      }
    }
  }
  const anomList = anomalies.filter((a) => !query || a.code.toLowerCase().includes(query) || a.sku.toLowerCase().includes(query) || a.from.toLowerCase().includes(query));

  function downloadAnomali() {
    const head = ["Kode", "Tanggal", "Gudang Asal", "SKU", "Produk", "Ukuran", "Qty Diminta", "Qty Dikirim", "Selisih", "Alasan", "Status"];
    const rowsCsv = anomList.map((a) => [a.code, a.date ?? "", a.from, a.sku, a.productName, a.size, a.requested, a.packed, a.diff, a.reason.replace(/[\n,]/g, " "), a.status]);
    const csv = "﻿" + [head, ...rowsCsv].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "anomali-distribusi.csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Distribution</p>
          <h1 className="text-2xl font-extrabold">Distribusi / Pindah Stok</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">Alur: <b>Request (MD Sales)</b> → <b>Picking &amp; Packing (Outbound)</b> → <b>Surat Jalan</b> → <b>Transfer Lokasi</b>. Stok pindah saat tahap terakhir (qty real).</p>
        </div>
        {canSubmit && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setBulk(true)} disabled={warehouses.length < 2}><Upload className="h-4 w-4" /> Upload Bulk</Button>
            <Button size="sm" onClick={() => setOpen(true)} disabled={warehouses.length < 2}><Plus className="h-4 w-4" /> Request Transfer</Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex flex-wrap gap-1.5">
          {([["all", "Semua"], ["requested", `Request (${count("requested")})`], ["packed", `Siap Kirim (${count("packed")})`], ["completed", `Selesai (${count("completed")})`], ["anomali", `Anomali (${anomalies.length})`]] as const).map(([k, lab]) => (
            <button key={k} onClick={() => setTab(k)} data-active={tab === k} className="pill">{lab}</button>
          ))}
        </div>
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari kode / gudang / SKU…" className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm font-medium outline-none focus:border-primary/40" />
        </div>
      </div>

      {tab === "anomali" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-muted-foreground">Selisih qty diminta vs qty real dikirim — acuan adjustment saat <b>stock opname</b> di gudang asal.</p>
            {anomList.length > 0 && <Button variant="outline" size="sm" onClick={downloadAnomali}><Download className="h-4 w-4" /> Download CSV</Button>}
          </div>
          {anomList.length === 0 ? (
            <div className="card p-10 text-center text-sm font-medium text-muted-foreground">Belum ada anomali. Selisih muncul di sini saat Outbound mengirim qty berbeda dari yang diminta.</div>
          ) : (
            <div className="card overflow-x-auto p-0">
              <table className="w-full min-w-[900px] text-sm">
                <thead><tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  <th className="py-2.5 pl-4 pr-3">Kode</th><th className="py-2.5 pr-3">Tgl</th><th className="py-2.5 pr-3">Gudang Asal</th><th className="py-2.5 pr-3">Produk</th>
                  <th className="py-2.5 pr-3 text-right">Diminta</th><th className="py-2.5 pr-3 text-right">Dikirim</th><th className="py-2.5 pr-3 text-right">Selisih</th><th className="py-2.5 pr-4">Alasan</th>
                </tr></thead>
                <tbody>
                  {anomList.map((a, i) => (
                    <tr key={i} className="border-t border-border font-semibold">
                      <td className="py-2.5 pl-4 pr-3 font-mono text-xs">{a.code}</td>
                      <td className="py-2.5 pr-3 text-muted-foreground">{a.date ?? "—"}</td>
                      <td className="py-2.5 pr-3 text-muted-foreground">{a.from}</td>
                      <td className="py-2.5 pr-3">{a.productName}{a.size ? ` · ${a.size}` : ""}<span className="ml-1 font-mono text-xs text-muted-foreground">{a.sku}</span></td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{a.requested}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{a.packed}</td>
                      <td className={cn("py-2.5 pr-3 text-right tabular-nums font-black", a.diff > 0 ? "text-danger" : "text-emerald-700")}>{a.diff > 0 ? `-${a.diff}` : `+${-a.diff}`}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{a.reason || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : list.length === 0 ? (
        <div className="card p-10 text-center text-sm font-medium text-muted-foreground">Belum ada transfer. Buat gudang store di Master Data → Gudang (kind Toko), lalu <b>Request Transfer</b> untuk memindahkan stok ke sana.</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[1000px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <th className="w-8 py-2.5 pl-4"></th><th className="py-2.5 pr-3">Kode</th><th className="py-2.5 pr-3">Status</th><th className="py-2.5 pr-3">Brand</th>
                <th className="py-2.5 pr-3">Dari</th><th className="py-2.5 pr-3">Ke</th><th className="py-2.5 pr-3">Tgl</th><th className="py-2.5 pr-3 text-right">Qty</th><th className="py-2.5 pr-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>{list.map((r) => <TransferRowItem key={r.id} row={r} stock={stock} canSubmit={canSubmit} canProcess={canProcess} />)}</tbody>
          </table>
        </div>
      )}

      {open && <TransferForm stock={stock} warehouses={warehouses} onClose={() => setOpen(false)} />}
      {bulk && <BulkTransferForm stock={stock} warehouses={warehouses} onClose={() => setBulk(false)} />}
    </div>
  );
}

function TransferRowItem({ row, stock, canSubmit = true, canProcess = true }: { row: TransferRow; stock: StockOpt[]; canSubmit?: boolean; canProcess?: boolean }) {
  const router = useRouter();
  const [openRow, setOpenRow] = useState(false);
  const [pack, setPack] = useState(false);
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const totalPacked = row.lines.reduce((s, l) => s + (l.qtyPacked ?? 0), 0);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setErr(null);
    startTransition(async () => { const res = await fn(); if (!res.ok) setErr(res.error ?? "Gagal."); else router.refresh(); });
  }

  return (
    <Fragment>
      <tr className="border-t border-border font-semibold hover:bg-muted/40">
        <td className="py-2.5 pl-4"><button onClick={() => setOpenRow((o) => !o)} className="grid h-6 w-6 place-items-center rounded-lg hover:bg-muted"><ChevronRight className={cn("h-4 w-4 transition-transform", openRow && "rotate-90")} /></button></td>
        <td className="py-2.5 pr-3 font-mono text-xs">{row.code}</td>
        <td className="py-2.5 pr-3"><StatusBadge s={row.status} /></td>
        <td className="py-2.5 pr-3"><Badge tone="neutral">{row.brand}</Badge></td>
        <td className="py-2.5 pr-3 font-medium text-muted-foreground">{row.from}</td>
        <td className="py-2.5 pr-3"><span className="inline-flex items-center gap-1.5 font-medium"><ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />{row.to}</span></td>
        <td className="py-2.5 pr-3 font-medium text-muted-foreground">{row.date ?? "—"}</td>
        <td className="py-2.5 pr-3 text-right tabular-nums">{row.status === "requested" ? row.qty : `${totalPacked}${totalPacked !== row.qty ? ` / ${row.qty}` : ""}`}</td>
        <td className="py-2.5 pr-4">
          <div className="flex items-center justify-end gap-1.5">
            {row.status === "requested" && (canProcess
              ? <Button size="sm" variant="outline" disabled={pending} onClick={() => setPack(true)}><PackageCheck className="h-4 w-4" /> Proses</Button>
              : <span className="text-xs font-semibold text-muted-foreground">Menunggu Outbound</span>)}
            {row.status === "packed" && (
              <>
                <Link href={`/print/surat-jalan/${row.id}`} target="_blank" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-bold hover:bg-muted"><FileText className="h-3.5 w-3.5" /> Surat Jalan</Link>
                {canProcess && <>
                  <Button size="sm" disabled={pending} onClick={() => run(() => completeTransfer(row.id))}><Truck className="h-4 w-4" /> Transfer</Button>
                  <button title="Batalkan packing" disabled={pending} onClick={() => run(() => unpackTransfer(row.id))} className="text-muted-foreground hover:text-foreground"><Undo2 className="h-4 w-4" /></button>
                </>}
              </>
            )}
            {row.status === "completed" && (
              <Link href={`/print/surat-jalan/${row.id}`} target="_blank" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-bold hover:bg-muted"><FileText className="h-3.5 w-3.5" /> Surat Jalan</Link>
            )}
            {(canSubmit || canProcess) && (confirm ? <Button size="sm" variant="danger" disabled={pending} onClick={() => run(() => deleteTransfer(row.id))}>Yakin?</Button>
              : <button onClick={() => setConfirm(true)} className="text-muted-foreground hover:text-danger"><Trash2 className="h-4 w-4" /></button>)}
          </div>
        </td>
      </tr>
      {(openRow || err) && (
        <tr className="bg-muted/20"><td colSpan={9} className="px-5 py-3">
          {err && <p className="mb-2 text-sm font-semibold text-danger">{err}</p>}
          {openRow && (
            <>
              <div className="mb-2 flex flex-wrap gap-x-6 gap-y-1 text-xs font-semibold text-muted-foreground">
                {row.requestedBy && <span>Diminta oleh: <b className="text-foreground">{row.requestedBy}</b></span>}
                {row.packedBy && <span>Diproses: <b className="text-foreground">{row.packedBy}</b></span>}
                {row.packedAt && <span>Tgl packing: {row.packedAt}</span>}
                {row.completedAt && <span>Tgl transfer: {row.completedAt}</span>}
              </div>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs font-bold uppercase text-muted-foreground"><th className="py-1.5 pr-3">Produk</th><th className="py-1.5 px-2">SKU</th><th className="py-1.5 px-2 text-right">Diminta</th><th className="py-1.5 px-2 text-right">Dikirim</th><th className="py-1.5 px-2">Alasan Selisih</th></tr></thead>
                <tbody>{row.lines.map((l, i) => {
                  const diff = l.qtyPacked != null && Math.abs(l.qtyPacked - l.qty) > 0.0001;
                  return (
                    <tr key={i} className="border-t border-border/60 font-semibold">
                      <td className="py-1.5 pr-3">{l.productName}{l.size ? ` · ${l.size}` : ""}</td>
                      <td className="py-1.5 px-2 font-mono text-xs text-muted-foreground">{l.sku}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">{l.qty}</td>
                      <td className={cn("py-1.5 px-2 text-right tabular-nums", diff && "font-black text-danger")}>{l.qtyPacked != null ? l.qtyPacked : "—"}</td>
                      <td className="py-1.5 px-2 text-xs text-muted-foreground">{diff ? (l.anomalyNote || "—") : ""}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
              {row.notes && <p className="mt-2 text-sm text-muted-foreground">Catatan: {row.notes}</p>}
            </>
          )}
        </td></tr>
      )}
      {pack && <PackForm row={row} stock={stock} onClose={() => setPack(false)} />}
    </Fragment>
  );
}

function PackForm({ row, stock, onClose }: { row: TransferRow; stock: StockOpt[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [packedBy, setPackedBy] = useState("");
  const availOf = (variantId: string) => stock.find((s) => s.variantId === variantId && s.warehouseId === row.fromWarehouseId)?.avail ?? 0;
  const [vals, setVals] = useState<Record<string, { qty: string; reason: string }>>(() => {
    const o: Record<string, { qty: string; reason: string }> = {};
    for (const l of row.lines) o[l.lineId] = { qty: String(Math.min(l.qty, availOf(l.variantId))), reason: "" };
    return o;
  });
  const setVal = (id: string, f: "qty" | "reason", v: string) => setVals((p) => ({ ...p, [id]: { ...p[id], [f]: v } }));

  function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    const lines: PackLineInput[] = row.lines.map((l) => ({ lineId: l.lineId, qtyPacked: Number(vals[l.lineId]?.qty) || 0, reason: vals[l.lineId]?.reason ?? "" }));
    // validasi ringan di klien
    for (const l of row.lines) {
      const packed = Number(vals[l.lineId]?.qty) || 0;
      const diff = Math.abs(packed - l.qty) > 0.0001;
      if (diff && !(vals[l.lineId]?.reason ?? "").trim()) { setError(`Isi alasan selisih untuk ${l.sku || l.productName} (diminta ${l.qty}, dikirim ${packed}).`); return; }
    }
    startTransition(async () => {
      const res = await packTransfer(row.id, { packedBy, lines });
      if (!res.ok) { setError(res.error); return; }
      onClose(); router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-eerie/40 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-surface p-6 shadow-soft">
        <div className="mb-1 flex items-center justify-between"><h2 className="text-lg font-extrabold">Picking &amp; Packing — {row.code}</h2><button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button></div>
        <p className="mb-4 text-sm text-muted-foreground">Isi <b>qty real</b> yang akan dikirim dari <b>{row.from}</b>. Kalau beda dari qty diminta (mis. fisik kurang), wajib isi alasan — akan tercatat di tab Anomali untuk stock opname.</p>
        <form onSubmit={submit} className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-xs font-bold uppercase text-muted-foreground">
                <th className="py-2 pl-3 pr-2">Produk</th><th className="py-2 px-2 text-right">Diminta</th><th className="py-2 px-2 text-right">Stok Sistem</th><th className="py-2 px-2 text-right">Qty Kirim</th><th className="py-2 px-2">Alasan (bila beda)</th>
              </tr></thead>
              <tbody>
                {row.lines.map((l) => {
                  const avail = availOf(l.variantId);
                  const packed = Number(vals[l.lineId]?.qty) || 0;
                  const diff = Math.abs(packed - l.qty) > 0.0001;
                  return (
                    <tr key={l.lineId} className="border-t border-border/60 align-top">
                      <td className="py-2 pl-3 pr-2 font-semibold">{l.productName}{l.size ? ` · ${l.size}` : ""}<div className="font-mono text-xs text-muted-foreground">{l.sku}</div></td>
                      <td className="py-2 px-2 text-right tabular-nums">{l.qty}</td>
                      <td className={cn("py-2 px-2 text-right tabular-nums", avail < l.qty && "font-bold text-amber-600")}>{avail}</td>
                      <td className="py-2 px-2 text-right"><input type="number" step="any" min={0} value={vals[l.lineId]?.qty ?? ""} onChange={(e) => setVal(l.lineId, "qty", e.target.value)} className={cn("h-9 w-20 rounded-lg border bg-background px-2 text-right text-sm font-bold outline-none focus:border-primary/40", diff ? "border-danger/60" : "border-border")} /></td>
                      <td className="py-2 px-2"><input value={vals[l.lineId]?.reason ?? ""} onChange={(e) => setVal(l.lineId, "reason", e.target.value)} disabled={!diff} placeholder={diff ? "mis. fisik kurang / rusak" : "—"} className="h-9 w-full min-w-[160px] rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-primary/40 disabled:bg-muted/40" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div><label className={lbl}>Diproses oleh (Outbound)</label><input value={packedBy} onChange={(e) => setPackedBy(e.target.value)} className={inp} placeholder="nama — opsional" /></div>
          {error && <p className="text-sm font-semibold text-danger">{error}</p>}
          <div className="flex justify-end gap-2.5 pt-1"><Button type="button" variant="ghost" size="sm" onClick={onClose}>Batal</Button><Button type="submit" size="sm" disabled={pending}>{pending ? "Menyimpan…" : "Konfirmasi Packing"}</Button></div>
        </form>
      </div>
    </div>
  );
}

function BulkTransferForm({ stock, warehouses, onClose }: { stock: StockOpt[]; warehouses: WarehouseOpt[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [fromWh, setFromWh] = useState("");
  const [toWh, setToWh] = useState("");
  const [notes, setNotes] = useState("");
  const [reqBy, setReqBy] = useState("");
  const [date, setDate] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });
  const [raw, setRaw] = useState("");

  const srcStock = useMemo(() => stock.filter((s) => s.warehouseId === fromWh), [stock, fromWh]);
  const toWarehouse = warehouses.find((w) => w.id === toWh);

  const parsed = useMemo(() => {
    const rows = raw.split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
    const out: { sku: string; qty: number; ok: boolean; msg: string; s?: StockOpt }[] = [];
    for (const r of rows) {
      const parts = r.split(/[,;\t]/).map((x) => x.trim());
      if (parts.length < 2) continue;
      const [sku, qtyStr] = parts;
      if (/sku/i.test(sku) && /qty/i.test(qtyStr || "")) continue;
      const qty = Number(qtyStr) || 0;
      const s = srcStock.find((x) => x.sku.toLowerCase() === sku.toLowerCase());
      let ok = true, msg = "";
      if (!fromWh) { ok = false; msg = "Pilih gudang asal dulu"; }
      else if (!s) { ok = false; msg = "SKU tidak ada stok di gudang asal"; }
      else if (qty <= 0) { ok = false; msg = "Qty tidak valid"; }
      out.push({ sku, qty, ok, msg, s });
    }
    return out;
  }, [raw, srcStock, fromWh]);
  const valid = parsed.filter((p) => p.ok);

  function downloadTemplate() {
    const examples = srcStock.slice(0, 3);
    const rows = examples.length > 0 ? examples.map((s) => `${s.sku},1`) : ["EE-CR001-S,2", "EE-CR002-M,1"];
    const csv = "﻿" + ["sku,qty", ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "template-request-transfer.csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    if (!fromWh || !toWh) { setError("Pilih gudang asal & tujuan."); return; }
    if (fromWh === toWh) { setError("Gudang asal & tujuan tidak boleh sama."); return; }
    const out: TransferLineInput[] = valid.map((p) => ({ variantId: p.s!.variantId, sku: p.s!.sku, size: p.s!.size, productName: p.s!.productName, qty: p.qty, unitCost: p.s!.unitCost }));
    if (out.length === 0) { setError("Tidak ada baris valid."); return; }
    const brandId = toWarehouse?.brandId ?? (out[0] ? srcStock.find((s) => s.variantId === out[0].variantId)?.brandId ?? null : null);
    startTransition(async () => {
      const res = await createRequest({ brandId, fromWarehouseId: fromWh, toWarehouseId: toWh, transferDate: date, notes, requestedBy: reqBy, lines: out });
      if (!res.ok) { setError(res.error); return; }
      setSaved(res.code); router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-eerie/40 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-surface p-6 shadow-soft">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-extrabold">{saved ? "Request Tersimpan" : "Upload Bulk — Request Transfer"}</h2><button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button></div>

        {saved ? (
          <div className="space-y-5 py-2 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600"><CheckCircle2 className="h-8 w-8" /></div>
            <div><p className="text-sm font-medium text-muted-foreground">{valid.length} baris di-request (menunggu diproses Outbound)</p><p className="text-2xl font-black tracking-tight">{saved}</p></div>
            <div className="flex justify-center gap-2.5"><Button type="button" variant="ghost" size="sm" onClick={onClose}>Selesai</Button></div>
          </div>
        ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div><label className={lbl}>Dari Gudang</label><select value={fromWh} onChange={(e) => setFromWh(e.target.value)} className={sel}><option value="">— Pilih —</option>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
            <div><label className={lbl}>Ke Gudang</label><select value={toWh} onChange={(e) => setToWh(e.target.value)} className={sel}><option value="">— Pilih —</option>{warehouses.filter((w) => w.id !== fromWh).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
            <div><label className={lbl}>Tanggal</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inp} /></div>
          </div>
          <div><label className={lbl}>Diminta oleh (MD Sales)</label><input value={reqBy} onChange={(e) => setReqBy(e.target.value)} className={inp} placeholder="nama peminta — opsional" /></div>
          <div>
            <label className={lbl}>Data CSV — format per baris: <span className="font-mono">sku, qty</span></label>
            <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={6} className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-mono outline-none focus:border-primary/40" placeholder={"EE-CR001-S, 2\nEE-CR002-M, 1"} />
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-bold hover:bg-muted"><Download className="h-4 w-4" /> Download Template</button>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-bold hover:bg-muted"><Upload className="h-4 w-4" /> Upload File CSV<input type="file" accept=".csv,text/csv" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setRaw(await f.text()); }} /></label>
            </div>
          </div>

          {parsed.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left text-xs font-bold uppercase text-muted-foreground"><th className="py-2 pl-3 pr-2">SKU</th><th className="py-2 px-2 text-right">Qty</th><th className="py-2 px-2 text-right">Stok Asal</th><th className="py-2 px-2">Status</th></tr></thead>
                <tbody>
                  {parsed.map((p, i) => (
                    <tr key={i} className="border-t border-border/60 font-semibold">
                      <td className="py-1.5 pl-3 pr-2 font-mono text-xs">{p.sku}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">{p.qty}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums text-muted-foreground">{p.s ? p.s.avail : "—"}</td>
                      <td className="py-1.5 px-2">{p.ok ? <Badge tone="success">OK</Badge> : <span className="text-xs font-semibold text-danger">{p.msg}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {parsed.length > 0 && <p className="text-sm text-muted-foreground">{valid.length} baris valid dari {parsed.length}. Validasi stok final dilakukan Outbound saat proses.</p>}

          <div><label className={lbl}>Catatan</label><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inp} placeholder="opsional" /></div>
          {error && <p className="text-sm font-semibold text-danger">{error}</p>}
          <div className="flex justify-end gap-2.5 pt-1"><Button type="button" variant="ghost" size="sm" onClick={onClose}>Batal</Button><Button type="submit" size="sm" disabled={pending || valid.length === 0}>{pending ? "Menyimpan…" : `Request ${valid.length} Baris`}</Button></div>
        </form>
        )}
      </div>
    </div>
  );
}

type Line = { key: string; variantId: string; qty: string };
let seq = 0;
const newKey = () => `t${seq++}`;

function TransferForm({ stock, warehouses, onClose }: { stock: StockOpt[]; warehouses: WarehouseOpt[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [fromWh, setFromWh] = useState("");
  const [toWh, setToWh] = useState("");
  const [notes, setNotes] = useState("");
  const [reqBy, setReqBy] = useState("");
  const [date, setDate] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });
  const [lines, setLines] = useState<Line[]>([{ key: newKey(), variantId: "", qty: "" }]);

  const srcStock = useMemo(() => stock.filter((s) => s.warehouseId === fromWh), [stock, fromWh]);
  const findStock = (variantId: string) => srcStock.find((s) => s.variantId === variantId);
  const toWarehouse = warehouses.find((w) => w.id === toWh);
  const brandId = toWarehouse?.brandId ?? (srcStock.find((s) => s.variantId === lines[0]?.variantId)?.brandId ?? null);

  function setLine(key: string, f: keyof Line, v: string) { setLines((p) => p.map((l) => (l.key === key ? { ...l, [f]: v } : l))); }
  function addLine() { setLines((p) => [...p, { key: newKey(), variantId: "", qty: "" }]); }
  function removeLine(key: string) { setLines((p) => (p.length > 1 ? p.filter((l) => l.key !== key) : p)); }

  function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    const out: TransferLineInput[] = lines.filter((l) => l.variantId && Number(l.qty) > 0).map((l) => {
      const s = findStock(l.variantId);
      return { variantId: l.variantId, sku: s?.sku ?? "", size: s?.size ?? "", productName: s?.productName ?? "", qty: Number(l.qty), unitCost: s?.unitCost ?? 0 };
    });
    if (out.length === 0) { setError("Tambah minimal satu produk (qty > 0)."); return; }
    startTransition(async () => {
      const res = await createRequest({ brandId, fromWarehouseId: fromWh, toWarehouseId: toWh, transferDate: date, notes, requestedBy: reqBy, lines: out });
      if (!res.ok) { setError(res.error); return; }
      setSaved(res.code); router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-eerie/40 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-surface p-6 shadow-soft">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-extrabold">{saved ? "Request Tersimpan" : "Request Transfer Stok"}</h2><button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button></div>

        {saved ? (
          <div className="space-y-5 py-2 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-100 text-amber-600"><PackageCheck className="h-8 w-8" /></div>
            <div><p className="text-sm font-medium text-muted-foreground">Request dibuat — menunggu diproses tim Outbound (picking &amp; packing).</p><p className="text-2xl font-black tracking-tight">{saved}</p></div>
            <div className="flex justify-center gap-2.5"><Button type="button" variant="ghost" size="sm" onClick={onClose}>Selesai</Button></div>
          </div>
        ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div><label className={lbl}>Dari Gudang</label><select value={fromWh} onChange={(e) => { setFromWh(e.target.value); setLines([{ key: newKey(), variantId: "", qty: "" }]); }} className={sel}><option value="">— Pilih —</option>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
            <div><label className={lbl}>Ke Gudang</label><select value={toWh} onChange={(e) => setToWh(e.target.value)} className={sel}><option value="">— Pilih —</option>{warehouses.filter((w) => w.id !== fromWh).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
            <div><label className={lbl}>Tanggal</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inp} /></div>
          </div>
          <div><label className={lbl}>Diminta oleh (MD Sales)</label><input value={reqBy} onChange={(e) => setReqBy(e.target.value)} className={inp} placeholder="nama peminta — opsional" /></div>

          <div className="rounded-xl border border-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Produk Diminta (dari stok gudang asal)</p>
              <Button type="button" size="sm" variant="outline" onClick={addLine}><Plus className="h-4 w-4" /> Baris</Button>
            </div>
            {fromWh && srcStock.length === 0 && <p className="mb-2 text-xs font-semibold text-amber-600">Gudang asal belum ada stok barang jadi.</p>}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs font-bold uppercase text-muted-foreground"><th className="py-1.5 pr-2">Produk / SKU</th><th className="py-1.5 px-1 text-right">Stok Asal</th><th className="py-1.5 px-1 text-right">Qty Minta</th><th className="py-1.5 px-1 text-right">COGM</th><th></th></tr></thead>
                <tbody>
                  {lines.map((l) => {
                    const s = findStock(l.variantId);
                    return (
                      <tr key={l.key} className="border-t border-border/60">
                        <td className="py-1 pr-2"><SearchSelect className="w-64" value={l.variantId} onChange={(v) => setLine(l.key, "variantId", v)} placeholder="Cari nama / SKU…" options={srcStock.map((ss) => ({ value: ss.variantId, label: `${ss.productName}${ss.size ? " · " + ss.size : ""}`, hint: `${ss.sku} · stok ${ss.avail}` }))} /></td>
                        <td className="py-1 px-1 text-right tabular-nums text-muted-foreground">{s ? s.avail : "—"}</td>
                        <td className="py-1 px-1"><input type="number" step="any" value={l.qty} onChange={(e) => setLine(l.key, "qty", e.target.value)} className="h-9 w-20 rounded-lg border border-border bg-background px-2 text-right text-sm font-semibold outline-none focus:border-primary/40" placeholder="0" /></td>
                        <td className="py-1 px-1 text-right tabular-nums text-muted-foreground">{s ? formatIDR(s.unitCost) : "—"}</td>
                        <td className="py-1 pl-1"><button type="button" onClick={() => removeLine(l.key)} className="text-muted-foreground hover:text-danger"><Trash2 className="h-4 w-4" /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div><label className={lbl}>Catatan</label><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inp} placeholder="opsional (mis. tujuan pengiriman)" /></div>
          {error && <p className="text-sm font-semibold text-danger">{error}</p>}
          <div className="flex justify-end gap-2.5 pt-1"><Button type="button" variant="ghost" size="sm" onClick={onClose}>Batal</Button><Button type="submit" size="sm" disabled={pending}>{pending ? "Menyimpan…" : "Buat Request"}</Button></div>
        </form>
        )}
      </div>
    </div>
  );
}

const lbl = "mb-1.5 block text-sm font-bold";
const inp = "h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm font-medium outline-none focus:border-primary/40";
const sel = inp + " px-3";
