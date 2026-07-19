"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Printer, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchSelect } from "@/components/ui/search-select";
import { formatIDR } from "@/lib/utils";
import { createProductionPO } from "./actions";

export type SpkLineOpt = { id: string; sku: string; size: string; productName: string; qty: number };
export type SpkOpt = {
  id: string; code: string;
  brandId: string; brandName: string;
  supplierId: string | null; supplierName: string;
  dueDelivery: string | null;
  lines: SpkLineOpt[];
};
export type SupplierOpt = { id: string; name: string; is_taxable: boolean };

type Row = { spkLineId: string; sku: string; size: string; productName: string; qtySpk: number; qty: string };

export function ProdPOForm({ spks, suppliers, canEdit = true }: { spks: SpkOpt[]; suppliers: SupplierOpt[]; canEdit?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ id: string; code: string } | null>(null);

  const [spkId, setSpkId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [poDate, setPoDate] = useState("");
  const [dueDelivery, setDueDelivery] = useState("");
  const [notes, setNotes] = useState("");
  const [unitCost, setUnitCost] = useState(""); // ongkos WIP / pcs — satu harga untuk semua SKU
  const [rows, setRows] = useState<Row[]>([]);

  const spk = spks.find((s) => s.id === spkId);
  const supplier = suppliers.find((s) => s.id === supplierId);
  const isPKP = Boolean(supplier?.is_taxable);
  const ppnPercent = isPKP ? 11 : 0;

  const cost = Number(unitCost) || 0;
  const subtotal = useMemo(() => rows.reduce((s, r) => s + (Number(r.qty) || 0) * cost, 0), [rows, cost]);
  const ppnAmount = subtotal * (ppnPercent / 100);
  const total = subtotal + ppnAmount;
  const totalQtyPo = rows.reduce((s, r) => s + (Number(r.qty) || 0), 0);

  function openDialog() {
    setOpen(true);
    if (!poDate) {
      const d = new Date();
      setPoDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    }
  }
  function reset() {
    setSpkId(""); setSupplierId(""); setDueDelivery(""); setNotes(""); setUnitCost(""); setRows([]); setError(null); setSaved(null);
  }
  function close() { setOpen(false); reset(); }

  function onSelectSpk(id: string) {
    setSpkId(id);
    const s = spks.find((x) => x.id === id);
    if (!s) { setRows([]); return; }
    setSupplierId(s.supplierId ?? "");
    setDueDelivery(s.dueDelivery ?? "");
    setRows(s.lines.map((l) => ({
      spkLineId: l.id, sku: l.sku, size: l.size, productName: l.productName,
      qtySpk: l.qty, qty: String(l.qty || ""),
    })));
  }
  function setRowQty(i: number, val: string) {
    setRows((p) => p.map((r, idx) => (idx === i ? { ...r, qty: val } : r)));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!spk) { setError("Pilih SPK dulu."); return; }
    const out = rows
      .filter((r) => Number(r.qty) > 0)
      .map((r) => ({
        spkLineId: r.spkLineId || null, sku: r.sku, size: r.size, productName: r.productName,
        qtySpk: r.qtySpk, qty: Number(r.qty), unitCost: cost,
      }));
    if (out.length === 0) { setError("Isi qty PO minimal satu baris."); return; }
    if (!(cost > 0)) { setError("Isi Ongkos WIP per pcs."); return; }
    startTransition(async () => {
      const res = await createProductionPO({
        spkId: spk.id, spkCode: spk.code, brandId: spk.brandId, supplierId: supplierId || null,
        poDate, dueDelivery, notes, ppnPercent, lines: out,
      });
      if (!res.ok) { setError(res.error); return; }
      setSaved({ id: res.id, code: res.code });
      router.refresh();
    });
  }

  const previewCode = spk ? `PO-${spk.code.toUpperCase()}` : "—";

  if (!canEdit) return null;

  return (
    <>
      <Button size="sm" onClick={openDialog}><Plus className="h-4 w-4" /> Buat PO Produksi</Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-eerie/40 p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-surface p-6 shadow-soft">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-extrabold">{saved ? "PO Produksi Tersimpan" : "Buat PO Produksi"}</h2>
              <button onClick={close} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>

            {saved ? (
              <div className="space-y-5 py-2 text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">PO Produksi berhasil dibuat</p>
                  <p className="text-2xl font-black tracking-tight">{saved.code}</p>
                </div>
                <div className="flex justify-center gap-2.5">
                  <a href={`/print/prodpo/${saved.id}`} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-eerie px-5 py-2.5 text-sm font-bold text-white hover:opacity-90">
                    <Printer className="h-4 w-4" /> Detail / Print
                  </a>
                  <Button type="button" variant="outline" size="sm" onClick={reset}>Buat Lagi</Button>
                  <Button type="button" variant="ghost" size="sm" onClick={close}>Selesai</Button>
                </div>
              </div>
            ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={lbl}>SPK</label>
                  <SearchSelect value={spkId} onChange={onSelectSpk} placeholder="Cari SPK / produk…"
                    inputClassName="h-11 rounded-xl px-3.5 pr-8 font-medium"
                    options={spks.map((s) => ({ value: s.id, label: `${s.code}${s.lines[0]?.productName ? ` · ${s.lines[0].productName}` : ""}` }))} />
                </div>
                <div>
                  <label className={lbl}>Vendor / Makloon</label>
                  <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={sel}>
                    <option value="">— Pilih —</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              {spk && (
                <div className="rounded-xl border border-border bg-muted/40 p-2.5 text-sm">
                  <span className="font-semibold text-muted-foreground">Brand:</span> <b>{spk.brandName}</b>
                  <span className="ml-3 font-semibold text-muted-foreground">Kode PO:</span> <b className="font-mono">{previewCode}</b>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Tanggal PO</label>
                  <input type="date" value={poDate} onChange={(e) => setPoDate(e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Due Delivery</label>
                  <input type="date" value={dueDelivery} onChange={(e) => setDueDelivery(e.target.value)} className={inp} />
                </div>
              </div>

              {/* Ongkos WIP — satu harga untuk semua SKU (1 produk = 1 harga) */}
              {spk && (
                <div className="flex items-end gap-3 rounded-xl border border-border bg-muted/30 p-3">
                  <div className="flex-1">
                    <label className={lbl}>Ongkos WIP / pcs</label>
                    <input type="number" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className={inp} placeholder="mis. 30000" />
                  </div>
                  <p className="pb-3 text-xs font-medium text-muted-foreground">Berlaku untuk semua SKU di PO ini.</p>
                </div>
              )}

              {/* Baris SKU dari SPK: qty SPK (ref) + qty PO (manual) */}
              <div className="rounded-xl border border-border p-3">
                <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                  Item Produksi — qty PO manual (ikut cutting report)
                </p>
                {!spk ? (
                  <p className="py-3 text-center text-sm text-muted-foreground">Pilih SPK dulu untuk memuat SKU-nya.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs font-bold uppercase text-muted-foreground">
                          <th className="py-1.5 pr-2">SKU</th>
                          <th className="py-1.5 px-1">Ukuran</th>
                          <th className="py-1.5 px-1 text-right">Qty SPK</th>
                          <th className="py-1.5 px-1 text-right">Qty PO</th>
                          <th className="py-1.5 px-1 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={r.spkLineId || i} className="border-t border-border/60">
                            <td className="py-1 pr-2 font-mono text-xs">{r.sku}</td>
                            <td className="py-1 px-1">{r.size || "—"}</td>
                            <td className="py-1 px-1 text-right tabular-nums text-muted-foreground">{r.qtySpk}</td>
                            <td className="py-1 px-1">
                              <input type="number" value={r.qty} onChange={(e) => setRowQty(i, e.target.value)}
                                className="h-9 w-20 rounded-lg border border-border bg-background px-2 text-right text-sm font-semibold outline-none focus:border-primary/40" placeholder="0" />
                            </td>
                            <td className="py-1 px-1 text-right text-sm font-semibold tabular-nums">{formatIDR((Number(r.qty) || 0) * cost)}</td>
                          </tr>
                        ))}
                        <tr className="border-t border-border font-semibold text-muted-foreground">
                          <td className="py-1.5" colSpan={2}>Subtotal ({totalQtyPo} pcs)</td>
                          <td colSpan={2}></td>
                          <td className="py-1.5 px-1 text-right tabular-nums">{formatIDR(subtotal)}</td>
                        </tr>
                        <tr className="font-semibold text-muted-foreground">
                          <td className="py-1.5" colSpan={2}>PPN {ppnPercent}% {isPKP ? <span className="text-xs font-bold text-emerald-600">· vendor PKP</span> : ""}</td>
                          <td colSpan={2}></td>
                          <td className="py-1.5 px-1 text-right tabular-nums">{formatIDR(ppnAmount)}</td>
                        </tr>
                        <tr className="border-t border-border bg-muted/40 font-extrabold">
                          <td className="py-1.5" colSpan={2}>Total</td>
                          <td colSpan={2}></td>
                          <td className="py-1.5 px-1 text-right tabular-nums">{formatIDR(total)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <label className={lbl}>Catatan</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-medium outline-none focus:border-primary/40"
                  placeholder="catatan untuk vendor / internal (opsional)" />
              </div>

              {error && <p className="text-sm font-semibold text-danger">{error}</p>}

              <div className="flex justify-end gap-2.5 pt-1">
                <Button type="button" variant="ghost" size="sm" onClick={close}>Batal</Button>
                <Button type="submit" size="sm" disabled={pending}>{pending ? "Menyimpan…" : "Simpan PO"}</Button>
              </div>
            </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const lbl = "mb-1.5 block text-sm font-bold";
const inp = "h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm font-medium outline-none focus:border-primary/40";
const sel = inp + " px-3";
