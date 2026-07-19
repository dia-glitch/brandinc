"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { submitQC } from "./actions";
import type { WarehouseOpt } from "./incoming-form";

export type QCReceiptLine = {
  id: string; variant_id: string | null; sku: string | null; size: string | null;
  qty_incoming: string | number; unit_cost: string | number;
};
export type QCReceipt = { id: string; code: string; brandId: string | null; incomingNo: number; lines: QCReceiptLine[] };

type Row = { lineId: string; variantId: string | null; sku: string; size: string; incoming: number; unitCost: number; good: string; repair: string; damage: string };

export function QCDialog({ receipt, warehouses }: { receipt: QCReceipt; warehouses: WarehouseOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // QC awal (batch 1): hasil = Good / Repair (yang gagal diretur ke vendor).
  // QC setelah repair (batch ≥ 2): hasil = Good / Damage (final, tidak diretur lagi).
  const isInitial = receipt.incomingNo <= 1;
  const goodOpts = useMemo(() => warehouses.filter((w) => w.kind === "finished" && (!w.brandId || w.brandId === receipt.brandId)), [warehouses, receipt.brandId]);
  const damageOpts = useMemo(() => warehouses.filter((w) => w.kind === "damage" && (!w.brandId || w.brandId === receipt.brandId)), [warehouses, receipt.brandId]);

  const [goodWh, setGoodWh] = useState("");
  const [damageWh, setDamageWh] = useState("");
  const [rows, setRows] = useState<Row[]>([]);

  function openDialog() {
    setOpen(true);
    setGoodWh(goodOpts.find((w) => w.brandId === receipt.brandId)?.id ?? goodOpts[0]?.id ?? "");
    setDamageWh(damageOpts.find((w) => w.brandId === receipt.brandId)?.id ?? damageOpts[0]?.id ?? "");
    setRows(receipt.lines.map((l) => ({
      lineId: l.id, variantId: l.variant_id, sku: (l.sku as string) ?? "", size: (l.size as string) ?? "",
      incoming: Number(l.qty_incoming) || 0, unitCost: Number(l.unit_cost) || 0,
      good: "", repair: "", damage: "",
    })));
  }
  function close() { setOpen(false); setError(null); }
  function setRow(i: number, f: "good" | "repair" | "damage", v: string) { setRows((p) => p.map((r, idx) => (idx === i ? { ...r, [f]: v } : r))); }

  const tot = useMemo(() => {
    let g = 0, rest = 0;
    for (const x of rows) { const gd = Math.min(Number(x.good) || 0, x.incoming); g += gd; rest += Math.max(0, x.incoming - gd); }
    return { g, rest };
  }, [rows]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!goodWh) { setError("Pilih gudang barang jadi."); return; }
    const bad = rows.find((r) => (Number(r.good) || 0) > r.incoming);
    if (bad) { setError(`${bad.sku}: Good (${Number(bad.good) || 0}) tidak boleh melebihi Incoming (${bad.incoming}).`); return; }
    // Good diinput; sisanya otomatis: QC1 → Repair (retur vendor), QC2 → Damage (final).
    const lines = rows.map((r) => {
      const good = Number(r.good) || 0;
      const rest = Math.max(0, r.incoming - good);
      return {
        lineId: r.lineId, variantId: r.variantId, sku: r.sku, qtyIncoming: r.incoming,
        qtyGood: good, qtyRepair: isInitial ? rest : 0, qtyDamage: isInitial ? 0 : rest, unitCost: r.unitCost,
      };
    });
    startTransition(async () => {
      const res = await submitQC(receipt.id, goodWh, damageWh || null, lines);
      if (!res.ok) { setError(res.error); return; }
      close(); router.refresh();
    });
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={openDialog} title="Proses QC"><ClipboardCheck className="h-4 w-4" /> Proses QC</Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-eerie/40 p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-surface p-6 text-left shadow-soft">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-extrabold">Proses QC · <span className="font-mono text-base">{receipt.code}</span></h2>
              <button onClick={close} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={lbl}>Gudang Barang Jadi (Good)</label>
                  <select value={goodWh} onChange={(e) => setGoodWh(e.target.value)} className={sel}>
                    <option value="">— auto-buat gudang brand —</option>
                    {goodOpts.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                {!isInitial && (
                  <div>
                    <label className={lbl}>Gudang Damage</label>
                    <select value={damageWh} onChange={(e) => setDamageWh(e.target.value)} className={sel}>
                      <option value="">— auto-buat gudang damage —</option>
                      {damageOpts.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-border p-3">
                <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                  {isInitial ? "QC Awal — isi Good; sisa otomatis jadi Repair (retur vendor)" : "QC Setelah Repair — isi Good; sisa otomatis jadi Damage (final)"}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs font-bold uppercase text-muted-foreground">
                        <th className="py-1.5 pr-2">SKU</th>
                        <th className="py-1.5 px-1 text-right">Incoming</th>
                        <th className="py-1.5 px-1 text-right">Good</th>
                        <th className="py-1.5 px-1 text-right">{isInitial ? "→ Repair" : "Damage"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => {
                        const good = Math.min(Number(r.good) || 0, r.incoming);
                        const rest = Math.max(0, r.incoming - good);
                        const over = (Number(r.good) || 0) > r.incoming;
                        return (
                          <tr key={r.lineId} className="border-t border-border/60">
                            <td className="py-1 pr-2"><span className="font-mono text-xs">{r.sku}</span> <span className="text-muted-foreground">{r.size}</span></td>
                            <td className="py-1 px-1 text-right tabular-nums font-semibold">{r.incoming}</td>
                            <td className="py-1 px-1"><input type="number" value={r.good} onChange={(e) => setRow(i, "good", e.target.value)} className={cell + (over ? " border-danger" : "")} placeholder="0" /></td>
                            <td className={cn("py-1 px-1 text-right tabular-nums font-semibold", isInitial ? "text-amber-600" : "text-danger")}>{rest || "—"}</td>
                          </tr>
                        );
                      })}
                      <tr className="border-t border-border bg-muted/40 font-extrabold">
                        <td className="py-1.5" colSpan={2}>Total</td>
                        <td className="py-1.5 px-1 text-right tabular-nums text-emerald-600">{tot.g}</td>
                        <td className={cn("py-1.5 px-1 text-right tabular-nums", isInitial ? "text-amber-600" : "text-danger")}>{tot.rest}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs font-medium text-muted-foreground">
                  {isInitial ? "Good → gudang jadi. Sisa → Repair, diretur ke vendor; nanti klik Terima Repair saat barang balik." : "Good → gudang jadi. Sisa → Damage → gudang damage. Ini QC final."}
                </p>
              </div>

              {error && <p className="text-sm font-semibold text-danger">{error}</p>}

              <div className="flex justify-end gap-2.5 pt-1">
                <Button type="button" variant="ghost" size="sm" onClick={close}>Batal</Button>
                <Button type="submit" size="sm" disabled={pending}>{pending ? "Memproses…" : "Simpan Hasil QC"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

const lbl = "mb-1.5 block text-sm font-bold";
const sel = "h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none focus:border-primary/40";
const cell = "h-9 w-16 rounded-lg border border-border bg-background px-2 text-right text-sm font-semibold outline-none focus:border-primary/40";
