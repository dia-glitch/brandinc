"use client";

import { useState, useMemo, useTransition, Fragment } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Trash2, ChevronRight, Search, Wallet, CheckCircle2, Upload, Pencil, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchSelect } from "@/components/ui/search-select";
import { cn, formatIDR } from "@/lib/utils";
import { createSale, updateSale, receiveSalePayment, deleteSale, type SaleLineInput } from "./actions";

export type SaleLine = { variantId: string; warehouseId: string; extOrderId: string; sku: string; size: string; productName: string; qty: number; retail: number; price: number; cogm: number };
export type SaleRow = {
  id: string; code: string; brand: string; brandId: string | null; channel: string; channelId: string | null; settlement: string; extOrderId: string; customer: string; date: string | null;
  subtotal: number; discount: number; commission: number; ppn: number; total: number; cogs: number; paid: number; status: "unpaid" | "partial" | "paid"; lines: SaleLine[];
};
export type StockOpt = { variantId: string; warehouseId: string; warehouse: string; sku: string; size: string; productName: string; brandId: string | null; avail: number; retail: number; cogm: number };
export type BrandOpt = { id: string; name: string };
export type ChannelOpt = { id: string; name: string; grup: string; warehouseId: string | null };
export type AccountOpt = { id: string; name: string; balance: number };

const SETTLE_LABEL: Record<string, string> = { ar: "AR / Konsinyasi", marketplace: "Marketplace (kas nyusul)" };

export function SalesView({ rows, stock, brands, channels, accounts, isAdmin, canEdit = true, canReceive = true }: { rows: SaleRow[]; stock: StockOpt[]; brands: BrandOpt[]; channels: ChannelOpt[]; accounts: AccountOpt[]; isAdmin: boolean; canEdit?: boolean; canReceive?: boolean }) {
  const [q, setQ] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [bulk, setBulk] = useState(false);
  const [edit, setEdit] = useState<SaleRow | null>(null);
  const [receive, setReceive] = useState<SaleRow | null>(null);

  const brandOpts = useMemo(() => Array.from(new Set(rows.map((r) => r.brand))).filter((b) => b && b !== "—").sort(), [rows]);
  const query = q.trim().toLowerCase();
  const list = rows.filter((r) => !brandFilter || r.brand === brandFilter).filter((r) => !query || r.code.toLowerCase().includes(query) || r.customer.toLowerCase().includes(query));

  const totalSales = list.reduce((s, r) => s + r.total, 0);
  const outstanding = list.reduce((s, r) => s + Math.max(0, r.total - r.paid), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Sales</p>
          <h1 className="text-2xl font-extrabold">Penjualan</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">Per produk — stok barang jadi turun otomatis, revenue &amp; COGS masuk P&amp;L. Total: <b className="text-foreground">{formatIDR(totalSales)}</b> · Outstanding: <b className="text-danger">{formatIDR(outstanding)}</b></p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setBulk(true)}><Upload className="h-4 w-4" /> Upload Bulk</Button>
            <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Jual</Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari kode / pelanggan…" className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm font-medium outline-none focus:border-primary/40" />
        </div>
        <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none focus:border-primary/40">
          <option value="">Semua Brand</option>
          {brandOpts.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <span className="text-sm font-medium text-muted-foreground">{list.length} order</span>
      </div>

      {list.length === 0 ? (
        <div className="card p-10 text-center text-sm font-medium text-muted-foreground">Belum ada penjualan.</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[1000px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <th className="w-8 py-2.5 pl-4"></th>
                <th className="py-2.5 pr-3">Kode</th><th className="py-2.5 pr-3">Brand</th><th className="py-2.5 pr-3">Channel</th>
                <th className="py-2.5 pr-3">Penyelesaian</th><th className="py-2.5 pr-3">Tgl</th>
                <th className="py-2.5 pr-3 text-right">Total</th><th className="py-2.5 pr-3 text-right">Diterima</th>
                <th className="py-2.5 pr-3">Status</th><th className="py-2.5 pr-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => <SaleRowItem key={r.id} row={r} isAdmin={isAdmin} canEdit={canEdit} canReceive={canReceive} onReceive={() => setReceive(r)} onEdit={() => setEdit(r)} />)}
            </tbody>
          </table>
        </div>
      )}

      {open && <SaleForm stock={stock} brands={brands} channels={channels} onClose={() => setOpen(false)} />}
      {edit && <SaleForm stock={stock} brands={brands} channels={channels} editOrder={edit} onClose={() => setEdit(null)} />}
      {bulk && <BulkForm stock={stock} brands={brands} channels={channels} onClose={() => setBulk(false)} />}
      {receive && <ReceiveDialog row={receive} accounts={accounts} onClose={() => setReceive(null)} />}
    </div>
  );
}

function SaleRowItem({ row, isAdmin, canEdit, canReceive, onReceive, onEdit }: { row: SaleRow; isAdmin: boolean; canEdit: boolean; canReceive: boolean; onReceive: () => void; onEdit: () => void }) {
  const router = useRouter();
  const [openRow, setOpenRow] = useState(false);
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const out = Math.max(0, row.total - row.paid);
  return (
    <Fragment>
      <tr className="border-t border-border font-semibold hover:bg-muted/40">
        <td className="py-2.5 pl-4"><button onClick={() => setOpenRow((o) => !o)} className="grid h-6 w-6 place-items-center rounded-lg hover:bg-muted"><ChevronRight className={cn("h-4 w-4 transition-transform", openRow && "rotate-90")} /></button></td>
        <td className="py-2.5 pr-3 font-mono text-xs">{row.code}</td>
        <td className="py-2.5 pr-3"><Badge tone="neutral">{row.brand}</Badge></td>
        <td className="py-2.5 pr-3 font-medium text-muted-foreground">{row.channel}</td>
        <td className="py-2.5 pr-3 font-medium text-muted-foreground">{SETTLE_LABEL[row.settlement] ?? row.settlement}</td>
        <td className="py-2.5 pr-3 font-medium text-muted-foreground">{row.date ?? "—"}</td>
        <td className="py-2.5 pr-3 text-right tabular-nums">{formatIDR(row.total)}</td>
        <td className="py-2.5 pr-3 text-right tabular-nums text-emerald-700">{row.paid > 0 ? formatIDR(row.paid) : "—"}</td>
        <td className="py-2.5 pr-3">{row.status === "paid" ? <Badge tone="success">Lunas</Badge> : row.status === "partial" ? <Badge tone="accent">Sebagian</Badge> : <Badge tone="danger">Belum</Badge>}</td>
        <td className="py-2.5 pr-4 text-right">
          <div className="flex items-center justify-end gap-1">
            {canReceive && out > 0 && <Button variant="ghost" size="sm" onClick={onReceive}><Wallet className="h-4 w-4" /> Terima</Button>}
            {canEdit && <button onClick={onEdit} title="Edit / Adjustment" className="text-muted-foreground hover:text-foreground"><Pencil className="h-4 w-4" /></button>}
            {canEdit && (confirm ? <Button size="sm" variant="danger" disabled={pending} onClick={() => startTransition(async () => { await deleteSale(row.id); router.refresh(); })}>Yakin?</Button>
              : <button onClick={() => setConfirm(true)} title="Hapus" className="text-muted-foreground hover:text-danger"><Trash2 className="h-4 w-4" /></button>)}
          </div>
        </td>
      </tr>
      {openRow && (
        <tr className="bg-muted/20">
          <td colSpan={10} className="px-5 py-3">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs font-bold uppercase text-muted-foreground"><th className="py-1.5 pr-3">Produk</th><th className="py-1.5 px-2">SKU</th><th className="py-1.5 px-2 text-right">Qty</th><th className="py-1.5 px-2 text-right">Retail</th><th className="py-1.5 px-2 text-right">Harga Jual</th><th className="py-1.5 px-2 text-right">COGM</th><th className="py-1.5 px-2 text-right">Subtotal</th></tr></thead>
                <tbody>
                  {row.lines.map((l, i) => (
                    <tr key={i} className="border-t border-border/60 font-semibold">
                      <td className="py-1.5 pr-3">{l.productName}{l.size ? ` · ${l.size}` : ""}</td>
                      <td className="py-1.5 px-2 font-mono text-xs text-muted-foreground">{l.sku}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">{l.qty}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums text-muted-foreground">{l.retail ? formatIDR(l.retail) : "—"}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">{formatIDR(l.price)}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums text-muted-foreground">{formatIDR(l.cogm)}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">{formatIDR(l.qty * l.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-sm">
              {row.extOrderId && <span className="text-muted-foreground">No. Order MP: <b className="font-mono text-foreground">{row.extOrderId}</b></span>}
              <span className="text-muted-foreground">Subtotal: <b className="text-foreground">{formatIDR(row.subtotal)}</b></span>
              <span className="text-muted-foreground">Diskon: <b className="text-foreground">{formatIDR(row.discount)}</b></span>
              {row.commission > 0 && <span className="text-muted-foreground">Komisi Konsinyasi: <b className="text-amber-600">{formatIDR(row.commission)}</b></span>}
              <span className="text-muted-foreground">PPN: <b className="text-foreground">{formatIDR(row.ppn)}</b></span>
              <span className="text-muted-foreground">Total COGS: <b className="text-foreground">{formatIDR(row.cogs)}</b></span>
              <span className="text-muted-foreground">Laba Kotor: <b className="text-emerald-700">{formatIDR(row.subtotal - row.discount - row.cogs)}</b></span>
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
}

type Line = { key: string; variantId: string; warehouseId: string; qty: string; price: string };
let seq = 0;
const newKey = () => `s${seq++}`;

function SaleForm({ stock, brands, channels, editOrder, onClose }: { stock: StockOpt[]; brands: BrandOpt[]; channels: ChannelOpt[]; editOrder?: SaleRow; onClose: () => void }) {
  const isEdit = Boolean(editOrder);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [brandId, setBrandId] = useState(editOrder?.brandId ?? brands[0]?.id ?? "");
  const [channelId, setChannelId] = useState(editOrder?.channelId ?? "");
  const [extOrderId, setExtOrderId] = useState(editOrder?.extOrderId ?? "");
  const [commPct, setCommPct] = useState(() => {
    if (editOrder && editOrder.commission) { const n = editOrder.lines.reduce((s, l) => s + l.qty * l.price, 0); return n > 0 ? String(Math.round((editOrder.commission / n) * 1000) / 10) : ""; }
    return "";
  });
  const [ppn, setPpn] = useState(editOrder ? String(editOrder.ppn) : "");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(editOrder?.date ?? (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })());

  // Saat edit: stok tersedia = stok saat ini + qty baris order ini (akan dibalik dulu).
  const stockAug = useMemo(() => {
    if (!editOrder) return stock;
    const map = new Map(stock.map((s) => [`${s.variantId}|${s.warehouseId}`, { ...s }]));
    for (const l of editOrder.lines) {
      if (!l.variantId || !l.warehouseId) continue;
      const k = `${l.variantId}|${l.warehouseId}`;
      const ex = map.get(k);
      if (ex) ex.avail += l.qty;
      else map.set(k, { variantId: l.variantId, warehouseId: l.warehouseId, warehouse: "", sku: l.sku, size: l.size, productName: l.productName, brandId: null, avail: l.qty, retail: l.retail, cogm: l.cogm });
    }
    return Array.from(map.values());
  }, [stock, editOrder]);

  const [lines, setLines] = useState<Line[]>(
    editOrder ? editOrder.lines.map((l) => ({ key: newKey(), variantId: l.variantId, warehouseId: l.warehouseId, qty: String(l.qty), price: String(l.price) })) : [{ key: newKey(), variantId: "", warehouseId: "", qty: "", price: "" }]
  );

  // Penyelesaian otomatis: channel online → marketplace (kas nyusul), offline/store → AR.
  const channel = channels.find((c) => c.id === channelId);
  const settlement = channel?.grup === "online" ? "marketplace" : "ar";
  const settleLabel = settlement === "marketplace" ? "Marketplace (kas nyusul)" : "AR / Konsinyasi";

  // Bila channel dipetakan ke gudang sumber, stok difilter ke gudang itu.
  const chanWh = channel?.warehouseId ?? null;
  const stockForBrand = useMemo(() => stockAug.filter((s) => (!brandId || s.brandId === brandId || s.brandId === null) && (!chanWh || s.warehouseId === chanWh)), [stockAug, brandId, chanWh]);
  const findStock = (variantId: string, warehouseId: string) => stockAug.find((s) => s.variantId === variantId && s.warehouseId === warehouseId);

  const gross = useMemo(() => lines.reduce((s, l) => { const st = findStock(l.variantId, l.warehouseId); return s + (Number(l.qty) || 0) * (st?.retail ?? 0); }, 0), [lines]);
  const net = useMemo(() => lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0), [lines]);
  const discount = Math.max(0, gross - net);
  const isConsignment = settlement === "ar";
  const commAmt = isConsignment ? Math.round(((Number(commPct) || 0) / 100) * net) : 0;
  const total = net + (Number(ppn) || 0) - commAmt;

  function reset() { setChannelId(""); setExtOrderId(""); setCommPct(""); setPpn(""); setNotes(""); setLines([{ key: newKey(), variantId: "", warehouseId: "", qty: "", price: "" }]); setError(null); setSaved(null); }
  function setLine(key: string, f: keyof Line, v: string) { setLines((p) => p.map((l) => (l.key === key ? { ...l, [f]: v } : l))); }
  function pickStock(key: string, optKey: string) {
    const [variantId, warehouseId] = optKey.split("|");
    const s = findStock(variantId, warehouseId);
    // Harga jual default = retail (data mati), bisa diubah jadi sale-at-price.
    setLines((p) => p.map((l) => (l.key === key ? { ...l, variantId, warehouseId, price: s ? String(s.retail) : "" } : l)));
  }
  function addLine() { setLines((p) => [...p, { key: newKey(), variantId: "", warehouseId: "", qty: "", price: "" }]); }
  function removeLine(key: string) { setLines((p) => (p.length > 1 ? p.filter((l) => l.key !== key) : p)); }

  function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    const out: SaleLineInput[] = lines.filter((l) => l.variantId && l.warehouseId && Number(l.qty) > 0).map((l) => {
      const s = findStock(l.variantId, l.warehouseId);
      return { variantId: l.variantId, warehouseId: l.warehouseId, sku: s?.sku ?? "", size: s?.size ?? "", productName: s?.productName ?? "", qty: Number(l.qty), retail: s?.retail ?? 0, price: Number(l.price) || 0, cogm: s?.cogm ?? 0 };
    });
    if (out.length === 0) { setError("Tambah minimal satu produk (qty > 0)."); return; }
    startTransition(async () => {
      const payload = { brandId, channelId: channelId || null, settlement, orderDate: date, extOrderId, commission: commAmt, ppn: Number(ppn) || 0, notes, lines: out };
      const res = isEdit && editOrder ? await updateSale(editOrder.id, payload) : await createSale(payload);
      if (!res.ok) { setError(res.error); return; }
      if (isEdit) { onClose(); router.refresh(); return; }
      setSaved(("code" in res ? res.code : "") as string); router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-eerie/40 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-surface p-6 shadow-soft">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-extrabold">{saved ? "Penjualan Tersimpan" : isEdit ? `Edit / Adjustment ${editOrder?.code}` : "Penjualan Baru"}</h2><button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button></div>

        {saved ? (
          <div className="space-y-5 py-2 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600"><CheckCircle2 className="h-8 w-8" /></div>
            <div><p className="text-sm font-medium text-muted-foreground">Stok turun & revenue tercatat</p><p className="text-2xl font-black tracking-tight">{saved}</p></div>
            <div className="flex justify-center gap-2.5"><Button type="button" variant="outline" size="sm" onClick={reset}>Jual Lagi</Button><Button type="button" variant="ghost" size="sm" onClick={onClose}>Selesai</Button></div>
          </div>
        ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div><label className={lbl}>Brand</label><select value={brandId} onChange={(e) => setBrandId(e.target.value)} className={sel}><option value="">— Pilih —</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
            <div><label className={lbl}>Channel</label><select value={channelId} onChange={(e) => setChannelId(e.target.value)} className={sel}><option value="">— Umum —</option>{channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div><label className={lbl}>Penyelesaian <span className="font-medium text-muted-foreground">(otomatis)</span></label><div className="flex h-11 items-center rounded-xl border border-border bg-muted/40 px-3 text-sm font-semibold">{settleLabel}</div></div>
            <div><label className={lbl}>Tanggal</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inp} /></div>
          </div>

          <div className="rounded-xl border border-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Produk Terjual (dari stok barang jadi)</p>
              <Button type="button" size="sm" variant="outline" onClick={addLine}><Plus className="h-4 w-4" /> Baris</Button>
            </div>
            {brandId && stockForBrand.length === 0 && <p className="mb-2 text-xs font-semibold text-amber-600">Belum ada stok barang jadi untuk brand ini.</p>}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs font-bold uppercase text-muted-foreground"><th className="py-1.5 pr-2">Produk / SKU</th><th className="py-1.5 px-1 text-right">Stok</th><th className="py-1.5 px-1 text-right">Retail</th><th className="py-1.5 px-1 text-right">Qty</th><th className="py-1.5 px-1 text-right">Harga Jual</th><th className="py-1.5 px-1 text-right">Diskon</th><th className="py-1.5 px-1 text-right">Subtotal</th><th></th></tr></thead>
                <tbody>
                  {lines.map((l) => {
                    const s = findStock(l.variantId, l.warehouseId);
                    const qty = Number(l.qty) || 0;
                    const salePrice = Number(l.price) || 0;
                    const disc = s ? Math.max(0, (s.retail - salePrice)) * qty : 0;
                    const val = qty * salePrice;
                    return (
                      <tr key={l.key} className="border-t border-border/60">
                        <td className="py-1 pr-2"><SearchSelect className="w-56" value={l.variantId ? `${l.variantId}|${l.warehouseId}` : ""} onChange={(v) => pickStock(l.key, v)} placeholder="Cari nama / SKU…" options={stockForBrand.map((ss) => ({ value: `${ss.variantId}|${ss.warehouseId}`, label: `${ss.productName}${ss.size ? " · " + ss.size : ""}`, hint: `${ss.sku} · ${ss.warehouse} · stok ${ss.avail}` }))} /></td>
                        <td className="py-1 px-1 text-right tabular-nums text-muted-foreground">{s ? s.avail : "—"}</td>
                        <td className="py-1 px-1 text-right tabular-nums text-muted-foreground">{s ? formatIDR(s.retail) : "—"}</td>
                        <td className="py-1 px-1"><input type="number" step="any" value={l.qty} onChange={(e) => setLine(l.key, "qty", e.target.value)} className="h-9 w-16 rounded-lg border border-border bg-background px-2 text-right text-sm font-semibold outline-none focus:border-primary/40" placeholder="0" /></td>
                        <td className="py-1 px-1"><input type="number" step="any" value={l.price} onChange={(e) => setLine(l.key, "price", e.target.value)} className="h-9 w-28 rounded-lg border border-border bg-background px-2 text-right text-sm font-semibold outline-none focus:border-primary/40" placeholder="0" /></td>
                        <td className="py-1 px-1 text-right tabular-nums text-amber-600">{disc > 0 ? formatIDR(disc) : "—"}</td>
                        <td className="py-1 px-1 text-right tabular-nums font-semibold">{formatIDR(val)}</td>
                        <td className="py-1 pl-1"><button type="button" onClick={() => removeLine(l.key)} className="text-muted-foreground hover:text-danger"><Trash2 className="h-4 w-4" /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs font-medium text-muted-foreground">Harga jual default = retail. Ubah jadi harga terjual saat itu; selisihnya otomatis jadi diskon.</p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {isConsignment && (
              <div><label className={lbl}>Komisi Konsinyasi (%)</label>
                <div className="relative">
                  <input type="number" step="any" value={commPct} onChange={(e) => setCommPct(e.target.value)} className={inp + " pr-8"} placeholder="mis. 20" />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">%</span>
                </div>
                {commAmt > 0 && <p className="mt-1 text-xs font-semibold text-amber-600">= {formatIDR(commAmt)}</p>}
              </div>
            )}
            <div><label className={lbl}>PPN</label><input type="number" value={ppn} onChange={(e) => setPpn(e.target.value)} className={inp} placeholder="0" /></div>
            <div className={cn("flex flex-wrap items-end justify-end gap-x-5 gap-y-1 text-sm", isConsignment ? "col-span-2" : "col-span-3")}>
              <span className="text-muted-foreground">Bruto: <b className="text-foreground tabular-nums">{formatIDR(gross)}</b></span>
              <span className="text-muted-foreground">Diskon: <b className="text-amber-600 tabular-nums">{formatIDR(discount)}</b></span>
              <span className="text-muted-foreground">Neto: <b className="text-foreground tabular-nums">{formatIDR(net)}</b></span>
              {commAmt > 0 && <span className="text-muted-foreground">Komisi: <b className="text-amber-600 tabular-nums">−{formatIDR(commAmt)}</b></span>}
              <div className="text-right"><p className="text-xs font-bold uppercase text-muted-foreground">{isConsignment ? "Ditagih ke Store" : "Total"}</p><p className="text-xl font-black tabular-nums">{formatIDR(total)}</p></div>
            </div>
          </div>
          {isConsignment && <p className="text-xs font-medium text-muted-foreground">Komisi konsinyasi masuk P&amp;L sebagai beban Komisi (bukan diskon), dan mengurangi tagihan AR ke store.</p>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label className={lbl}>No. Order Marketplace <span className="font-medium text-muted-foreground">(opsional, utk rekon)</span></label><input value={extOrderId} onChange={(e) => setExtOrderId(e.target.value)} className={inp} placeholder="mis. INV/20260719/XYZ" /></div>
            <div><label className={lbl}>Catatan</label><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inp} placeholder="opsional" /></div>
          </div>

          {error && <p className="text-sm font-semibold text-danger">{error}</p>}
          {isEdit && <p className="text-xs font-medium text-amber-600">Adjustment admin: stok lama dikembalikan lalu dipasang ulang sesuai perubahan.</p>}
          <div className="flex justify-end gap-2.5 pt-1"><Button type="button" variant="ghost" size="sm" onClick={onClose}>Batal</Button><Button type="submit" size="sm" disabled={pending}>{pending ? "Menyimpan…" : isEdit ? "Simpan Perubahan" : "Simpan & Kurangi Stok"}</Button></div>
        </form>
        )}
      </div>
    </div>
  );
}

/** Upload bulk: satu batch penjualan dari CSV (sku, qty, harga_jual). Retail & COGM otomatis dari stok. */
function BulkForm({ stock, brands, channels, onClose }: { stock: StockOpt[]; brands: BrandOpt[]; channels: ChannelOpt[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const [channelId, setChannelId] = useState("");
  const [date, setDate] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });
  const [raw, setRaw] = useState("");

  const channel = channels.find((c) => c.id === channelId);
  const settlement = channel?.grup === "online" ? "marketplace" : "ar";
  const settleLabel = settlement === "marketplace" ? "Marketplace (kas nyusul)" : "AR / Konsinyasi";
  const chanWh = channel?.warehouseId ?? null;

  function downloadTemplate() {
    const examples = stock.filter((s) => !brandId || s.brandId === brandId).slice(0, 3);
    const rows = examples.length > 0 ? examples.map((s) => `${s.sku},1,${s.retail || ""},`) : ["EE-CR001-S,2,150000,INV/20260719/AAA", "EE-CR002-M,1,,INV/20260719/BBB"];
    const csv = "﻿" + ["sku,qty,harga_jual,order_id", ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "template-penjualan-bulk.csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  const parsed = useMemo(() => {
    const rows = raw.split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
    const out: { sku: string; qty: number; price: string; orderId: string; ok: boolean; msg: string; s?: StockOpt }[] = [];
    for (const r of rows) {
      const parts = r.split(/[,;\t]/).map((x) => x.trim());
      if (parts.length < 2) continue;
      const [sku, qtyStr, priceStr, orderId] = parts;
      if (/sku/i.test(sku) && /qty/i.test(qtyStr || "")) continue; // skip header
      const qty = Number(qtyStr) || 0;
      // Cari stok utk brand ini (& gudang channel bila dipetakan), pilih gudang stok terbanyak.
      const cands = stock.filter((s) => s.sku.toLowerCase() === sku.toLowerCase() && (!brandId || s.brandId === brandId) && (!chanWh || s.warehouseId === chanWh)).sort((a, b) => b.avail - a.avail);
      const s = cands[0];
      const price = priceStr && Number(priceStr) > 0 ? priceStr : (s ? String(s.retail) : "");
      let ok = true, msg = "";
      if (!s) { ok = false; msg = "SKU tidak ada stok utk brand ini"; }
      else if (qty <= 0) { ok = false; msg = "Qty tidak valid"; }
      else if (qty > s.avail) { ok = false; msg = `Stok kurang (ada ${s.avail})`; }
      out.push({ sku, qty, price, orderId: orderId || "", ok, msg, s });
    }
    return out;
  }, [raw, stock, brandId]);

  const valid = parsed.filter((p) => p.ok);
  const gross = valid.reduce((s, p) => s + (p.s ? p.s.retail * p.qty : 0), 0);
  const net = valid.reduce((s, p) => s + (Number(p.price) || 0) * p.qty, 0);

  function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    const out: SaleLineInput[] = valid.map((p) => ({ variantId: p.s!.variantId, warehouseId: p.s!.warehouseId, sku: p.s!.sku, size: p.s!.size, productName: p.s!.productName, qty: p.qty, retail: p.s!.retail, price: Number(p.price) || 0, cogm: p.s!.cogm, extOrderId: p.orderId }));
    if (out.length === 0) { setError("Tidak ada baris valid untuk disimpan."); return; }
    startTransition(async () => {
      const res = await createSale({ brandId, channelId: channelId || null, settlement, orderDate: date, ppn: 0, notes: "bulk upload", lines: out });
      if (!res.ok) { setError(res.error); return; }
      setSaved(res.code); router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-eerie/40 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-surface p-6 shadow-soft">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-extrabold">{saved ? "Bulk Tersimpan" : "Upload Bulk Penjualan"}</h2><button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button></div>

        {saved ? (
          <div className="space-y-5 py-2 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600"><CheckCircle2 className="h-8 w-8" /></div>
            <div><p className="text-sm font-medium text-muted-foreground">{valid.length} baris tersimpan, stok turun</p><p className="text-2xl font-black tracking-tight">{saved}</p></div>
            <div className="flex justify-center gap-2.5"><Button type="button" variant="ghost" size="sm" onClick={onClose}>Selesai</Button></div>
          </div>
        ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div><label className={lbl}>Brand</label><select value={brandId} onChange={(e) => setBrandId(e.target.value)} className={sel}><option value="">— Pilih —</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
            <div><label className={lbl}>Channel</label><select value={channelId} onChange={(e) => setChannelId(e.target.value)} className={sel}><option value="">— Umum —</option>{channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div><label className={lbl}>Penyelesaian <span className="font-medium text-muted-foreground">(otomatis)</span></label><div className="flex h-11 items-center rounded-xl border border-border bg-muted/40 px-3 text-sm font-semibold">{settleLabel}</div></div>
            <div><label className={lbl}>Tanggal</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inp} /></div>
          </div>
          <div>
            <label className={lbl}>Data CSV — format per baris: <span className="font-mono">sku, qty, harga_jual, order_id</span> <span className="font-medium text-muted-foreground">(harga_jual &amp; order_id opsional)</span></label>
            <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={6} className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-mono outline-none focus:border-primary/40" placeholder={"EE-CR001-S, 2, 150000, INV/20260719/AAA\nEE-CR002-M, 1, , INV/20260719/BBB"} />
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-bold hover:bg-muted"><Download className="h-4 w-4" /> Download Template</button>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-bold hover:bg-muted"><Upload className="h-4 w-4" /> Upload File CSV<input type="file" accept=".csv,text/csv" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setRaw(await f.text()); }} /></label>
            </div>
          </div>

          {parsed.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left text-xs font-bold uppercase text-muted-foreground"><th className="py-2 pl-3 pr-2">SKU</th><th className="py-2 px-2 text-right">Qty</th><th className="py-2 px-2 text-right">Harga Jual</th><th className="py-2 px-2 text-right">Retail</th><th className="py-2 px-2">No. Order</th><th className="py-2 px-2">Status</th></tr></thead>
                <tbody>
                  {parsed.map((p, i) => (
                    <tr key={i} className="border-t border-border/60 font-semibold">
                      <td className="py-1.5 pl-3 pr-2 font-mono text-xs">{p.sku}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">{p.qty}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">{p.price ? formatIDR(Number(p.price)) : "—"}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums text-muted-foreground">{p.s ? formatIDR(p.s.retail) : "—"}</td>
                      <td className="py-1.5 px-2 font-mono text-xs text-muted-foreground">{p.orderId || "—"}</td>
                      <td className="py-1.5 px-2">{p.ok ? <Badge tone="success">OK</Badge> : <span className="text-xs font-semibold text-danger">{p.msg}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {parsed.length > 0 && <p className="text-sm text-muted-foreground">{valid.length} baris valid · Bruto {formatIDR(gross)} · Neto {formatIDR(net)}</p>}

          {error && <p className="text-sm font-semibold text-danger">{error}</p>}
          <div className="flex justify-end gap-2.5 pt-1"><Button type="button" variant="ghost" size="sm" onClick={onClose}>Batal</Button><Button type="submit" size="sm" disabled={pending || valid.length === 0}>{pending ? "Menyimpan…" : `Simpan ${valid.length} Baris`}</Button></div>
        </form>
        )}
      </div>
    </div>
  );
}

function ReceiveDialog({ row, accounts, onClose }: { row: SaleRow; accounts: AccountOpt[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const outstanding = Math.max(0, row.total - row.paid);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [amount, setAmount] = useState(String(outstanding));
  const [method, setMethod] = useState(row.settlement === "marketplace" ? "disbursement" : "transfer");
  const [date, setDate] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-eerie/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-soft">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-extrabold">Terima Pembayaran</h2><button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button></div>
        <div className="mb-4 rounded-xl bg-muted/60 px-3.5 py-2.5 text-sm"><p className="font-mono font-bold">{row.code}</p><p className="text-muted-foreground">{SETTLE_LABEL[row.settlement]} · {row.customer || row.channel} · Sisa <b className="text-danger">{formatIDR(outstanding)}</b></p></div>
        <form onSubmit={(e) => { e.preventDefault(); setError(null); startTransition(async () => { const r = await receiveSalePayment({ id: row.id, code: row.code, amount: Number(amount) || 0, accountId, date, method }); if (!r.ok) { setError(r.error); return; } onClose(); router.refresh(); }); }} className="space-y-4">
          <div><label className={lbl}>Masuk ke Akun</label><select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={sel}><option value="">— Pilih —</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} · saldo {formatIDR(a.balance)}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-3"><div><label className={lbl}>Nominal</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={inp} /></div><div><label className={lbl}>Tanggal</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inp} /></div></div>
          <div><label className={lbl}>Metode</label><select value={method} onChange={(e) => setMethod(e.target.value)} className={sel}><option value="transfer">Transfer</option><option value="tunai">Tunai</option><option value="disbursement">Pencairan Marketplace</option></select></div>
          {error && <p className="text-sm font-semibold text-danger">{error}</p>}
          <div className="flex justify-end gap-2.5 pt-1"><Button type="button" variant="ghost" size="sm" onClick={onClose}>Batal</Button><Button type="submit" size="sm" disabled={pending}>{pending ? "Memproses…" : "Terima"}</Button></div>
        </form>
      </div>
    </div>
  );
}

const lbl = "mb-1.5 block text-sm font-bold";
const inp = "h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm font-medium outline-none focus:border-primary/40";
const sel = inp + " px-3";
