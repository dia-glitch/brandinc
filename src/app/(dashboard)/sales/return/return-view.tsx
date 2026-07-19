"use client";

import { useState, useMemo, useTransition, Fragment } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Trash2, ChevronRight, Search, Undo2, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchSelect } from "@/components/ui/search-select";
import { cn, formatIDR } from "@/lib/utils";
import { createSalesReturn, deleteSalesReturn, type ReturnLineInput } from "./actions";

export type OrderLine = { variantId: string; warehouseId: string; sku: string; size: string; productName: string; qty: number; price: number; cogm: number };
export type OrderOpt = { id: string; code: string; brandId: string | null; brand: string; channelId: string | null; settlement: string; date: string | null; lines: OrderLine[] };
export type WarehouseOpt = { id: string; name: string; brandId: string | null };
export type ReturnRow = { id: string; code: string; orderCode: string; brand: string; channel: string; date: string | null; reason: string; qty: number; value: number; lines: { sku: string; productName: string; size: string; qty: number; price: number; restock: string }[] };

export function ReturnView({ orders, rows, damageWarehouses }: { orders: OrderOpt[]; rows: ReturnRow[]; damageWarehouses: WarehouseOpt[] }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const query = q.trim().toLowerCase();
  const list = rows.filter((r) => !query || r.code.toLowerCase().includes(query) || r.orderCode.toLowerCase().includes(query) || r.brand.toLowerCase().includes(query));
  const totalValue = list.reduce((s, r) => s + r.value, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Sales</p>
          <h1 className="text-2xl font-extrabold">Return Penjualan</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">Barang kembali → stok masuk lagi (Good/Damage), revenue &amp; COGS dibalik di P&amp;L. Total nilai retur: <b className="text-danger">{formatIDR(totalValue)}</b></p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)} disabled={orders.length === 0}><Plus className="h-4 w-4" /> Buat Return</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari kode retur / order / brand…" className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm font-medium outline-none focus:border-primary/40" />
        </div>
        <span className="text-sm font-medium text-muted-foreground">{list.length} retur</span>
      </div>

      {list.length === 0 ? (
        <div className="card p-10 text-center text-sm font-medium text-muted-foreground">Belum ada return penjualan.</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <th className="w-8 py-2.5 pl-4"></th><th className="py-2.5 pr-3">Kode</th><th className="py-2.5 pr-3">Order</th><th className="py-2.5 pr-3">Brand</th>
                <th className="py-2.5 pr-3">Tgl</th><th className="py-2.5 pr-3">Alasan</th><th className="py-2.5 pr-3 text-right">Qty</th><th className="py-2.5 pr-3 text-right">Nilai</th><th className="py-2.5 pr-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => <ReturnRowItem key={r.id} row={r} />)}
            </tbody>
          </table>
        </div>
      )}

      {open && <ReturnForm orders={orders} damageWarehouses={damageWarehouses} onClose={() => setOpen(false)} />}
    </div>
  );
}

function ReturnRowItem({ row }: { row: ReturnRow }) {
  const router = useRouter();
  const [openRow, setOpenRow] = useState(false);
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);
  return (
    <Fragment>
      <tr className="border-t border-border font-semibold hover:bg-muted/40">
        <td className="py-2.5 pl-4"><button onClick={() => setOpenRow((o) => !o)} className="grid h-6 w-6 place-items-center rounded-lg hover:bg-muted"><ChevronRight className={cn("h-4 w-4 transition-transform", openRow && "rotate-90")} /></button></td>
        <td className="py-2.5 pr-3 font-mono text-xs">{row.code}</td>
        <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">{row.orderCode}</td>
        <td className="py-2.5 pr-3"><Badge tone="neutral">{row.brand}</Badge></td>
        <td className="py-2.5 pr-3 font-medium text-muted-foreground">{row.date ?? "—"}</td>
        <td className="py-2.5 pr-3 font-medium text-muted-foreground">{row.reason || "—"}</td>
        <td className="py-2.5 pr-3 text-right tabular-nums">{row.qty}</td>
        <td className="py-2.5 pr-3 text-right tabular-nums text-danger">{formatIDR(row.value)}</td>
        <td className="py-2.5 pr-4 text-right">
          {confirm ? <Button size="sm" variant="danger" disabled={pending} onClick={() => startTransition(async () => { await deleteSalesReturn(row.id); router.refresh(); })}>Yakin?</Button>
            : <button onClick={() => setConfirm(true)} className="text-muted-foreground hover:text-danger"><Trash2 className="h-4 w-4" /></button>}
        </td>
      </tr>
      {openRow && (
        <tr className="bg-muted/20"><td colSpan={9} className="px-5 py-3">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs font-bold uppercase text-muted-foreground"><th className="py-1.5 pr-3">Produk</th><th className="py-1.5 px-2">SKU</th><th className="py-1.5 px-2 text-right">Qty</th><th className="py-1.5 px-2 text-right">Harga</th><th className="py-1.5 px-2">Restock</th></tr></thead>
            <tbody>{row.lines.map((l, i) => (
              <tr key={i} className="border-t border-border/60 font-semibold"><td className="py-1.5 pr-3">{l.productName}{l.size ? ` · ${l.size}` : ""}</td><td className="py-1.5 px-2 font-mono text-xs text-muted-foreground">{l.sku}</td><td className="py-1.5 px-2 text-right tabular-nums">{l.qty}</td><td className="py-1.5 px-2 text-right tabular-nums">{formatIDR(l.price)}</td><td className="py-1.5 px-2">{l.restock === "damaged" ? <Badge tone="danger">Damage</Badge> : <Badge tone="success">Good</Badge>}</td></tr>
            ))}</tbody>
          </table>
        </td></tr>
      )}
    </Fragment>
  );
}

function ReturnForm({ orders, damageWarehouses, onClose }: { orders: OrderOpt[]; damageWarehouses: WarehouseOpt[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [orderId, setOrderId] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });
  // per line: qty retur & restock status
  const [qtyMap, setQtyMap] = useState<Record<number, string>>({});
  const [restockMap, setRestockMap] = useState<Record<number, string>>({});
  // refund → data bank customer (diproses Finance)
  const [doRefund, setDoRefund] = useState(false);
  const [refBank, setRefBank] = useState("");
  const [refAcc, setRefAcc] = useState("");
  const [refHolder, setRefHolder] = useState("");

  const order = orders.find((o) => o.id === orderId);
  const damageWh = (brandId: string | null) => damageWarehouses.find((w) => w.brandId === brandId) ?? damageWarehouses.find((w) => !w.brandId) ?? damageWarehouses[0];
  const retTotal = useMemo(() => (order ? order.lines.reduce((s, l, i) => s + (Number(qtyMap[i]) || 0) * l.price, 0) : 0), [order, qtyMap]);

  function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    if (!order) { setError("Pilih order penjualan."); return; }
    const lines: ReturnLineInput[] = [];
    order.lines.forEach((l, i) => {
      const qty = Number(qtyMap[i]) || 0;
      if (qty <= 0) return;
      if (qty > l.qty) { setError(`Qty retur ${l.sku} melebihi terjual (${l.qty}).`); return; }
      const restock = restockMap[i] || "available";
      const wh = restock === "damaged" ? (damageWh(order.brandId)?.id ?? l.warehouseId) : l.warehouseId;
      lines.push({ variantId: l.variantId, warehouseId: wh, restock, sku: l.sku, size: l.size, productName: l.productName, qty, price: l.price, cogm: l.cogm });
    });
    if (lines.length === 0) { setError("Isi qty retur minimal satu produk."); return; }
    startTransition(async () => {
      const res = await createSalesReturn({
        orderId: order.id, brandId: order.brandId ?? "", channelId: order.channelId, settlement: order.settlement, returnDate: date, reason, notes, lines,
        refundRequired: doRefund, refundAmount: doRefund ? retTotal : 0, refundBankName: refBank, refundAccountNo: refAcc, refundAccountHolder: refHolder,
      });
      if (!res.ok) { setError(res.error); return; }
      setSaved(res.code); router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-eerie/40 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-surface p-6 shadow-soft">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-extrabold inline-flex items-center gap-2"><Undo2 className="h-5 w-5" /> {saved ? "Return Tersimpan" : "Buat Return Penjualan"}</h2><button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button></div>

        {saved ? (
          <div className="space-y-5 py-2 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600"><CheckCircle2 className="h-8 w-8" /></div>
            <div><p className="text-sm font-medium text-muted-foreground">Stok dikembalikan &amp; revenue dibalik</p><p className="text-2xl font-black tracking-tight">{saved}</p></div>
            <div className="flex justify-center gap-2.5"><Button type="button" variant="ghost" size="sm" onClick={onClose}>Selesai</Button></div>
          </div>
        ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label className={lbl}>Order Penjualan</label>
              <SearchSelect value={orderId} onChange={(v) => { setOrderId(v); setQtyMap({}); setRestockMap({}); }} placeholder="Cari kode order…" inputClassName="h-11 rounded-xl px-3.5 pr-8 font-medium"
                options={orders.map((o) => ({ value: o.id, label: `${o.code} · ${o.brand}`, hint: `${o.date ?? ""}` }))} />
            </div>
            <div><label className={lbl}>Tanggal Retur</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inp} /></div>
          </div>

          {order && (
            <div className="rounded-xl border border-border p-3">
              <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Barang Diretur (dari {order.code})</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs font-bold uppercase text-muted-foreground"><th className="py-1.5 pr-2">Produk / SKU</th><th className="py-1.5 px-1 text-right">Terjual</th><th className="py-1.5 px-1 text-right">Qty Retur</th><th className="py-1.5 px-1">Restock ke</th></tr></thead>
                  <tbody>
                    {order.lines.map((l, i) => (
                      <tr key={i} className="border-t border-border/60">
                        <td className="py-1 pr-2 font-semibold">{l.productName}{l.size ? ` · ${l.size}` : ""} <span className="ml-1 font-mono text-xs text-muted-foreground">{l.sku}</span></td>
                        <td className="py-1 px-1 text-right tabular-nums text-muted-foreground">{l.qty}</td>
                        <td className="py-1 px-1"><input type="number" step="any" value={qtyMap[i] ?? ""} onChange={(e) => setQtyMap((p) => ({ ...p, [i]: e.target.value }))} className="h-9 w-20 rounded-lg border border-border bg-background px-2 text-right text-sm font-semibold outline-none focus:border-primary/40" placeholder="0" /></td>
                        <td className="py-1 px-1"><select value={restockMap[i] ?? "available"} onChange={(e) => setRestockMap((p) => ({ ...p, [i]: e.target.value }))} className="h-9 rounded-lg border border-border bg-background px-2 text-sm font-semibold outline-none focus:border-primary/40"><option value="available">Good (jual lagi)</option><option value="damaged">Damage</option></select></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {order && (
            <div className="rounded-xl border border-border p-3">
              <label className="flex items-center gap-2 text-sm font-bold">
                <input type="checkbox" checked={doRefund} onChange={(e) => setDoRefund(e.target.checked)} className="h-4 w-4 rounded border-border" />
                Perlu refund ke customer (uang penjualan sudah diterima)
              </label>
              {doRefund && (
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                    <div><label className={lbl}>Nominal Refund</label><div className="flex h-11 items-center rounded-xl border border-border bg-muted/40 px-3 text-sm font-bold">{formatIDR(retTotal)}</div></div>
                    <div><label className={lbl}>Bank Customer</label><input value={refBank} onChange={(e) => setRefBank(e.target.value)} className={inp} placeholder="mis. BCA" /></div>
                    <div><label className={lbl}>No. Rekening</label><input value={refAcc} onChange={(e) => setRefAcc(e.target.value)} className={inp} placeholder="no rek customer" /></div>
                    <div><label className={lbl}>Atas Nama</label><input value={refHolder} onChange={(e) => setRefHolder(e.target.value)} className={inp} placeholder="nama pemilik rek" /></div>
                  </div>
                  <p className="text-xs font-semibold text-amber-600">Refund dibuat sebagai permintaan <b>pending</b> — kas belum keluar. Finance akan memproses transfer di tab Finance → Refund.</p>
                </div>
              )}
              <p className="mt-2 text-xs font-medium text-muted-foreground">Untuk penjualan AR yang belum dibayar, tidak perlu refund — tagihan AR otomatis berkurang. Centang ini hanya bila uang sudah diterima.</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label className={lbl}>Alasan</label><input value={reason} onChange={(e) => setReason(e.target.value)} className={inp} placeholder="mis. cacat / salah size / komplain" /></div>
            <div><label className={lbl}>Catatan</label><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inp} placeholder="opsional" /></div>
          </div>

          {error && <p className="text-sm font-semibold text-danger">{error}</p>}
          <div className="flex justify-end gap-2.5 pt-1"><Button type="button" variant="ghost" size="sm" onClick={onClose}>Batal</Button><Button type="submit" size="sm" disabled={pending || !order}>{pending ? "Menyimpan…" : "Simpan Return"}</Button></div>
        </form>
        )}
      </div>
    </div>
  );
}

const lbl = "mb-1.5 block text-sm font-bold";
const inp = "h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm font-medium outline-none focus:border-primary/40";
