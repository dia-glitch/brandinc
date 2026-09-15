"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Minus, Trash2, ShoppingCart, CheckCircle2, ImageOff, MapPin, Lock, Unlock, Printer, Mail, X } from "lucide-react";
import { formatIDR } from "@/lib/utils";
import { posCheckout, type PosCheckoutLine } from "./actions";

export type PosLoc = { id: string; name: string; kind: string };
export type PosItem = {
  variantId: string; sku: string; size: string; productName: string;
  brandId: string; brandName: string; image: string | null;
  retail: number; cogm: number; stock: Record<string, number>;
};
export type RecapRow = { code: string; date: string; brand: string; customer: string; method: string; location: string; total: number };
type CartLine = { item: PosItem; qty: number };
type Receipt = {
  codes: string[]; dateTime: string; location: string; method: string;
  customer: { name: string; phone: string; email: string };
  lines: { name: string; sku: string; size: string; qty: number; price: number }[];
  total: number; totalQty: number;
};
const METHODS = ["Tunai", "Transfer", "QRIS", "Kartu Debit", "Kartu Kredit"];

function todayStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function ls(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } }
function lsSet(key: string, v: string) { try { localStorage.setItem(key, v); } catch { /* ignore */ } }

export function POSView({ locations, items, recap, canEdit }: { locations: PosLoc[]; items: PosItem[]; recap: RecapRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<"kasir" | "rekap">("kasir");
  const [locId, setLocId] = useState(locations[0]?.id ?? "");
  const [locked, setLocked] = useState(false);
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [method, setMethod] = useState("Tunai");
  const [cust, setCust] = useState({ name: "", phone: "", email: "" });
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [rekapDate, setRekapDate] = useState(todayStr());

  // Kunci lokasi tersimpan (per browser) → refresh tidak balik ke gudang utama.
  useEffect(() => {
    const savedLoc = ls("pos_loc");
    const savedLock = ls("pos_locked") === "1";
    if (savedLoc && locations.some((l) => l.id === savedLoc)) setLocId(savedLoc);
    if (savedLock) setLocked(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (locId) lsSet("pos_loc", locId); }, [locId]);
  useEffect(() => { lsSet("pos_locked", locked ? "1" : "0"); }, [locked]);

  const loc = locations.find((l) => l.id === locId);
  const stockAt = (it: PosItem) => it.stock[locId] ?? 0;

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items
      .filter((it) => (it.stock[locId] ?? 0) > 0)
      .filter((it) => !s || (it.productName + " " + it.sku).toLowerCase().includes(s))
      .sort((a, b) => a.productName.localeCompare(b.productName) || a.sku.localeCompare(b.sku));
  }, [items, q, locId]);

  const inCart = (vid: string) => cart.find((c) => c.item.variantId === vid)?.qty ?? 0;
  const total = cart.reduce((s, c) => s + c.qty * c.item.retail, 0);
  const totalQty = cart.reduce((s, c) => s + c.qty, 0);

  function add(it: PosItem) {
    if (!canEdit) return;
    setError(null); setReceipt(null);
    const max = stockAt(it);
    setCart((p) => {
      const ex = p.find((c) => c.item.variantId === it.variantId);
      if (ex) { if (ex.qty >= max) return p; return p.map((c) => (c.item.variantId === it.variantId ? { ...c, qty: c.qty + 1 } : c)); }
      return [...p, { item: it, qty: 1 }];
    });
  }
  function setQty(vid: string, delta: number) {
    setCart((p) => p.flatMap((c) => {
      if (c.item.variantId !== vid) return [c];
      const next = Math.min(stockAt(c.item), Math.max(0, c.qty + delta));
      return next === 0 ? [] : [{ ...c, qty: next }];
    }));
  }
  function removeLine(vid: string) { setCart((p) => p.filter((c) => c.item.variantId !== vid)); }
  function changeLoc(id: string) { if (locked) return; setLocId(id); setCart([]); setError(null); setReceipt(null); }

  function checkout() {
    if (!canEdit || cart.length === 0 || !loc) return;
    setError(null); setReceipt(null);
    const snapshot = cart.map((c) => ({ name: c.item.productName, sku: c.item.sku, size: c.item.size, qty: c.qty, price: c.item.retail }));
    const snapTotal = total, snapQty = totalQty, snapMethod = method, snapCust = { ...cust };
    const lines: PosCheckoutLine[] = cart.map((c) => ({
      brandId: c.item.brandId, variantId: c.item.variantId, warehouseId: locId,
      sku: c.item.sku, size: c.item.size, productName: c.item.productName,
      qty: c.qty, retail: c.item.retail, price: c.item.retail, cogm: c.item.cogm,
    }));
    start(async () => {
      const res = await posCheckout({
        warehouseId: locId, method: snapMethod, locationName: loc.name, date: todayStr(),
        customerName: snapCust.name, customerPhone: snapCust.phone, customerEmail: snapCust.email, lines,
      });
      if (!res.ok) { setError(res.error); return; }
      const now = new Date();
      setReceipt({
        codes: res.codes, dateTime: now.toLocaleString("id-ID"), location: loc.name, method: snapMethod,
        customer: snapCust, lines: snapshot, total: snapTotal, totalQty: snapQty,
      });
      setCart([]); setCust({ name: "", phone: "", email: "" });
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Sales</p>
          <h1 className="text-2xl font-extrabold">POS — Kasir Popup</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">Jual dari stok lokasi terpilih. Stok lokasi berkurang otomatis saat transaksi.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2">
          <MapPin className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Lokasi</span>
          <select value={locId} onChange={(e) => changeLoc(e.target.value)} disabled={locked} className="bg-transparent text-sm font-bold outline-none disabled:opacity-70">
            {locations.length === 0 && <option value="">— tidak ada lokasi —</option>}
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}{l.kind === "store" ? " · Store" : ""}</option>)}
          </select>
          <button onClick={() => setLocked((v) => !v)} title={locked ? "Buka kunci lokasi" : "Kunci lokasi"}
            className={"grid h-8 w-8 place-items-center rounded-lg " + (locked ? "bg-eerie text-white" : "border border-border hover:bg-muted")}>
            {locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="flex w-fit rounded-xl border border-border bg-background p-0.5">
        {([["kasir", "Kasir"], ["rekap", "Rekap Kasir"]] as const).map(([v, label]) => (
          <button key={v} onClick={() => setTab(v)} className={"rounded-lg px-4 py-1.5 text-sm font-bold transition " + (tab === v ? "bg-eerie text-white" : "text-muted-foreground hover:text-foreground")}>{label}</button>
        ))}
      </div>

      {locked && tab === "kasir" && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-honeydew/40 px-3 py-2 text-xs font-bold text-eerie">
          <Lock className="h-3.5 w-3.5" /> Lokasi dikunci ke <b>{loc?.name}</b> — aman dari salah pilih saat event. Klik gembok untuk ganti.
        </div>
      )}

      {tab === "kasir" ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Katalog */}
          <div className="space-y-3 lg:col-span-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari produk / SKU…" className="h-11 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm font-medium outline-none focus:border-primary/40" />
            </div>
            {list.length === 0 ? (
              <div className="card p-10 text-center text-sm font-medium text-muted-foreground">Tidak ada stok di lokasi ini. Transfer stok ke lokasi ini dulu (Distribution).</div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {list.map((it) => {
                  const s = stockAt(it); const c = inCart(it.variantId);
                  return (
                    <button key={it.variantId} onClick={() => add(it)} disabled={!canEdit || c >= s}
                      className="card group flex flex-col overflow-hidden p-0 text-left transition hover:border-primary/40 disabled:opacity-60">
                      <div className="relative aspect-square w-full bg-muted">
                        {it.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={it.image} alt={it.productName} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground"><ImageOff className="h-6 w-6" /></div>
                        )}
                        {c > 0 && <span className="absolute right-1.5 top-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">{c}</span>}
                      </div>
                      <div className="space-y-0.5 p-2.5">
                        <p className="truncate text-xs font-bold leading-tight">{it.productName}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">{it.sku}{it.size ? ` · ${it.size}` : ""}</p>
                        <div className="flex items-center justify-between pt-0.5">
                          <span className="text-xs font-extrabold text-primary">{it.retail > 0 ? formatIDR(it.retail) : "—"}</span>
                          <span className={"text-[10px] font-bold " + (s <= 3 ? "text-danger" : "text-muted-foreground")}>stok {s}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Keranjang */}
          <div className="card flex h-fit flex-col p-4 lg:sticky lg:top-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-extrabold"><ShoppingCart className="h-4 w-4" /> Keranjang</h2>
              <span className="text-sm font-bold text-muted-foreground">{totalQty} item</span>
            </div>

            {cart.length === 0 ? (
              <p className="py-6 text-center text-sm font-medium text-muted-foreground">Keranjang kosong — klik produk untuk menambah.</p>
            ) : (
              <div className="mb-3 max-h-[38vh] space-y-2 overflow-y-auto">
                {cart.map((c) => (
                  <div key={c.item.variantId} className="flex items-center gap-2 rounded-xl border border-border p-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold">{c.item.productName}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">{c.item.sku}{c.item.size ? ` · ${c.item.size}` : ""} · {formatIDR(c.item.retail)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setQty(c.item.variantId, -1)} className="grid h-7 w-7 place-items-center rounded-lg border border-border hover:bg-muted"><Minus className="h-3.5 w-3.5" /></button>
                      <span className="w-6 text-center text-sm font-bold tabular-nums">{c.qty}</span>
                      <button onClick={() => setQty(c.item.variantId, 1)} disabled={c.qty >= stockAt(c.item)} className="grid h-7 w-7 place-items-center rounded-lg border border-border hover:bg-muted disabled:opacity-40"><Plus className="h-3.5 w-3.5" /></button>
                    </div>
                    <span className="w-20 text-right text-xs font-extrabold tabular-nums">{formatIDR(c.qty * c.item.retail)}</span>
                    <button onClick={() => removeLine(c.item.variantId)} className="text-muted-foreground hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
            )}

            {/* Customer */}
            <div className="mb-3 space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Customer (opsional)</p>
              <input value={cust.name} onChange={(e) => setCust((p) => ({ ...p, name: e.target.value }))} placeholder="Nama" className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm font-medium outline-none focus:border-primary/40" />
              <div className="flex gap-1.5">
                <input value={cust.phone} onChange={(e) => setCust((p) => ({ ...p, phone: e.target.value }))} placeholder="No. HP" className="h-9 w-1/2 rounded-lg border border-border bg-background px-2.5 text-sm font-medium outline-none focus:border-primary/40" />
                <input value={cust.email} onChange={(e) => setCust((p) => ({ ...p, email: e.target.value }))} placeholder="Email (struk)" className="h-9 w-1/2 rounded-lg border border-border bg-background px-2.5 text-sm font-medium outline-none focus:border-primary/40" />
              </div>
            </div>

            <div className="mb-3">
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Metode Bayar</p>
              <div className="flex flex-wrap gap-1.5">
                {METHODS.map((m) => (
                  <button key={m} onClick={() => setMethod(m)} className={"rounded-lg px-3 py-1.5 text-xs font-bold transition " + (method === m ? "bg-eerie text-white" : "border border-border hover:bg-muted")}>{m}</button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm font-bold text-muted-foreground">Total</span>
              <span className="text-2xl font-black tracking-tight">{formatIDR(total)}</span>
            </div>

            {error && <p className="mt-2 text-sm font-semibold text-danger">{error}</p>}

            <button onClick={checkout} disabled={!canEdit || cart.length === 0 || pending}
              className="mt-3 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary text-base font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50">
              {pending ? "Memproses…" : `Bayar ${total > 0 ? formatIDR(total) : ""}`.trim()}
            </button>
            {!canEdit && <p className="mt-2 text-center text-xs font-medium text-muted-foreground">Anda tidak punya akses untuk transaksi POS.</p>}
          </div>
        </div>
      ) : (
        <RekapPanel recap={recap} date={rekapDate} setDate={setRekapDate} location={loc?.name ?? ""} />
      )}

      {receipt && <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}

/* ---------------- Rekap Kasir (settlement harian) ---------------- */
function RekapPanel({ recap, date, setDate, location }: { recap: RecapRow[]; date: string; setDate: (v: string) => void; location: string }) {
  const rows = useMemo(() => recap.filter((r) => r.date === date && (!location || r.location === location)), [recap, date, location]);
  const byMethod = useMemo(() => {
    const m = new Map<string, { total: number; count: number }>();
    for (const r of rows) { const cur = m.get(r.method) ?? { total: 0, count: 0 }; cur.total += r.total; cur.count += 1; m.set(r.method, cur); }
    return Array.from(m.entries()).map(([method, v]) => ({ method, ...v })).sort((a, b) => b.total - a.total);
  }, [rows]);
  const grand = rows.reduce((s, r) => s + r.total, 0);

  function print() {
    const html = `<h2>Rekap Kasir — ${location || "Semua Lokasi"}</h2><p>Tanggal: ${date}</p>
      <table style="width:100%;border-collapse:collapse" border="1" cellpadding="6">
      <tr><th align="left">Kode</th><th align="left">Customer</th><th align="left">Metode</th><th align="right">Total</th></tr>
      ${rows.map((r) => `<tr><td>${r.code}</td><td>${r.customer || "-"}</td><td>${r.method}</td><td align="right">${formatIDR(r.total)}</td></tr>`).join("")}
      </table>
      <h3>Per Metode</h3><ul>${byMethod.map((b) => `<li>${b.method}: ${formatIDR(b.total)} (${b.count} trx)</li>`).join("")}</ul>
      <h3>TOTAL: ${formatIDR(grand)} · ${rows.length} transaksi</h3>`;
    printHtml(`Rekap Kasir ${date}`, html);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm font-bold">Tanggal
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-semibold outline-none focus:border-primary/40" />
        </label>
        <button onClick={print} disabled={rows.length === 0} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-bold hover:bg-muted disabled:opacity-50"><Printer className="h-4 w-4" /> Cetak Rekap</button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-4"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Total Penjualan</p><p className="mt-1 text-2xl font-black tabular-nums tracking-tight">{formatIDR(grand)}</p></div>
        <div className="card p-4"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Transaksi</p><p className="mt-1 text-2xl font-black tabular-nums tracking-tight">{rows.length}</p></div>
        {byMethod.slice(0, 2).map((b) => (
          <div key={b.method} className="card p-4"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{b.method}</p><p className="mt-1 text-2xl font-black tabular-nums tracking-tight">{formatIDR(b.total)}</p><p className="text-[11px] font-semibold text-muted-foreground">{b.count} trx</p></div>
        ))}
      </div>

      {byMethod.length > 0 && (
        <div className="card p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Rekap per Metode</p>
          <div className="flex flex-wrap gap-2">
            {byMethod.map((b) => (
              <span key={b.method} className="rounded-full bg-muted px-3 py-1.5 text-sm font-bold">{b.method}: {formatIDR(b.total)} <span className="text-muted-foreground">· {b.count}</span></span>
            ))}
          </div>
        </div>
      )}

      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <th className="py-2.5 pl-4 pr-3">Kode</th><th className="py-2.5 pr-3">Brand</th><th className="py-2.5 pr-3">Customer</th><th className="py-2.5 pr-3">Metode</th><th className="py-2.5 pr-4 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="py-10 text-center text-sm font-medium text-muted-foreground">Belum ada transaksi POS pada tanggal & lokasi ini.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.code} className="border-t border-border font-semibold hover:bg-muted/40">
                <td className="py-2.5 pl-4 pr-3 font-mono text-xs">{r.code}</td>
                <td className="py-2.5 pr-3">{r.brand}</td>
                <td className="py-2.5 pr-3 font-medium text-muted-foreground">{r.customer || "—"}</td>
                <td className="py-2.5 pr-3">{r.method}</td>
                <td className="py-2.5 pr-4 text-right tabular-nums font-extrabold">{formatIDR(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Struk / Receipt ---------------- */
function receiptHtml(r: Receipt): string {
  const lines = r.lines.map((l) => `<tr><td>${l.name}${l.size ? " · " + l.size : ""}<br><span style="color:#888;font-size:11px">${l.sku} × ${l.qty}</span></td><td align="right">${formatIDR(l.qty * l.price)}</td></tr>`).join("");
  return `<div style="font-family:system-ui,sans-serif;max-width:320px">
    <h2 style="margin:0">Brand.Inc</h2>
    <p style="margin:2px 0;color:#555">${r.location}</p>
    <p style="margin:2px 0;color:#555;font-size:12px">${r.dateTime} · ${r.method}</p>
    <p style="margin:2px 0;color:#555;font-size:12px">No: ${r.codes.join(", ")}</p>
    ${r.customer.name || r.customer.phone ? `<p style="margin:2px 0;font-size:12px">Customer: ${r.customer.name || "-"} ${r.customer.phone ? "· " + r.customer.phone : ""}</p>` : ""}
    <hr>
    <table style="width:100%;border-collapse:collapse;font-size:13px">${lines}</table>
    <hr>
    <table style="width:100%;font-weight:800"><tr><td>TOTAL (${r.totalQty} pcs)</td><td align="right">${formatIDR(r.total)}</td></tr></table>
    <p style="text-align:center;color:#888;font-size:12px;margin-top:12px">Terima kasih 🙏</p>
  </div>`;
}
function printHtml(title: string, bodyHtml: string) {
  const w = window.open("", "_blank", "width=380,height=640");
  if (!w) { alert("Popup diblokir. Izinkan popup untuk mencetak."); return; }
  w.document.write(`<!doctype html><html><head><title>${title}</title></head><body>${bodyHtml}</body></html>`);
  w.document.close(); w.focus();
  setTimeout(() => { w.print(); }, 250);
}

function ReceiptModal({ receipt, onClose }: { receipt: Receipt; onClose: () => void }) {
  function emailReceipt() {
    const to = receipt.customer.email.trim();
    const subject = `Struk Pembelian ${receipt.codes.join(", ")}`;
    const body = [
      `Brand.Inc — ${receipt.location}`, `${receipt.dateTime} · ${receipt.method}`, `No: ${receipt.codes.join(", ")}`, "",
      ...receipt.lines.map((l) => `${l.name}${l.size ? " · " + l.size : ""} (${l.sku}) x${l.qty}  ${formatIDR(l.qty * l.price)}`),
      "", `TOTAL (${receipt.totalQty} pcs): ${formatIDR(receipt.total)}`, "", "Terima kasih 🙏",
    ].join("\n");
    window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-eerie/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-soft" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-extrabold"><CheckCircle2 className="h-5 w-5 text-emerald-600" /> Transaksi Berhasil</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="rounded-xl border border-border p-4 text-sm">
          <p className="font-bold">{receipt.location}</p>
          <p className="text-xs text-muted-foreground">{receipt.dateTime} · {receipt.method} · {receipt.codes.join(", ")}</p>
          {(receipt.customer.name || receipt.customer.phone) && <p className="mt-1 text-xs">Customer: {receipt.customer.name || "-"} {receipt.customer.phone ? `· ${receipt.customer.phone}` : ""}</p>}
          <div className="my-2 border-t border-border" />
          <div className="space-y-1">
            {receipt.lines.map((l, i) => (
              <div key={i} className="flex justify-between gap-2">
                <span className="min-w-0 truncate">{l.name}{l.size ? ` · ${l.size}` : ""} <span className="text-muted-foreground">×{l.qty}</span></span>
                <span className="tabular-nums font-semibold">{formatIDR(l.qty * l.price)}</span>
              </div>
            ))}
          </div>
          <div className="my-2 border-t border-border" />
          <div className="flex justify-between font-extrabold"><span>Total ({receipt.totalQty} pcs)</span><span className="tabular-nums">{formatIDR(receipt.total)}</span></div>
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={() => printHtml(`Struk ${receipt.codes.join(",")}`, receiptHtml(receipt))} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-eerie px-4 py-2.5 text-sm font-bold text-white hover:opacity-90"><Printer className="h-4 w-4" /> Cetak Struk</button>
          <button onClick={emailReceipt} disabled={!receipt.customer.email.trim()} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-bold hover:bg-muted disabled:opacity-50"><Mail className="h-4 w-4" /> Email Struk</button>
        </div>
        <button onClick={onClose} className="mt-2 w-full rounded-xl py-2 text-sm font-bold text-muted-foreground hover:bg-muted">Transaksi Baru</button>
      </div>
    </div>
  );
}
