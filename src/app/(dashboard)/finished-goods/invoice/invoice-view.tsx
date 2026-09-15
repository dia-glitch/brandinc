"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, FileDown, Search, Upload, Paperclip, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formatIDR } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { createInvoiceReference } from "../incoming/actions";

export type InvLine = { sku: string; size: string; product: string; good: number; price: number };
export type InvDoc = { name: string; url: string };
export type InvRow = {
  id: string; code: string; poCode: string; product: string; brand: string; brandId: string | null;
  supplier: string; date: string | null; good: number; value: number;
  invoiceNo: string | null; invoiceDate: string | null; invoiceDue: string | null;
  supplierInvoiceNo: string | null; docs: InvDoc[]; lines: InvLine[];
};

const todayStr = () => new Date().toISOString().slice(0, 10);
const plusDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

async function uploadDoc(file: File): Promise<InvDoc | null> {
  try {
    const supabase = createClient();
    const ext = (file.name.split(".").pop() || "bin").toLowerCase();
    const path = `invref/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("payment-docs").upload(path, file, { upsert: false });
    if (error) return null;
    const { data } = supabase.storage.from("payment-docs").getPublicUrl(path);
    return { name: file.name, url: data.publicUrl };
  } catch { return null; }
}

export function InvoiceView({ rows, canInvoice }: { rows: InvRow[]; canInvoice: boolean }) {
  const [tab, setTab] = useState<"pending" | "log">("pending");
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState("");
  const [form, setForm] = useState<InvRow | null>(null);

  const brandOpts = useMemo(() => Array.from(new Set(rows.map((r) => r.brand))).filter((b) => b && b !== "—").sort(), [rows]);
  const query = q.trim().toLowerCase();
  const match = (r: InvRow) => (!brand || r.brand === brand) && (!query || (r.poCode + " " + r.code + " " + r.product + " " + r.supplier + " " + (r.invoiceNo ?? "") + " " + (r.supplierInvoiceNo ?? "")).toLowerCase().includes(query));

  const pending = rows.filter((r) => !r.invoiceNo && r.good > 0).filter(match);
  const log = rows.filter((r) => r.invoiceNo).filter(match);

  const stat = useMemo(() => {
    const notInv = rows.filter((r) => !r.invoiceNo && r.good > 0);
    return {
      total: rows.filter((r) => r.good > 0 || r.invoiceNo).length,
      pending: notInv.length,
      done: rows.filter((r) => r.invoiceNo).length,
      pendingValue: notInv.reduce((s, r) => s + r.value, 0),
    };
  }, [rows]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Finished Goods</p>
        <h1 className="text-2xl font-extrabold">Invoice Reference</h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          Referensi penagihan ke supplier — <b>invoice asli/resmi tetap terbit dari supplier</b> dan diunggah sebagai lampiran.
          Sumbernya tiap receiving yang sudah QC &amp; ada Good. Setelah dibuat, ikut ke <b>Finance → Hutang (AP)</b>.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card label="Receipt QC" value={String(stat.total)} />
        <Card label="Belum Di-invoice" value={String(stat.pending)} tone={stat.pending ? "warn" : undefined} />
        <Card label="Sudah Di-invoice" value={String(stat.done)} />
        <Card label="Nilai Belum Di-invoice" value={formatIDR(stat.pendingValue)} tone={stat.pendingValue ? "danger" : undefined} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          <button onClick={() => setTab("pending")} data-active={tab === "pending"} className="pill">Belum di-invoice ({pending.length})</button>
          <button onClick={() => setTab("log")} data-active={tab === "log"} className="pill">Log ({log.length})</button>
        </div>
        <div className="relative ml-auto w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari PO / invoice / supplier…" className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm font-medium outline-none focus:border-primary/40" />
        </div>
        <select value={brand} onChange={(e) => setBrand(e.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none focus:border-primary/40">
          <option value="">Semua Brand</option>
          {brandOpts.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>

      {tab === "pending" ? (
        pending.length === 0 ? (
          <div className="card p-10 text-center text-sm font-medium text-muted-foreground">Tidak ada receiving yang menunggu invoice reference.</div>
        ) : (
          <div className="space-y-2">
            {pending.map((r) => (
              <div key={r.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-bold">{r.poCode}</span>
                    <span className="font-mono text-xs text-muted-foreground">{r.code}</span>
                    <Badge tone="accent">{r.good} pcs Good</Badge>
                  </div>
                  <p className="mt-1 text-sm font-bold">{r.product} <span className="font-medium text-muted-foreground">· {r.brand} · {r.supplier}</span></p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-lg font-extrabold tabular-nums">{formatIDR(r.value)}</span>
                  {canInvoice ? <Button size="sm" onClick={() => setForm(r)}><FileDown className="h-4 w-4" /> Buat Reference</Button> : <span className="text-xs font-semibold text-muted-foreground">Menunggu Finance/QC</span>}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        log.length === 0 ? (
          <div className="card p-10 text-center text-sm font-medium text-muted-foreground">Belum ada invoice reference.</div>
        ) : (
          <div className="card overflow-x-auto p-0">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">No. Referensi</th>
                  <th className="px-4 py-3">Inv. Supplier</th>
                  <th className="px-4 py-3">PO</th>
                  <th className="px-4 py-3">Produk</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Jatuh Tempo</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Lampiran</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {log.map((r) => (
                  <tr key={r.id} className="border-t border-border font-semibold">
                    <td className="px-4 py-3 font-mono text-xs text-emerald-600">{r.invoiceNo}</td>
                    <td className="px-4 py-3 font-mono text-xs">{r.supplierInvoiceNo ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.poCode}</td>
                    <td className="px-4 py-3">{r.product}</td>
                    <td className="px-4 py-3 font-medium text-muted-foreground">{r.supplier}</td>
                    <td className="px-4 py-3 font-medium text-muted-foreground">{r.invoiceDue ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatIDR(r.value)}</td>
                    <td className="px-4 py-3">{r.docs.length > 0 ? <span className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground"><Paperclip className="h-3.5 w-3.5" /> {r.docs.length}</span> : <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {canInvoice && <button onClick={() => setForm(r)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold hover:bg-muted"><Upload className="h-3.5 w-3.5" /> {r.supplierInvoiceNo || r.docs.length ? "Edit" : "Lengkapi"}</button>}
                        <a href={`/print/grninvoice/${r.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold hover:bg-muted"><FileText className="h-4 w-4" /> Lihat</a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {form && <RefModal row={form} onClose={() => setForm(null)} />}
    </div>
  );
}

function RefModal({ row, onClose }: { row: InvRow; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [supInv, setSupInv] = useState(row.supplierInvoiceNo ?? "");
  const [date, setDate] = useState(row.invoiceDate ?? todayStr());
  const [due, setDue] = useState(row.invoiceDue ?? plusDays(14));
  const [note, setNote] = useState("");
  const [docs, setDocs] = useState<InvDoc[]>(row.docs ?? []);
  const [uploading, setUploading] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.currentTarget.value = ""; if (!f) return;
    setUploading(true); setErr(null);
    const d = await uploadDoc(f);
    if (!d) setErr("Gagal upload. Pastikan bucket 'payment-docs' sudah dibuat di Supabase.");
    else setDocs((p) => [...p, d]);
    setUploading(false);
  }

  function submit() {
    setErr(null);
    start(async () => {
      const r = await createInvoiceReference({ receiptId: row.id, supplierInvoiceNo: supInv, invoiceDate: date, invoiceDue: due, note, docs });
      if (!r.ok) { setErr(r.error); return; }
      window.open(`/print/grninvoice/${row.id}`, "_blank");
      onClose(); router.refresh();
    });
  }

  const subtotal = row.lines.reduce((s, l) => s + l.good * l.price, 0);

  return (
    <Modal size="lg" onClose={onClose} title="Buat Invoice Reference" subtitle={`${row.poCode} · ${row.code} · ${row.supplier}`}
      footer={<>
        <Button variant="ghost" size="sm" onClick={onClose}>Batal</Button>
        <Button size="sm" disabled={pending || uploading} onClick={submit}>{pending ? "Menyimpan…" : "Simpan & Cetak"}</Button>
      </>}>
      <div className="rounded-xl bg-muted/40 p-3 text-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Referensi penagihan</p>
        <p className="mt-0.5 font-medium text-muted-foreground">Invoice <b>asli</b> tetap dari supplier — isi nomornya &amp; unggah dokumennya di bawah sebagai lampiran wajib.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div><label className={lbl}>No. Invoice Supplier</label><input value={supInv} onChange={(e) => setSupInv(e.target.value)} className={inp} placeholder="mis. INV-0022" /></div>
        <div><label className={lbl}>Tanggal Invoice</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inp} /></div>
        <div><label className={lbl}>Jatuh Tempo <span className="font-medium text-muted-foreground">(default +14 hari)</span></label><input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={inp} /></div>
        <div><label className={lbl}>Catatan</label><input value={note} onChange={(e) => setNote(e.target.value)} className={inp} placeholder="opsional" /></div>
      </div>

      <div>
        <p className={lbl}>Rincian Item <span className="font-medium text-muted-foreground">(auto dari QC Good · harga dari PO)</span></p>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead><tr className="bg-muted/50 text-left text-xs font-bold uppercase text-muted-foreground"><th className="px-3 py-2">SKU</th><th className="px-3 py-2">Size</th><th className="px-3 py-2 text-right">Qty Good</th><th className="px-3 py-2 text-right">Harga</th><th className="px-3 py-2 text-right">Subtotal</th></tr></thead>
            <tbody>
              {row.lines.map((l, i) => (
                <tr key={i} className="border-t border-border/60">
                  <td className="px-3 py-1.5 font-mono text-xs">{l.sku}</td>
                  <td className="px-3 py-1.5">{l.size}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{l.good}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatIDR(l.price)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatIDR(l.good * l.price)}</td>
                </tr>
              ))}
              <tr className="border-t border-border bg-muted/30 font-bold"><td className="px-3 py-2" colSpan={4}>Total ({row.good} pcs)</td><td className="px-3 py-2 text-right tabular-nums">{formatIDR(subtotal)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <label className={lbl}>Lampiran Dokumen <span className="font-medium text-muted-foreground">(invoice asli supplier, surat jalan, dll)</span></label>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-bold hover:bg-muted">
          <Upload className="h-4 w-4" /> {uploading ? "Mengunggah…" : "Upload Dokumen"}
          <input type="file" className="hidden" onChange={onFile} disabled={uploading} />
        </label>
        {docs.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {docs.map((d, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 text-xs font-semibold">
                <FileText className="h-3.5 w-3.5" /> {d.name}
                <button onClick={() => setDocs((p) => p.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-danger"><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      {err && <p className="text-sm font-semibold text-danger">{err}</p>}
    </Modal>
  );
}

function Card({ label, value, tone }: { label: string; value: string; tone?: "warn" | "danger" }) {
  const color = tone === "danger" ? "text-red-600" : tone === "warn" ? "text-amber-600" : "text-foreground";
  return (
    <div className="card p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={"mt-1 text-xl font-extrabold tabular-nums " + color}>{value}</p>
    </div>
  );
}

const lbl = "mb-1.5 block text-sm font-bold";
const inp = "h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none focus:border-primary/40";
