"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { receiveRepair } from "./actions";

export type RepairLineOpt = { sku: string; size: string; qtyRepair: number };
export type RepairReceipt = { id: string; code: string; lines: RepairLineOpt[] };

export function RepairDialog({ receipt }: { receipt: RepairReceipt }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [balik, setBalik] = useState<Record<string, string>>({});

  const repairLines = receipt.lines.filter((l) => l.qtyRepair > 0);

  function openDialog() {
    setOpen(true);
    setBalik(Object.fromEntries(repairLines.map((l) => [l.sku, String(l.qtyRepair)])));
  }
  function close() { setOpen(false); setError(null); }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const lines = repairLines.map((l) => {
      const b = Math.min(Number(balik[l.sku]) || 0, l.qtyRepair);
      return { sku: l.sku, qtyBalik: b };
    });
    if (lines.every((l) => l.qtyBalik <= 0)) { setError("Isi qty balik minimal satu SKU."); return; }
    startTransition(async () => {
      const res = await receiveRepair(receipt.id, lines);
      if (!res.ok) { setError(res.error); return; }
      close(); router.refresh();
    });
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={openDialog} title="Barang repair kembali dari vendor">
        <RotateCcw className="h-4 w-4" /> Terima Repair
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-eerie/40 p-4">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-6 text-left shadow-soft">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-extrabold">Terima Repair · <span className="font-mono text-base">{receipt.code}</span></h2>
              <button onClick={close} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <p className="text-sm font-medium text-muted-foreground">Isi jumlah yang benar-benar kembali dari vendor. Yang tidak kembali otomatis jadi <b>Not Returned</b>.</p>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-bold uppercase text-muted-foreground">
                      <th className="px-3 py-2">SKU</th>
                      <th className="px-3 py-2 text-right">Diretur</th>
                      <th className="px-3 py-2 text-right">Qty Balik</th>
                    </tr>
                  </thead>
                  <tbody>
                    {repairLines.map((l) => (
                      <tr key={l.sku} className="border-t border-border/60 font-semibold">
                        <td className="px-3 py-2"><span className="font-mono text-xs">{l.sku}</span> <span className="text-muted-foreground">{l.size}</span></td>
                        <td className="px-3 py-2 text-right tabular-nums text-amber-600">{l.qtyRepair}</td>
                        <td className="px-3 py-2 text-right">
                          <input type="number" value={balik[l.sku] ?? ""} onChange={(e) => setBalik((p) => ({ ...p, [l.sku]: e.target.value }))}
                            className="h-9 w-20 rounded-lg border border-border bg-background px-2 text-right text-sm font-semibold outline-none focus:border-primary/40" placeholder="0" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs font-medium text-muted-foreground">Barang balik akan jadi batch incoming baru → di-QC ulang (Good / Damage).</p>

              {error && <p className="text-sm font-semibold text-danger">{error}</p>}

              <div className="flex justify-end gap-2.5 pt-1">
                <Button type="button" variant="ghost" size="sm" onClick={close}>Batal</Button>
                <Button type="submit" size="sm" disabled={pending}>{pending ? "Memproses…" : "Buat Batch Balik"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
