"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Trash2, CheckCircle2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchSelect } from "@/components/ui/search-select";
import { formatIDR } from "@/lib/utils";
import { createMaterialIssue } from "./actions";

export type SpkOpt = { id: string; code: string; brandId: string; brandName: string };
export type WarehouseOpt = { id: string; name: string };
export type MaterialOpt = { id: string; name: string; code: string | null; unit: string | null; brandId: string | null; avail: number; avg: number };

type Line = { key: string; materialId: string; qty: string };
let seq = 0;
const newKey = () => `l${seq++}`;

export function IssueForm({ spks, warehouses, materials, canEdit = true }: { spks: SpkOpt[]; warehouses: WarehouseOpt[]; materials: MaterialOpt[]; canEdit?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ id: string; code: string } | null>(null);

  const [spkId, setSpkId] = useState("");
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [issueDate, setIssueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ key: newKey(), materialId: "", qty: "" }]);

  const spk = spks.find((s) => s.id === spkId);
  // Hanya material yang PUNYA STOK (avail > 0), difilter per brand SPK.
  const mats = useMemo(
    () => materials.filter((m) => m.avail > 0 && (!spk || !m.brandId || m.brandId === spk.brandId)),
    [materials, spk]
  );
  const matInfo = (id: string) => materials.find((m) => m.id === id);
  const total = useMemo(() => lines.reduce((s, l) => { const m = matInfo(l.materialId); return s + (Number(l.qty) || 0) * (m?.avg ?? 0); }, 0), [lines]);

  function openDialog() {
    setOpen(true);
    if (!issueDate) { const d = new Date(); setIssueDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`); }
  }
  function reset() { setSpkId(""); setNotes(""); setLines([{ key: newKey(), materialId: "", qty: "" }]); setError(null); setSaved(null); }
  function close() { setOpen(false); reset(); }
  function setLine(key: string, f: keyof Line, v: string) { setLines((p) => p.map((l) => (l.key === key ? { ...l, [f]: v } : l))); }
  function addLine() { setLines((p) => [...p, { key: newKey(), materialId: "", qty: "" }]); }
  function removeLine(key: string) { setLines((p) => (p.length > 1 ? p.filter((l) => l.key !== key) : p)); }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!spk) { setError("Pilih SPK dulu."); return; }
    if (!warehouseId) { setError("Pilih gudang bahan."); return; }
    const out = lines.filter((l) => l.materialId && Number(l.qty) > 0).map((l) => {
      const m = matInfo(l.materialId);
      return { materialId: l.materialId, materialName: m?.name ?? "", unit: m?.unit ?? "", qty: Number(l.qty) };
    });
    if (out.length === 0) { setError("Tambah minimal satu bahan (qty > 0)."); return; }
    startTransition(async () => {
      const res = await createMaterialIssue({ spkId: spk.id, spkCode: spk.code, warehouseId, issueDate, notes, lines: out });
      if (!res.ok) { setError(res.error); return; }
      setSaved({ id: res.id, code: res.code }); router.refresh();
    });
  }

  if (!canEdit) return null;

  return (
    <>
      <Button size="sm" onClick={openDialog}><Plus className="h-4 w-4" /> Keluarkan Bahan</Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-eerie/40 p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-surface p-6 shadow-soft">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-extrabold">{saved ? "Material Issue Tersimpan" : "Keluarkan Bahan ke SPK"}</h2>
              <button onClick={close} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>

            {saved ? (
              <div className="space-y-5 py-2 text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600"><CheckCircle2 className="h-8 w-8" /></div>
                <div><p className="text-sm font-medium text-muted-foreground">Bahan berhasil dikeluarkan</p><p className="text-2xl font-black tracking-tight">{saved.code}</p></div>
                <div className="flex justify-center gap-2.5">
                  <a href={`/print/mi/${saved.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-eerie px-5 py-2.5 text-sm font-bold text-white hover:opacity-90"><Printer className="h-4 w-4" /> Detail / Print</a>
                  <Button type="button" variant="outline" size="sm" onClick={reset}>Keluarkan Lagi</Button>
                  <Button type="button" variant="ghost" size="sm" onClick={close}>Selesai</Button>
                </div>
              </div>
            ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className={lbl}>SPK</label>
                  <SearchSelect value={spkId} onChange={setSpkId} placeholder="Cari SPK / brand…"
                    inputClassName="h-11 rounded-xl px-3.5 pr-8 font-medium"
                    options={spks.map((s) => ({ value: s.id, label: `${s.code} · ${s.brandName}` }))} />
                </div>
                <div>
                  <label className={lbl}>Gudang Bahan</label>
                  <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={sel}>
                    <option value="">— Pilih —</option>
                    {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Tanggal</label>
                  <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={inp} />
                </div>
              </div>

              <div className="rounded-xl border border-border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Bahan Keluar (fabric / accessories / consumable)</p>
                  <Button type="button" size="sm" variant="outline" onClick={addLine}><Plus className="h-4 w-4" /> Baris</Button>
                </div>
                {!spk && <p className="mb-2 text-xs font-medium text-muted-foreground">Pilih SPK dulu — bahan mengikuti brand SPK.</p>}
                {spk && mats.length === 0 && <p className="mb-2 text-xs font-semibold text-amber-600">Belum ada bahan yang punya stok untuk brand ini. Terima bahan lewat Purchasing dulu.</p>}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs font-bold uppercase text-muted-foreground">
                        <th className="py-1.5 pr-2">Material</th>
                        <th className="py-1.5 px-1 text-right">Stok</th>
                        <th className="py-1.5 px-1 text-right">Qty Keluar</th>
                        <th className="py-1.5 px-1 text-right">Avg Cost</th>
                        <th className="py-1.5 px-1 text-right">Nilai</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l) => {
                        const m = matInfo(l.materialId);
                        const val = (Number(l.qty) || 0) * (m?.avg ?? 0);
                        return (
                          <tr key={l.key} className="border-t border-border/60">
                            <td className="py-1 pr-2">
                              <SearchSelect className="w-56" value={l.materialId} onChange={(v) => setLine(l.key, "materialId", v)}
                                placeholder="Cari material…"
                                options={mats.map((mm) => ({ value: mm.id, label: `${mm.code ? mm.code + " · " : ""}${mm.name}` }))} />
                            </td>
                            <td className="py-1 px-1 text-right tabular-nums text-muted-foreground">{m ? `${m.avail} ${m.unit ?? ""}` : "—"}</td>
                            <td className="py-1 px-1"><input type="number" value={l.qty} onChange={(e) => setLine(l.key, "qty", e.target.value)} className="h-9 w-20 rounded-lg border border-border bg-background px-2 text-right text-sm font-semibold outline-none focus:border-primary/40" placeholder="0" /></td>
                            <td className="py-1 px-1 text-right tabular-nums text-muted-foreground">{m ? formatIDR(m.avg) : "—"}</td>
                            <td className="py-1 px-1 text-right tabular-nums font-semibold">{formatIDR(val)}</td>
                            <td className="py-1 pl-1"><button type="button" onClick={() => removeLine(l.key)} className="text-muted-foreground hover:text-danger"><Trash2 className="h-4 w-4" /></button></td>
                          </tr>
                        );
                      })}
                      <tr className="border-t border-border bg-muted/40 font-extrabold">
                        <td className="py-1.5" colSpan={4}>Total Nilai Keluar</td>
                        <td className="py-1.5 px-1 text-right tabular-nums">{formatIDR(total)}</td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <label className={lbl}>Catatan</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-medium outline-none focus:border-primary/40" placeholder="opsional" />
              </div>

              {error && <p className="text-sm font-semibold text-danger">{error}</p>}

              <div className="flex justify-end gap-2.5 pt-1">
                <Button type="button" variant="ghost" size="sm" onClick={close}>Batal</Button>
                <Button type="submit" size="sm" disabled={pending}>{pending ? "Menyimpan…" : "Keluarkan Bahan"}</Button>
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
