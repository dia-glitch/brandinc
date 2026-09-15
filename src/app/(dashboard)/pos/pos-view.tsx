"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Minus, Trash2, ShoppingCart, CheckCircle2, ImageOff, MapPin } from "lucide-react";
import { formatIDR } from "@/lib/utils";
import { posCheckout, type PosCheckoutLine } from "./actions";

export type PosLoc = { id: string; name: string; kind: string };
export type PosItem = {
  variantId: string; sku: string; size: string; productName: string;
  brandId: string; brandName: string; image: string | null;
  retail: number; cogm: number; stock: Record<string, number>;
};
type CartLine = { item: PosItem; qty: number };
const METHODS = ["Tunai", "Transfer", "QRIS", "Kartu Debit", "Kartu Kredit"];

export function POSView({ locations, items, canEdit }: { locations: PosLoc[]; items: PosItem[]; canEdit: boolean }) {
  const router = useRouter();
  const [locId, setLocId] = useState(locations[0]?.id ?? "");
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [method, setMethod] = useState("Tunai");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string[] | null>(null);

  const loc = locations.find((l) => l.id === locId);
  const stockAt = (it: PosItem) => it.stock[locId] ?? 0;

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items
      .filter((it) => stockAt(it) > 0)
      .filter((it) => !s || (it.productName + " " + it.sku).toLowerCase().includes(s))
      .sort((a, b) => a.productName.localeCompare(b.productName) || a.sku.localeCompare(b.sku));
  }, [items, q, locId]);

  const inCart = (vid: string) => cart.find((c) => c.item.variantId === vid)?.qty ?? 0;
  const total = cart.reduce((s, c) => s + c.qty * c.item.retail, 0);
  const totalQty = cart.reduce((s, c) => s + c.qty, 0);

  function add(it: PosItem) {
    if (!canEdit) return;
    setError(null); setDone(null);
    const max = stockAt(it);
    setCart((p) => {
      const ex = p.find((c) => c.item.variantId === it.variantId);
      if (ex) {
        if (ex.qty >= max) return p;
        return p.map((c) => (c.item.variantId === it.variantId ? { ...c, qty: c.qty + 1 } : c));
      }
      return [...p, { item: it, qty: 1 }];
    });
  }
  function setQty(vid: string, delta: number) {
    setCart((p) => p.flatMap((c) => {
      if (c.item.variantId !== vid) return [c];
      const max = stockAt(c.item);
      const next = Math.min(max, Math.max(0, c.qty + delta));
      return next === 0 ? [] : [{ ...c, qty: next }];
    }));
  }
  function removeLine(vid: string) { setCart((p) => p.filter((c) => c.item.variantId !== vid)); }

  function checkout() {
    if (!canEdit || cart.length === 0 || !loc) return;
    setError(null); setDone(null);
    const lines: PosCheckoutLine[] = cart.map((c) => ({
      brandId: c.item.brandId, variantId: c.item.variantId, warehouseId: locId,
      sku: c.item.sku, size: c.item.size, productName: c.item.productName,
      qty: c.qty, retail: c.item.retail, price: c.item.retail, cogm: c.item.cogm,
    }));
    const d = new Date();
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    start(async () => {
      const res = await posCheckout({ warehouseId: locId, method, locationName: loc.name, date, lines });
      if (!res.ok) { setError(res.error); return; }
      setDone(res.codes); setCart([]); router.refresh();
    });
  }

  // Reset cart bila lokasi ganti (stok beda).
  function changeLoc(id: string) { setLocId(id); setCart([]); setError(null); setDone(null); }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Sales</p>
          <h1 className="text-2xl font-extrabold">POS — Kasir Popup</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">Jual dari stok lokasi terpilih. Stok lokasi berkurang otomatis saat transaksi.</p>
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2">
          <MapPin className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Lokasi</span>
          <select value={locId} onChange={(e) => changeLoc(e.target.value)} className="bg-transparent text-sm font-bold outline-none">
            {locations.length === 0 && <option value="">— tidak ada lokasi —</option>}
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}{l.kind === "store" ? " · Store" : ""}</option>)}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Katalog produk */}
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
            <p className="py-8 text-center text-sm font-medium text-muted-foreground">Keranjang kosong — klik produk untuk menambah.</p>
          ) : (
            <div className="mb-3 max-h-[46vh] space-y-2 overflow-y-auto">
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

          <div className="mb-3">
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Metode Bayar</p>
            <div className="flex flex-wrap gap-1.5">
              {METHODS.map((m) => (
                <button key={m} onClick={() => setMethod(m)} data-active={method === m}
                  className={"rounded-lg px-3 py-1.5 text-xs font-bold transition " + (method === m ? "bg-eerie text-white" : "border border-border hover:bg-muted")}>{m}</button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="text-sm font-bold text-muted-foreground">Total</span>
            <span className="text-2xl font-black tracking-tight">{formatIDR(total)}</span>
          </div>

          {error && <p className="mt-2 text-sm font-semibold text-danger">{error}</p>}
          {done && (
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-emerald-300 bg-honeydew/40 px-3 py-2 text-sm font-bold text-eerie">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Transaksi tersimpan: {done.join(", ")}
            </div>
          )}

          <button onClick={checkout} disabled={!canEdit || cart.length === 0 || pending}
            className="mt-3 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary text-base font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {pending ? "Memproses…" : `Bayar ${total > 0 ? formatIDR(total) : ""}`.trim()}
          </button>
          {!canEdit && <p className="mt-2 text-center text-xs font-medium text-muted-foreground">Anda tidak punya akses untuk transaksi POS.</p>}
        </div>
      </div>
    </div>
  );
}
