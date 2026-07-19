"use client";

import { useState, useMemo, useTransition, Fragment } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Trash2, ChevronRight, Upload, FileText, CheckCircle2, Wallet, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchSelect } from "@/components/ui/search-select";
import { cn, formatIDR } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { createCashPurchase, deleteCashPurchase, type Attachment, type CPLineInput } from "./actions";

export type MaterialOpt = { id: string; name: string; code: string | null; unit: string | null };
export type WarehouseOpt = { id: string; name: string };
export type CashAdvanceOpt = { id: string; code: string; payee: string; amount: number; used: number; remaining: number };
export type CPRow = {
  id: string; code: string; caCode: string; vendor: string; notaNo: string; warehouse: string; date: string | null;
  total: number; notes: string; attachments: Attachment[];
  lines: { name: string; unit: string; qty: number; unitPrice: number }[];
};

async function uploadFile(file: File): Promise<Attachment | null> {
  try {
    const supabase = createClient();
    const ext = (file.name.split(".").pop() || "bin").toLowerCase();
    const path = `nota/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("payment-docs").upload(path, file, { upsert: false });
    if (error) return null;
    const { data } = supabase.storage.from("payment-docs").getPublicUrl(path);
    return { name: file.name, url: data.publicUrl, kind: "nota" };
  } catch { return null; }
}

export function CPView({ rows, materials, warehouses, cashAdvances }: { rows: CPRow[]; materials: MaterialOpt[]; warehouses: WarehouseOpt[]; cashAdvances: CashAdvanceOpt[] }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const query = q.trim().toLowerCase();
  const list = rows.filter((r) => !query || r.code.toLowerCase().includes(query) || (r.vendor ?? "").toLowerCase().includes(query) || (r.caCode ?? "").toLowerCase().includes(query));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Raw Material</p>
          <h1 className="text-2xl font-extrabold">Pembelian Tunai</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">Beli bahan tunai pakai dana Cash Advance (nota). Material masuk stok &amp; update harga rata-rata, tanpa masuk Hutang. Nilainya otomatis jadi realisasi saat settlement cash advance.</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)} disabled={cashAdvances.length === 0}><Plus className="h-4 w-4" /> Catat Pembelian</Button>
      </div>

      {cashAdvances.length === 0 && (
        <div className="card flex items-center gap-2 border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-700">
          <Wallet className="h-4 w-4" /> Belum ada Cash Advance yang sudah dibayar &amp; belum di-settle. Buat &amp; bayar Cash Advance dulu di Finance → Payment Request.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari kode / vendor / CA…" className="h-11 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm font-medium outline-none focus:border-primary/40" />
        </div>
        <span className="text-sm font-medium text-muted-foreground">{list.length} nota</span>
      </div>

      {list.length === 0 ? (
        <div className="card p-10 text-center text-sm font-medium text-muted-foreground">Belum ada pembelian tunai.</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <th className="w-8 py-2.5 pl-4"></th>
                <th className="py-2.5 pr-3">Kode</th>
                <th className="py-2.5 pr-3">Cash Advance</th>
                <th className="py-2.5 pr-3">Vendor / Nota</th>
                <th className="py-2.5 pr-3">Gudang</th>
                <th className="py-2.5 pr-3">Tgl</th>
                <th className="py-2.5 pr-3 text-right">Total</th>
                <th className="py-2.5 pr-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => <CPRowItem key={r.id} row={r} />)}
            </tbody>
          </table>
        </div>
      )}

      {open && <CPForm materials={materials} warehouses={warehouses} cashAdvances={cashAdvances} onClose={() => setOpen(false)} />}
    </div>
  );
}

function CPRowItem({ row }: { row: CPRow }) {
  const router = useRouter();
  const [openRow, setOpenRow] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <Fragment>
      <tr className="border-t border-border font-semibold hover:bg-muted/40">
        <td className="py-2.5 pl-4"><button onClick={() => setOpenRow((o) => !o)} className="grid h-6 w-6 place-items-center rounded-lg hover:bg-muted"><ChevronRight className={cn("h-4 w-4 transition-transform", openRow && "rotate-90")} /></button></td>
        <td className="py-2.5 pr-3 font-mono text-xs">{row.code}</td>
        <td className="py-2.5 pr-3"><Badge tone="accent">{row.caCode}</Badge></td>
        <td className="py-2.5 pr-3">{row.vendor || "—"}{row.notaNo && <span className="ml-1.5 text-xs font-medium text-muted-foreground">nota {row.notaNo}</span>}</td>
        <td className="py-2.5 pr-3 font-medium text-muted-foreground">{row.warehouse}</td>
        <td className="py-2.5 pr-3 font-medium text-muted-foreground">{row.date ?? "—"}</td>
        <td className="py-2.5 pr-3 text-right tabular-nums">{formatIDR(row.total)}</td>
        <td className="py-2.5 pr-4 text-right">
          <DelBtn pending={pending} onDel={() => startTransition(async () => { await deleteCashPurchase(row.id); router.refresh(); })} />
        </td>
      </tr>
      {openRow && (
        <tr className="bg-muted/20">
          <td colSpan={8} className="px-5 py-3">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs font-bold uppercase text-muted-foreground"><th className="py-1.5 pr-3">Material</th><th className="py-1.5 px-2 text-right">Qty</th><th className="py-1.5 px-2 text-right">Harga</th><th className="py-1.5 px-2 text-right">Nilai</th></tr></thead>
                <tbody>
                  {row.lines.map((l, i) => (
                    <tr key={i} className="border-t border-border/60 font-semibold">
                      <td className="py-1.5 pr-3">{l.name}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">{l.qty} {l.unit}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums text-muted-foreground">{formatIDR(l.unitPrice)}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">{formatIDR(l.qty * l.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {row.notes && <p className="mt-2 text-sm text-muted-foreground">Catatan: {row.notes}</p>}
            {row.attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {row.attachments.map((a, i) => <a key={i} href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-bold hover:bg-muted"><FileText className="h-3.5 w-3.5" /> {a.name || "nota"}</a>)}
              </div>
            )}
          </td>
        </tr>
      )}
    </Fragment>
  );
}

function DelBtn({ onDel, pending }: { onDel: () => void; pending: boolean }) {
  const [c, setC] = useState(false);
  if (c) return <Button size="sm" variant="danger" disabled={pending} onClick={onDel}>Yakin?</Button>;
  return <Button size="sm" variant="ghost" onClick={() => setC(true)}><Trash2 className="h-4 w-4" /> Hapus</Button>;
}

type Line = { key: string; materialId: string; qty: string; unitPrice: string };
let seq = 0;
const newKey = () => `cl${seq++}`;

function CPForm({ materials, warehouses, cashAdvances, onClose }: { materials: MaterialOpt[]; warehouses: WarehouseOpt[]; cashAdvances: CashAdvanceOpt[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const [prId, setPrId] = useState(cashAdvances[0]?.id ?? "");
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [vendor, setVendor] = useState("");
  const [notaNo, setNotaNo] = useState("");
  const [date, setDate] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [lines, setLines] = useState<Line[]>([{ key: newKey(), materialId: "", qty: "", unitPrice: "" }]);

  const ca = cashAdvances.find((c) => c.id === prId);
  const matInfo = (id: string) => materials.find((m) => m.id === id);
  const total = useMemo(() => lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0), [lines]);
  const overCA = ca ? total > ca.remaining + 0.0001 : false;

  function reset() {
    setPrId(cashAdvances[0]?.id ?? ""); setVendor(""); setNotaNo(""); setNotes(""); setFiles([]);
    setLines([{ key: newKey(), materialId: "", qty: "", unitPrice: "" }]); setError(null); setSaved(null);
  }
  function setLine(key: string, f: keyof Line, v: string) { setLines((p) => p.map((l) => (l.key === key ? { ...l, [f]: v } : l))); }
  function addLine() { setLines((p) => [...p, { key: newKey(), materialId: "", qty: "", unitPrice: "" }]); }
  function removeLine(key: string) { setLines((p) => (p.length > 1 ? p.filter((l) => l.key !== key) : p)); }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return; setUploading(true); setError(null);
    const att = await uploadFile(f);
    if (!att) setError("Gagal upload nota. Pastikan bucket 'payment-docs' sudah dibuat.");
    else setFiles((p) => [...p, att]);
    setUploading(false);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    const out: CPLineInput[] = lines.filter((l) => l.materialId && Number(l.qty) > 0).map((l) => {
      const m = matInfo(l.materialId);
      return { materialId: l.materialId, materialName: m?.name ?? "", unit: m?.unit ?? "", qty: Number(l.qty), unitPrice: Number(l.unitPrice) || 0 };
    });
    if (out.length === 0) { setError("Tambah minimal satu material (qty > 0)."); return; }
    startTransition(async () => {
      const res = await createCashPurchase({ prId, purchaseDate: date, vendor, notaNo, warehouseId, notes, attachments: files, lines: out });
      if (!res.ok) { setError(res.error); return; }
      setSaved(res.code); router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-eerie/40 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-surface p-6 shadow-soft">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-extrabold">{saved ? "Pembelian Tersimpan" : "Catat Pembelian Tunai"}</h2><button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button></div>

        {saved ? (
          <div className="space-y-5 py-2 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600"><CheckCircle2 className="h-8 w-8" /></div>
            <div><p className="text-sm font-medium text-muted-foreground">Material masuk stok &amp; harga rata-rata diperbarui</p><p className="text-2xl font-black tracking-tight">{saved}</p></div>
            <div className="flex justify-center gap-2.5"><Button type="button" variant="outline" size="sm" onClick={reset}>Catat Lagi</Button><Button type="button" variant="ghost" size="sm" onClick={onClose}>Selesai</Button></div>
          </div>
        ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={lbl}>Cash Advance (sumber dana)</label>
              <SearchSelect value={prId} onChange={setPrId} placeholder="Cari CA…" inputClassName="h-11 rounded-xl px-3.5 pr-8 font-medium"
                options={cashAdvances.map((c) => ({ value: c.id, label: `${c.code}${c.payee ? " · " + c.payee : ""}`, hint: `sisa ${formatIDR(c.remaining)}` }))} />
              {ca && <p className="mt-1 text-xs font-semibold text-muted-foreground">Sisa dana CA: <b className={overCA ? "text-danger" : "text-emerald-700"}>{formatIDR(ca.remaining)}</b></p>}
            </div>
            <div><label className={lbl}>Gudang</label><select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={sel}><option value="">— Pilih —</option>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div><label className={lbl}>Vendor / Toko</label><input value={vendor} onChange={(e) => setVendor(e.target.value)} className={inp} placeholder="mis. Toko Kain Jaya" /></div>
            <div><label className={lbl}>No. Nota</label><input value={notaNo} onChange={(e) => setNotaNo(e.target.value)} className={inp} placeholder="opsional" /></div>
            <div><label className={lbl}>Tanggal</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inp} /></div>
          </div>

          <div className="rounded-xl border border-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Material di Nota</p>
              <Button type="button" size="sm" variant="outline" onClick={addLine}><Plus className="h-4 w-4" /> Baris</Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs font-bold uppercase text-muted-foreground"><th className="py-1.5 pr-2">Material</th><th className="py-1.5 px-1 text-right">Qty</th><th className="py-1.5 px-1 text-right">Harga</th><th className="py-1.5 px-1 text-right">Nilai</th><th></th></tr></thead>
                <tbody>
                  {lines.map((l) => {
                    const m = matInfo(l.materialId);
                    const val = (Number(l.qty) || 0) * (Number(l.unitPrice) || 0);
                    return (
                      <tr key={l.key} className="border-t border-border/60">
                        <td className="py-1 pr-2"><SearchSelect className="w-56" value={l.materialId} onChange={(v) => setLine(l.key, "materialId", v)} placeholder="Cari material…" options={materials.map((mm) => ({ value: mm.id, label: `${mm.code ? mm.code + " · " : ""}${mm.name}`, hint: mm.unit ?? "" }))} /></td>
                        <td className="py-1 px-1"><input type="number" step="any" value={l.qty} onChange={(e) => setLine(l.key, "qty", e.target.value)} className="h-9 w-20 rounded-lg border border-border bg-background px-2 text-right text-sm font-semibold outline-none focus:border-primary/40" placeholder="0" /></td>
                        <td className="py-1 px-1"><input type="number" step="any" value={l.unitPrice} onChange={(e) => setLine(l.key, "unitPrice", e.target.value)} className="h-9 w-28 rounded-lg border border-border bg-background px-2 text-right text-sm font-semibold outline-none focus:border-primary/40" placeholder="0" /></td>
                        <td className="py-1 px-1 text-right tabular-nums font-semibold">{formatIDR(val)}</td>
                        <td className="py-1 pl-1"><button type="button" onClick={() => removeLine(l.key)} className="text-muted-foreground hover:text-danger"><Trash2 className="h-4 w-4" /></button></td>
                      </tr>
                    );
                  })}
                  <tr className="border-t border-border bg-muted/40 font-extrabold"><td className="py-1.5" colSpan={3}>Total Nota</td><td className="py-1.5 px-1 text-right tabular-nums">{formatIDR(total)}</td><td></td></tr>
                </tbody>
              </table>
            </div>
            {overCA && <p className="mt-2 text-xs font-semibold text-danger">Total nota melebihi sisa dana CA. Kelebihan nanti jadi reimbursement saat settlement.</p>}
          </div>

          <div>
            <label className={lbl}>Foto Nota</label>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-bold hover:bg-muted"><Upload className="h-4 w-4" /> {uploading ? "Mengunggah…" : "Upload Nota"}<input type="file" className="hidden" onChange={onFile} disabled={uploading} /></label>
            {files.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{files.map((f, i) => <span key={i} className="inline-flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1 text-xs font-semibold"><FileText className="h-3.5 w-3.5" /> {f.name}</span>)}</div>}
          </div>
          <div><label className={lbl}>Catatan</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-medium outline-none focus:border-primary/40" placeholder="opsional" /></div>

          {error && <p className="text-sm font-semibold text-danger">{error}</p>}
          <div className="flex justify-end gap-2.5 pt-1"><Button type="button" variant="ghost" size="sm" onClick={onClose}>Batal</Button><Button type="submit" size="sm" disabled={pending || uploading}>{pending ? "Menyimpan…" : "Simpan & Masukkan Stok"}</Button></div>
        </form>
        )}
      </div>
    </div>
  );
}

const lbl = "mb-1.5 block text-sm font-bold";
const inp = "h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm font-medium outline-none focus:border-primary/40";
const sel = inp + " px-3";
