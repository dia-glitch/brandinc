"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchSelect } from "@/components/ui/search-select";
import { createInbound } from "./actions";

export type POLineOpt = { variantId: string | null; sku: string; size: string; productName: string; qtyPo: number; alreadyGood: number; unitCost: number };
export type POOpt = { id: string; code: string; brandId: string; brandName: string; spkId: string | null; supplierId: string | null; lines: POLineOpt[] };
export type WarehouseOpt = { id: string; name: string; kind: string; brandId: string | null };

type Row = { variantId: string | null; sku: string; size: string; productName: string; qtyPo: number; alreadyGood: number; unitCost: number; incoming: string };

export function IncomingForm({ pos }: { pos: POOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ code: string } | null>(null);

  const [poId, setPoId] = useState("");
  const [receiptDate, setReceiptDate] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<Row[]>([]);

  const po = pos.find((p) => p.id === poId);
  const totalInc = useMemo(() => rows.reduce((s, r) => s + (Number(r.incoming) || 0), 0), [rows]);

  function openDialog() {
    setOpen(true);
    if (!receiptDate) {
      const d = new Date();
      setReceiptDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    }
  }
  function reset() { setPoId(""); setNotes(""); setRows([]); setError(null); setSaved(null); }
  function close() { setOpen(false); reset(); }

  function onSelectPo(id: string) {
    setPoId(id);
    const p = pos.find((x) => x.id === id);
    if (!p) { setRows([]); return; }
    setRows(p.lines.map((l) => ({
      variantId: l.variantId, sku: l.sku, size: l.size, productName: l.productName, qtyPo: l.qtyPo, alreadyGood: l.alreadyGood, unitCost: l.unitCost, incoming: "",
    })));
  }
  function setInc(i: number, val: string) { setRows((p) => p.map((r, idx) => (idx === i ? { ...r, incoming: val } : r))); }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!po) { setError("Pilih PO Produksi dulu."); return; }
    const lines = rows
      .map((r) => ({ variantId: r.variantId, sku: r.sku, size: r.size, productName: r.productName, qtyIncoming: Number(r.incoming) || 0, unitCost: r.unitCost }))
      .filter((l) => l.qtyIncoming > 0);
    if (lines.length === 0) { setError("Isi qty incoming minimal satu baris."); return; }
    startTransition(async () => {
      const res = await createInbound({
        poId: po.id, poCode: po.code, spkId: po.spkId, brandId: po.brandId, supplierId: po.supplierId, receiptDate, notes, lines,
      });
      if (!res.ok) { setError(res.error); return; }
      setSaved({ code: res.code });
      router.refresh();
    });
  }

  return (
    <>
      <Button size="sm" onClick={openDialog}><Plus className="h-4 w-4" /> Inbound Barang</Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-eerie/40 p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-surface p-6 shadow-soft">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-extrabold">{saved ? "Inbound Tersimpan" : "Inbound — Barang Datang"}</h2>
              <button onClick={close} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>

            {saved ? (
              <div className="space-y-5 py-2 text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600"><CheckCircle2 className="h-8 w-8" /></div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Inbound tersimpan — menunggu proses QC</p>
                  <p className="text-2xl font-black tracking-tight">{saved.code}</p>
                </div>
                <p className="text-sm text-muted-foreground">Tahap berikutnya: tim QC klik <b>Proses QC</b> di daftar.</p>
                <div className="flex justify-center gap-2.5">
                  <Button type="button" variant="outline" size="sm" onClick={reset}>Inbound Lagi</Button>
                  <Button type="button" variant="ghost" size="sm" onClick={close}>Selesai</Button>
                </div>
              </div>
            ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className={lbl}>PO Produksi</label>
                  <SearchSelect value={poId} onChange={onSelectPo} placeholder="Cari PO / brand…"
                    inputClassName="h-11 rounded-xl px-3.5 pr-8 font-medium"
                    options={pos.map((p) => ({ value: p.id, label: `${p.code} · ${p.brandName}` }))} />
                </div>
                <div>
                  <label className={lbl}>Tanggal Terima</label>
                  <input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Batch</label>
                  <input value={po ? "otomatis (incoming ke-N)" : "—"} disabled className={inp + " text-muted-foreground"} />
                </div>
              </div>

              <div className="rounded-xl border border-border p-3">
                <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Qty Barang Datang per SKU</p>
                {!po ? (
                  <p className="py-3 text-center text-sm text-muted-foreground">Pilih PO dulu untuk memuat SKU-nya.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs font-bold uppercase text-muted-foreground">
                          <th className="py-1.5 pr-2">SKU</th>
                          <th className="py-1.5 px-1 text-right">Qty PO</th>
                          <th className="py-1.5 px-1 text-right">Sdh Good</th>
                          <th className="py-1.5 px-1 text-right">Incoming</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={r.sku || i} className="border-t border-border/60">
                            <td className="py-1 pr-2"><span className="font-mono text-xs">{r.sku}</span> <span className="text-muted-foreground">{r.size}</span></td>
                            <td className="py-1 px-1 text-right tabular-nums text-muted-foreground">{r.qtyPo}</td>
                            <td className="py-1 px-1 text-right tabular-nums text-muted-foreground">{r.alreadyGood || "—"}</td>
                            <td className="py-1 px-1"><input type="number" value={r.incoming} onChange={(e) => setInc(i, e.target.value)} className={cell} placeholder="0" /></td>
                          </tr>
                        ))}
                        <tr className="border-t border-border bg-muted/40 font-extrabold">
                          <td className="py-1.5" colSpan={3}>Total Incoming</td>
                          <td className="py-1.5 px-1 text-right tabular-nums">{totalInc}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="mt-2 text-xs font-medium text-muted-foreground">Tahap ini hanya mencatat barang datang. Good/Repair/Damage diisi tim QC di tahap berikutnya.</p>
              </div>

              <div>
                <label className={lbl}>Catatan</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-medium outline-none focus:border-primary/40" placeholder="opsional" />
              </div>

              {error && <p className="text-sm font-semibold text-danger">{error}</p>}

              <div className="flex justify-end gap-2.5 pt-1">
                <Button type="button" variant="ghost" size="sm" onClick={close}>Batal</Button>
                <Button type="submit" size="sm" disabled={pending}>{pending ? "Menyimpan…" : "Simpan Inbound"}</Button>
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
const cell = "h-9 w-20 rounded-lg border border-border bg-background px-2 text-right text-sm font-semibold outline-none focus:border-primary/40";
