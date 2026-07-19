"use client";

import { useState, useMemo, useTransition, Fragment } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Paperclip, Upload, FileText, ChevronRight, Wallet, Check, CalendarClock, Ban, ClipboardCheck, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListFilter } from "@/components/ui/list-filter";
import { cn, formatIDR } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { createPR, submitPR, reviewPR, approvePR, rejectPR, schedulePR, payPR, settleCashAdvance, deletePR, addAttachment, type Attachment } from "./actions";

export type PRRow = {
  id: string; code: string; type: string; title: string; payee: string; category: string; brand: string; brandId: string | null;
  requester: string; vendorBank: string; vendorAccountNo: string; vendorAccountHolder: string;
  amount: number; status: string; scheduledDate: string | null; settledAmount: number | null; notes: string; attachments: Attachment[];
  purchasedAmount?: number; purchaseCount?: number;
};
export type BrandOpt = { id: string; name: string };
export type AccountOpt = { id: string; name: string; balance: number };

const TYPE_LABEL: Record<string, string> = { cash_advance: "Cash Advance", reimbursement: "Reimbursement", invoice: "Invoice" };
const STATUS: Record<string, { label: string; tone: "neutral" | "info" | "accent" | "success" | "danger" }> = {
  draft: { label: "Draft", tone: "neutral" }, submitted: { label: "Diajukan", tone: "info" }, reviewed: { label: "Direview", tone: "info" },
  approved: { label: "Disetujui", tone: "accent" }, scheduled: { label: "Dijadwalkan", tone: "accent" }, paid: { label: "Dibayar", tone: "success" },
  settled: { label: "Settled", tone: "success" }, rejected: { label: "Ditolak", tone: "danger" },
};

async function uploadFile(file: File, kind: string): Promise<Attachment | null> {
  try {
    const supabase = createClient();
    const ext = (file.name.split(".").pop() || "bin").toLowerCase();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("payment-docs").upload(path, file, { upsert: false });
    if (error) return null;
    const { data } = supabase.storage.from("payment-docs").getPublicUrl(path);
    return { name: file.name, url: data.publicUrl, kind };
  } catch { return null; }
}

export function PRView({ rows, brands, accounts, categories, canManage = true, canSubmit = true, userName = "" }: { rows: PRRow[]; brands: BrandOpt[]; accounts: AccountOpt[]; categories: string[]; canManage?: boolean; canSubmit?: boolean; userName?: string }) {
  const [q, setQ] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [open, setOpen] = useState(false);

  const brandOpts = useMemo(() => Array.from(new Set(rows.map((r) => r.brand))).filter((b) => b && b !== "—").sort(), [rows]);
  const query = q.trim().toLowerCase();
  const list = rows
    .filter((r) => !brandFilter || r.brand === brandFilter)
    .filter((r) => !typeFilter || r.type === typeFilter)
    .filter((r) => !query || r.code.toLowerCase().includes(query) || (r.title ?? "").toLowerCase().includes(query) || (r.payee ?? "").toLowerCase().includes(query) || (r.requester ?? "").toLowerCase().includes(query));

  const outstandingOps = rows.filter((r) => r.status === "approved" || r.status === "scheduled").reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Finance</p>
          <h1 className="text-2xl font-extrabold">Payment Request</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">Pengajuan pembayaran (cash advance / reimbursement / invoice) → review → approval → jadwal → bayar. Payable operational outstanding: <b className="text-danger">{formatIDR(outstandingOps)}</b></p>
        </div>
        {canSubmit && <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Buat Pengajuan</Button>}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <ListFilter q={q} setQ={setQ} brandFilter={brandFilter} setBrandFilter={setBrandFilter} brandOpts={brandOpts} count={list.length} unit="PR" placeholder="Cari no PR / deskripsi / PIC / vendor…" />
      </div>
      <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none focus:border-primary/40">
        <option value="">Semua Jenis</option>
        <option value="cash_advance">Cash Advance</option><option value="reimbursement">Reimbursement</option><option value="invoice">Invoice</option>
      </select>

      {list.length === 0 ? (
        <div className="card p-10 text-center text-sm font-medium text-muted-foreground">Belum ada pengajuan.</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[1120px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <th className="w-8 py-2.5 pl-4"></th>
                <th className="py-2.5 pr-3">No. PR</th>
                <th className="py-2.5 pr-3">Jenis</th>
                <th className="py-2.5 pr-3">Deskripsi</th>
                <th className="py-2.5 pr-3">Pemohon (PIC)</th>
                <th className="py-2.5 pr-3">Vendor</th>
                <th className="py-2.5 pr-3">Brand</th>
                <th className="py-2.5 pr-3 text-right">Nominal</th>
                <th className="py-2.5 pr-3">Status</th>
                <th className="py-2.5 pr-4 text-right">Lampiran</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => <PRRowItem key={r.id} row={r} accounts={accounts} canManage={canManage} canSubmit={canSubmit} />)}
            </tbody>
          </table>
        </div>
      )}

      {open && <PRForm brands={brands} categories={categories} userName={userName} onClose={() => setOpen(false)} />}
    </div>
  );
}

function PRRowItem({ row, accounts, canManage = true, canSubmit = true }: { row: PRRow; accounts: AccountOpt[]; canManage?: boolean; canSubmit?: boolean }) {
  const router = useRouter();
  const [openRow, setOpenRow] = useState(false);
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<null | "pay" | "schedule" | "settle">(null);
  const st = STATUS[row.status] ?? STATUS.draft;

  const act = (fn: () => Promise<{ ok: boolean }>) => startTransition(async () => { await fn(); router.refresh(); });

  return (
    <Fragment>
      <tr className="border-t border-border font-semibold hover:bg-muted/40">
        <td className="py-2.5 pl-4"><button onClick={() => setOpenRow((o) => !o)} className="grid h-6 w-6 place-items-center rounded-lg hover:bg-muted"><ChevronRight className={cn("h-4 w-4 transition-transform", openRow && "rotate-90")} /></button></td>
        <td className="py-2.5 pr-3 font-mono text-xs">{row.code}</td>
        <td className="py-2.5 pr-3 font-medium text-muted-foreground">{TYPE_LABEL[row.type] ?? row.type}</td>
        <td className="py-2.5 pr-3">{row.title || "—"}</td>
        <td className="py-2.5 pr-3 font-medium text-muted-foreground">{row.requester || "—"}</td>
        <td className="py-2.5 pr-3 font-medium text-muted-foreground">{row.payee || "—"}</td>
        <td className="py-2.5 pr-3 font-medium text-muted-foreground">{row.brand}</td>
        <td className="py-2.5 pr-3 text-right tabular-nums">{formatIDR(row.amount)}</td>
        <td className="py-2.5 pr-3"><Badge tone={st.tone}>{st.label}</Badge></td>
        <td className="py-2.5 pr-4 text-right text-xs font-bold text-muted-foreground">{row.attachments.length > 0 ? <span className="inline-flex items-center gap-1"><Paperclip className="h-3.5 w-3.5" /> {row.attachments.length}</span> : "—"}</td>
      </tr>
      {openRow && (
        <tr className="bg-muted/20">
          <td colSpan={10} className="px-5 py-3">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Detail</p>
                <p className="mt-1 text-sm">Pemohon (PIC): <b>{row.requester || "—"}</b></p>
                <p className="text-sm">Kategori: <b>{row.category || "—"}</b></p>
                {row.settledAmount != null && <p className="text-sm">Realisasi: <b>{formatIDR(row.settledAmount)}</b></p>}
                {row.scheduledDate && <p className="text-sm">Jadwal bayar: <b>{row.scheduledDate}</b></p>}
                {row.notes && <p className="text-sm text-muted-foreground">Catatan: {row.notes}</p>}
                <p className="mt-2 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Rekening Vendor</p>
                <p className="text-sm"><b>{row.payee || "—"}</b>{row.vendorBank ? ` · ${row.vendorBank}` : ""}</p>
                {(row.vendorAccountNo || row.vendorAccountHolder) && <p className="text-sm text-muted-foreground">{row.vendorAccountNo || "—"}{row.vendorAccountHolder ? ` · a.n. ${row.vendorAccountHolder}` : ""}</p>}
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Lampiran</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {row.attachments.length === 0 ? <span className="text-sm text-muted-foreground">Belum ada.</span> : row.attachments.map((a, i) => (
                    <a key={i} href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-bold hover:bg-muted"><FileText className="h-3.5 w-3.5" /> {a.kind || "file"}</a>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {row.status === "draft" && canSubmit && <><Button size="sm" disabled={pending} onClick={() => act(() => submitPR(row.id))}><Check className="h-4 w-4" /> Ajukan</Button><DelBtn onDel={() => act(() => deletePR(row.id))} /></>}
              {row.status === "submitted" && (canManage
                ? <><Button size="sm" disabled={pending} onClick={() => act(() => reviewPR(row.id))}><ClipboardCheck className="h-4 w-4" /> Review (Finance)</Button><Button size="sm" variant="outline" disabled={pending} onClick={() => act(() => rejectPR(row.id))}><Ban className="h-4 w-4" /> Tolak</Button></>
                : <WaitNote />)}
              {row.status === "reviewed" && (canManage
                ? <><Button size="sm" disabled={pending} onClick={() => act(() => approvePR(row.id))}><Check className="h-4 w-4" /> Setujui</Button><Button size="sm" variant="outline" disabled={pending} onClick={() => act(() => rejectPR(row.id))}><Ban className="h-4 w-4" /> Tolak</Button></>
                : <WaitNote />)}
              {row.status === "approved" && (canManage ? <Button size="sm" disabled={pending} onClick={() => setDialog("schedule")}><CalendarClock className="h-4 w-4" /> Jadwalkan</Button> : <WaitNote />)}
              {row.status === "scheduled" && (canManage ? <Button size="sm" disabled={pending} onClick={() => setDialog("pay")}><Wallet className="h-4 w-4" /> Bayar</Button> : <WaitNote />)}
              {row.status === "paid" && row.type === "cash_advance" && (canManage ? <Button size="sm" disabled={pending} onClick={() => setDialog("settle")}><ClipboardCheck className="h-4 w-4" /> Settlement</Button> : <span className="text-xs font-semibold text-muted-foreground">Menunggu settlement Finance</span>)}
              <AttachBtn row={row} onDone={() => router.refresh()} />
            </div>
          </td>
        </tr>
      )}
      {dialog === "schedule" && <ScheduleDialog row={row} onClose={() => setDialog(null)} />}
      {dialog === "pay" && <PayDialog row={row} accounts={accounts} onClose={() => setDialog(null)} />}
      {dialog === "settle" && <SettleDialog row={row} accounts={accounts} onClose={() => setDialog(null)} />}
    </Fragment>
  );
}

function WaitNote() {
  return <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">⏳ Menunggu proses Finance</span>;
}

function DelBtn({ onDel }: { onDel: () => void }) {
  const [c, setC] = useState(false);
  if (c) return <Button size="sm" variant="danger" onClick={onDel}>Yakin hapus?</Button>;
  return <Button size="sm" variant="ghost" onClick={() => setC(true)}><Trash2 className="h-4 w-4" /> Hapus</Button>;
}

function AttachBtn({ row, onDone }: { row: PRRow; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setBusy(true);
    const att = await uploadFile(f, row.type === "invoice" ? "invoice" : row.type === "reimbursement" ? "reimburse" : "lampiran");
    if (att) await addAttachment(row.id, att);
    setBusy(false); onDone();
  }
  return (
    <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-surface px-4 text-sm font-bold hover:bg-muted">
      <Upload className="h-4 w-4" /> {busy ? "Mengunggah…" : "Tambah Lampiran"}
      <input type="file" className="hidden" onChange={onFile} disabled={busy} />
    </label>
  );
}

function PRForm({ brands, categories, userName, onClose }: { brands: BrandOpt[]; categories: string[]; userName: string; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState("invoice");
  const [title, setTitle] = useState("");
  const [payee, setPayee] = useState("");
  const [vBank, setVBank] = useState("");
  const [vAccNo, setVAccNo] = useState("");
  const [vAccHolder, setVAccHolder] = useState("");
  const [category, setCategory] = useState(categories[0] ?? "");
  const [amount, setAmount] = useState("");
  const [brandId, setBrandId] = useState("");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setUploading(true); setError(null);
    const kind = type === "invoice" ? "invoice" : type === "reimbursement" ? "reimburse" : "lampiran";
    const att = await uploadFile(f, kind);
    if (!att) setError("Gagal upload file. Pastikan bucket 'payment-docs' sudah dibuat di Supabase.");
    else setFiles((p) => [...p, att]);
    setUploading(false);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    startTransition(async () => {
      const res = await createPR({ type, title, payee, category, amount: Number(amount) || 0, brandId: brandId || null, notes, attachments: files, vendorBank: vBank, vendorAccountNo: vAccNo, vendorAccountHolder: vAccHolder });
      if (!res.ok) { setError(res.error); return; }
      onClose(); router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-eerie/40 p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-6 shadow-soft">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-extrabold">Buat Pengajuan</h2><button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button></div>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Jenis</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className={inp + " px-3"}>
                <option value="invoice">Invoice</option><option value="reimbursement">Reimbursement</option><option value="cash_advance">Cash Advance</option>
              </select>
            </div>
            <div><label className={lbl}>Kategori</label><select value={category} onChange={(e) => setCategory(e.target.value)} className={inp + " px-3"}>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          </div>
          <div><label className={lbl}>Judul / Keperluan</label><input value={title} onChange={(e) => setTitle(e.target.value)} className={inp} placeholder="mis. Biaya iklan IG Juli" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Nominal</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={inp} placeholder="0" /></div>
            <div><label className={lbl}>Brand (opsional)</label><select value={brandId} onChange={(e) => setBrandId(e.target.value)} className={inp + " px-3"}><option value="">— Umum —</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
          </div>

          <div className="rounded-xl bg-muted/50 px-3.5 py-2.5 text-sm">
            <span className="font-semibold text-muted-foreground">Pemohon (PIC internal): </span>
            <b>{userName || "otomatis dari user login"}</b>
            <span className="ml-1 text-xs text-muted-foreground">· terisi otomatis</span>
          </div>

          <div className="rounded-xl border border-border p-3">
            <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Rekening Tujuan Pembayaran (Vendor/Penerima)</p>
            <div><label className={lbl}>Nama Vendor / Penerima</label><input value={payee} onChange={(e) => setPayee(e.target.value)} className={inp} placeholder="mis. PT Agency X" /></div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div><label className={lbl}>Bank</label><input value={vBank} onChange={(e) => setVBank(e.target.value)} className={inp} placeholder="mis. BCA" /></div>
              <div><label className={lbl}>No. Rekening</label><input value={vAccNo} onChange={(e) => setVAccNo(e.target.value)} className={inp} placeholder="1234567890" /></div>
              <div><label className={lbl}>Atas Nama</label><input value={vAccHolder} onChange={(e) => setVAccHolder(e.target.value)} className={inp} placeholder="Nama pemilik rekening" /></div>
            </div>
          </div>
          <div>
            <label className={lbl}>Lampiran {type === "invoice" ? "(invoice eksternal)" : type === "reimbursement" ? "(bukti/nota)" : "(opsional)"}</label>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-bold hover:bg-muted"><Upload className="h-4 w-4" /> {uploading ? "Mengunggah…" : "Upload File"}<input type="file" className="hidden" onChange={onFile} disabled={uploading} /></label>
            {files.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{files.map((f, i) => <span key={i} className="inline-flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1 text-xs font-semibold"><FileText className="h-3.5 w-3.5" /> {f.name}</span>)}</div>}
          </div>
          <div><label className={lbl}>Catatan</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-medium outline-none focus:border-primary/40" placeholder="opsional" /></div>
          {error && <p className="text-sm font-semibold text-danger">{error}</p>}
          <div className="flex justify-end gap-2.5 pt-1"><Button type="button" variant="ghost" size="sm" onClick={onClose}>Batal</Button><Button type="submit" size="sm" disabled={pending || uploading}>{pending ? "Menyimpan…" : "Simpan (Draft)"}</Button></div>
        </form>
      </div>
    </div>
  );
}

function ScheduleDialog({ row, onClose }: { row: PRRow; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });
  return (
    <Modal title={`Jadwalkan ${row.code}`} onClose={onClose}>
      <div><label className={lbl}>Tanggal Pembayaran</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inp} /></div>
      <div className="flex justify-end gap-2.5 pt-1"><Button type="button" variant="ghost" size="sm" onClick={onClose}>Batal</Button>
        <Button size="sm" disabled={pending} onClick={() => startTransition(async () => { await schedulePR(row.id, date); onClose(); router.refresh(); })}>Jadwalkan</Button></div>
    </Modal>
  );
}

function PayDialog({ row, accounts, onClose }: { row: PRRow; accounts: AccountOpt[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [method, setMethod] = useState("transfer");
  const [date, setDate] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });
  return (
    <Modal title={`Bayar ${row.code}`} onClose={onClose}>
      <div className="rounded-xl bg-muted/60 px-3.5 py-2.5 text-sm">{TYPE_LABEL[row.type]} · {formatIDR(row.amount)}{row.requester ? ` · pemohon ${row.requester}` : ""}</div>
      {(row.payee || row.vendorBank || row.vendorAccountNo) && (
        <div className="rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm">
          <p className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Transfer ke rekening vendor</p>
          <p className="mt-1 font-bold">{row.payee || "—"}{row.vendorBank ? ` · ${row.vendorBank}` : ""}</p>
          {(row.vendorAccountNo || row.vendorAccountHolder) && <p className="text-muted-foreground">{row.vendorAccountNo || "—"}{row.vendorAccountHolder ? ` · a.n. ${row.vendorAccountHolder}` : ""}</p>}
        </div>
      )}
      <div><label className={lbl}>Bayar dari Akun</label><select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inp + " px-3"}><option value="">— Pilih —</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} · saldo {formatIDR(a.balance)}</option>)}</select></div>
      <div className="grid grid-cols-2 gap-3"><div><label className={lbl}>Tanggal</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inp} /></div><div><label className={lbl}>Metode</label><select value={method} onChange={(e) => setMethod(e.target.value)} className={inp + " px-3"}><option value="transfer">Transfer</option><option value="tunai">Tunai</option></select></div></div>
      {error && <p className="text-sm font-semibold text-danger">{error}</p>}
      <div className="flex justify-end gap-2.5 pt-1"><Button type="button" variant="ghost" size="sm" onClick={onClose}>Batal</Button>
        <Button size="sm" disabled={pending} onClick={() => startTransition(async () => { const r = await payPR({ id: row.id, code: row.code, amount: row.amount, accountId, date, method }); if (!r.ok) { setError(r.error); return; } onClose(); router.refresh(); })}>Bayar</Button></div>
    </Modal>
  );
}

function SettleDialog({ row, accounts, onClose }: { row: PRRow; accounts: AccountOpt[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const purchased = row.purchasedAmount ?? 0;
  const [settled, setSettled] = useState(purchased > 0 ? String(purchased) : "");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [report, setReport] = useState<Attachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [date, setDate] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });
  const s = Number(settled) || 0;
  const refund = Math.max(0, row.amount - s);
  const excess = Math.max(0, s - row.amount);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return; setUploading(true);
    const att = await uploadFile(f, "settlement"); if (att) setReport(att); setUploading(false);
  }

  return (
    <Modal title={`Settlement ${row.code}`} onClose={onClose}>
      <div className="rounded-xl bg-muted/60 px-3.5 py-2.5 text-sm">Cash Advance: <b>{formatIDR(row.amount)}</b></div>
      {purchased > 0 && <p className="text-xs font-semibold text-muted-foreground">Dari pembelian tunai terhubung: <b className="text-foreground">{formatIDR(purchased)}</b> ({row.purchaseCount ?? 0} nota). Sudah terisi otomatis di bawah — ubah bila ada realisasi lain.</p>}
      <div><label className={lbl}>Realisasi Pemakaian</label><input type="number" value={settled} onChange={(e) => setSettled(e.target.value)} className={inp} placeholder="0" /></div>
      {s > 0 && (refund > 0 ? <p className="text-sm font-semibold text-emerald-700">Sisa {formatIDR(refund)} → refund ke finance (kas masuk).</p> : excess > 0 ? <p className="text-sm font-semibold text-amber-600">Kelebihan {formatIDR(excess)} → otomatis jadi reimbursement (payable baru).</p> : <p className="text-sm font-medium text-muted-foreground">Pas, tidak ada refund/kelebihan.</p>)}
      {refund > 0 && <div><label className={lbl}>Akun terima refund</label><select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inp + " px-3"}><option value="">— Pilih —</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>}
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lbl}>Tanggal</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inp} /></div>
        <div><label className={lbl}>Report</label><label className="inline-flex h-11 w-full cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface px-3 text-sm font-bold hover:bg-muted"><Upload className="h-4 w-4" />{uploading ? "…" : report ? "Terlampir" : "Upload"}<input type="file" className="hidden" onChange={onFile} disabled={uploading} /></label></div>
      </div>
      {error && <p className="text-sm font-semibold text-danger">{error}</p>}
      <div className="flex justify-end gap-2.5 pt-1"><Button type="button" variant="ghost" size="sm" onClick={onClose}>Batal</Button>
        <Button size="sm" disabled={pending} onClick={() => startTransition(async () => { const r = await settleCashAdvance({ id: row.id, code: row.code, amount: row.amount, settledAmount: s, accountId, date, brandId: row.brandId, report: report ?? undefined }); if (!r.ok) { setError(r.error); return; } onClose(); router.refresh(); })}>Simpan Settlement</Button></div>
    </Modal>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-eerie/40 p-4">
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-surface p-6 shadow-soft">
        <div className="flex items-center justify-between"><h2 className="text-lg font-extrabold">{title}</h2><button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button></div>
        {children}
      </div>
    </div>
  );
}

const lbl = "mb-1.5 block text-sm font-bold";
const inp = "h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm font-medium outline-none focus:border-primary/40";
