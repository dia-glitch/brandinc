"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Trash2, Printer, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchSelect } from "@/components/ui/search-select";
import { formatIDR } from "@/lib/utils";
import { createPO } from "./actions";

export type BrandOpt = { id: string; name: string; code: string };
export type SupplierOpt = { id: string; name: string; is_taxable: boolean };
export type MaterialOpt = { id: string; name: string; code: string | null; unit: string | null; brand_id: string | null };

type Line = { key: string; materialId: string; qty: string; unitPrice: string };

let seq = 0;
const newKey = () => `l${seq++}`;

export function POForm({ brands, suppliers, materials }: { brands: BrandOpt[]; suppliers: SupplierOpt[]; materials: MaterialOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ id: string; code: string } | null>(null);

  const [brandId, setBrandId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [poDate, setPoDate] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ key: newKey(), materialId: "", qty: "", unitPrice: "" }]);

  const brand = brands.find((b) => b.id === brandId);
  // Bahan hanya dari brand terpilih (brand kosong = pakai lintas brand tetap ditampilkan agar tidak buntu).
  const brandMaterials = useMemo(
    () => materials.filter((m) => !brandId || m.brand_id === brandId),
    [materials, brandId]
  );
  const matInfo = (id: string) => materials.find((m) => m.id === id);

  const supplier = suppliers.find((s) => s.id === supplierId);
  const isPKP = Boolean(supplier?.is_taxable);
  const ppnPercent = isPKP ? 11 : 0;

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0),
    [lines]
  );
  const ppnAmount = subtotal * (ppnPercent / 100);
  const total = subtotal + ppnAmount;

  function openDialog() {
    setOpen(true);
    if (!poDate) {
      const d = new Date();
      setPoDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    }
  }
  function reset() {
    setBrandId(""); setSupplierId(""); setExpectedDate(""); setNotes("");
    setLines([{ key: newKey(), materialId: "", qty: "", unitPrice: "" }]); setError(null); setSaved(null);
  }
  function close() { setOpen(false); reset(); }

  function setLine(key: string, field: keyof Line, val: string) {
    setLines((p) => p.map((l) => (l.key === key ? { ...l, [field]: val } : l)));
  }
  function addLine() { setLines((p) => [...p, { key: newKey(), materialId: "", qty: "", unitPrice: "" }]); }
  function removeLine(key: string) { setLines((p) => (p.length > 1 ? p.filter((l) => l.key !== key) : p)); }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!brand) { setError("Pilih brand."); return; }
    const out = lines
      .filter((l) => l.materialId && Number(l.qty) > 0)
      .map((l) => {
        const info = matInfo(l.materialId);
        return {
          materialId: l.materialId,
          materialName: info?.name ?? "",
          unit: info?.unit ?? "",
          qty: Number(l.qty),
          unitPrice: Number(l.unitPrice) || 0,
        };
      });
    if (out.length === 0) { setError("Tambah minimal satu baris material dengan qty > 0."); return; }
    startTransition(async () => {
      const res = await createPO({
        brandId: brand.id, brandCode: brand.code, supplierId: supplierId || null,
        poDate, expectedDate, notes, ppnPercent, lines: out,
      });
      if (!res.ok) { setError(res.error); return; }
      setSaved({ id: res.id, code: res.code });
      router.refresh();
    });
  }

  const previewCode = brand ? `PO-${brand.code.toUpperCase()}-###` : "—";

  return (
    <>
      <Button size="sm" onClick={openDialog}><Plus className="h-4 w-4" /> Buat PO</Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-eerie/40 p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-surface p-6 shadow-soft">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-extrabold">{saved ? "PO Tersimpan" : "Buat Purchase Order"}</h2>
              <button onClick={close} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>

            {saved ? (
              <div className="space-y-5 py-2 text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Purchase Order berhasil dibuat</p>
                  <p className="text-2xl font-black tracking-tight">{saved.code}</p>
                </div>
                <div className="flex justify-center gap-2.5">
                  <a href={`/print/po/${saved.id}`} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-eerie px-5 py-2.5 text-sm font-bold text-white hover:opacity-90">
                    <Printer className="h-4 w-4" /> Detail / Print
                  </a>
                  <Button type="button" variant="outline" size="sm" onClick={reset}>Buat PO Lagi</Button>
                  <Button type="button" variant="ghost" size="sm" onClick={close}>Selesai</Button>
                </div>
              </div>
            ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Brand</label>
                  <select value={brandId} onChange={(e) => { setBrandId(e.target.value); }} className={sel}>
                    <option value="">— Pilih —</option>
                    {brands.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Supplier</label>
                  <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={sel}>
                    <option value="">— Pilih —</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Tanggal PO</label>
                  <input type="date" value={poDate} onChange={(e) => setPoDate(e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Perkiraan Datang</label>
                  <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className={inp} />
                </div>
              </div>

              <div className="rounded-xl border border-border bg-muted/40 p-2.5 text-sm">
                <span className="font-semibold text-muted-foreground">Kode PO:</span> <b className="font-mono">{previewCode}</b>
              </div>

              {/* Baris material */}
              <div className="rounded-xl border border-border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Item Bahan</p>
                  <Button type="button" size="sm" variant="outline" onClick={addLine}><Plus className="h-4 w-4" /> Baris</Button>
                </div>
                {!brandId && <p className="mb-2 text-xs font-medium text-muted-foreground">Pilih brand dulu — daftar bahan mengikuti brand.</p>}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs font-bold uppercase text-muted-foreground">
                        <th className="py-1.5 pr-2">Material</th>
                        <th className="py-1.5 px-1 text-right">Qty</th>
                        <th className="py-1.5 px-1">Satuan</th>
                        <th className="py-1.5 px-1 text-right">Harga</th>
                        <th className="py-1.5 px-1 text-right">Subtotal</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l) => {
                        const info = matInfo(l.materialId);
                        const sub = (Number(l.qty) || 0) * (Number(l.unitPrice) || 0);
                        return (
                          <tr key={l.key} className="border-t border-border/60">
                            <td className="py-1 pr-2">
                              <SearchSelect className="w-52" value={l.materialId} onChange={(v) => setLine(l.key, "materialId", v)}
                                placeholder="Cari material…"
                                options={brandMaterials.map((m) => ({ value: m.id, label: `${m.code ? m.code + " · " : ""}${m.name}` }))} />
                            </td>
                            <td className="py-1 px-1">
                              <input type="number" value={l.qty} onChange={(e) => setLine(l.key, "qty", e.target.value)}
                                className="h-9 w-20 rounded-lg border border-border bg-background px-2 text-right text-sm font-semibold outline-none focus:border-primary/40" placeholder="0" />
                            </td>
                            <td className="py-1 px-1 text-xs font-medium text-muted-foreground">{info?.unit ?? "—"}</td>
                            <td className="py-1 px-1">
                              <input type="number" value={l.unitPrice} onChange={(e) => setLine(l.key, "unitPrice", e.target.value)}
                                className="h-9 w-28 rounded-lg border border-border bg-background px-2 text-right text-sm font-semibold outline-none focus:border-primary/40" placeholder="0" />
                            </td>
                            <td className="py-1 px-1 text-right text-sm font-semibold tabular-nums">{formatIDR(sub)}</td>
                            <td className="py-1 pl-1">
                              <button type="button" onClick={() => removeLine(l.key)} className="text-muted-foreground hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="border-t border-border font-semibold text-muted-foreground">
                        <td className="py-1.5" colSpan={4}>Subtotal</td>
                        <td className="py-1.5 px-1 text-right tabular-nums">{formatIDR(subtotal)}</td>
                        <td></td>
                      </tr>
                      <tr className="font-semibold text-muted-foreground">
                        <td className="py-1.5" colSpan={4}>
                          PPN {ppnPercent}% {isPKP ? <span className="text-xs font-bold text-emerald-600">· supplier PKP</span> : <span className="text-xs font-medium">· supplier non-PKP</span>}
                        </td>
                        <td className="py-1.5 px-1 text-right tabular-nums">{formatIDR(ppnAmount)}</td>
                        <td></td>
                      </tr>
                      <tr className="border-t border-border bg-muted/40 font-extrabold">
                        <td className="py-1.5" colSpan={4}>Total</td>
                        <td className="py-1.5 px-1 text-right tabular-nums">{formatIDR(total)}</td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <label className={lbl}>Catatan</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-medium outline-none focus:border-primary/40"
                  placeholder="catatan untuk supplier / internal (opsional)" />
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
