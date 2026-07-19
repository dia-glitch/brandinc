"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { receiveMaterial } from "./actions";

export type MaterialOpt = { id: string; name: string; unit: string | null };
export type WarehouseOpt = { id: string; name: string };

export function ReceiveDialog({ materials, warehouses }: { materials: MaterialOpt[]; warehouses: WarehouseOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [materialId, setMaterialId] = useState("");
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [qty, setQty] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");

  const material = materials.find((m) => m.id === materialId);

  function openDialog() {
    setOpen(true);
    setWarehouseId(warehouses[0]?.id ?? "");
    if (!date) {
      const d = new Date();
      setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    }
  }
  function close() {
    setOpen(false); setMaterialId(""); setQty(""); setUnitCost(""); setNotes(""); setError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await receiveMaterial({
        materialId, warehouseId, qty: Number(qty) || 0, unitCost: Number(unitCost) || 0, date, notes,
      });
      if (!res.ok) { setError(res.error); return; }
      close(); router.refresh();
    });
  }

  const total = (Number(qty) || 0) * (Number(unitCost) || 0);

  return (
    <>
      <Button size="sm" onClick={openDialog}><Plus className="h-4 w-4" /> Terima Bahan</Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-eerie/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-soft">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-extrabold">Terima Bahan</h2>
              <button onClick={close} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className={lbl}>Material</label>
                <select value={materialId} onChange={(e) => setMaterialId(e.target.value)} className={inp + " px-3"} required>
                  <option value="">— Pilih Material —</option>
                  {materials.map((m) => <option key={m.id} value={m.id}>{m.name}{m.unit ? ` (${m.unit})` : ""}</option>)}
                </select>
              </div>

              <div>
                <label className={lbl}>Gudang</label>
                <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={inp + " px-3"}>
                  {warehouses.length === 0 && <option value="">(belum ada gudang)</option>}
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Qty {material?.unit ? `(${material.unit})` : ""}</label>
                  <input type="number" step="any" value={qty} onChange={(e) => setQty(e.target.value)} className={inp} placeholder="mis. 100" />
                </div>
                <div>
                  <label className={lbl}>Harga / satuan</label>
                  <input type="number" step="any" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className={inp} placeholder="mis. 25000" />
                </div>
              </div>

              <div>
                <label className={lbl}>Tanggal</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inp} />
              </div>

              <div>
                <label className={lbl}>Catatan <span className="font-medium text-muted-foreground">(opsional)</span></label>
                <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inp} placeholder="mis. no. surat jalan / PO" />
              </div>

              <div className="rounded-xl border border-border bg-muted/40 p-2.5 text-sm">
                <span className="font-semibold text-muted-foreground">Total nilai:</span> <b>Rp {new Intl.NumberFormat("id-ID").format(Math.round(total))}</b>
              </div>

              {error && <p className="text-sm font-semibold text-danger">{error}</p>}

              <div className="flex justify-end gap-2.5 pt-1">
                <Button type="button" variant="ghost" size="sm" onClick={close}>Batal</Button>
                <Button type="submit" size="sm" disabled={pending}>{pending ? "Menyimpan…" : "Simpan"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

const lbl = "mb-1.5 block text-sm font-bold";
const inp = "h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm font-medium outline-none focus:border-primary/40";
