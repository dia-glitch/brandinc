"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Pencil, Trash2, ArrowDownToLine, ArrowLeftRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatIDR } from "@/lib/utils";
import { createAccount, updateAccount, deleteAccount, recordCashIn, transferBook } from "../actions";

export type Account = { id: string; name: string; kind: string; bankName: string | null; accountNo: string | null; accountHolder: string | null; opening: number; inSum: number; outSum: number; balance: number };

export function CashView({ accounts, canEdit = true }: { accounts: Account[]; canEdit?: boolean }) {
  const [openNew, setOpenNew] = useState(false);
  const [edit, setEdit] = useState<Account | null>(null);
  const [topup, setTopup] = useState<Account | null>(null);
  const [transfer, setTransfer] = useState(false);
  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Finance</p>
          <h1 className="text-2xl font-extrabold">Kas &amp; Bank</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">Total saldo semua akun: <b className="text-foreground">{formatIDR(totalBalance)}</b></p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setTransfer(true)} disabled={accounts.length < 2}><ArrowLeftRight className="h-4 w-4" /> Pindah Buku</Button>
            <Button size="sm" onClick={() => setOpenNew(true)}><Plus className="h-4 w-4" /> Akun Baru</Button>
          </div>
        )}
      </div>

      {accounts.length === 0 ? (
        <div className="card p-10 text-center text-sm font-medium text-muted-foreground">Belum ada akun kas/bank. Klik &quot;Akun Baru&quot;.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((a) => (
            <div key={a.id} className="card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2"><Badge tone={a.kind === "cash" ? "accent" : "info"}>{a.kind === "cash" ? "Kas" : "Bank"}</Badge><span className="font-bold">{a.name}</span></div>
                  {a.bankName && <p className="mt-0.5 text-xs font-medium text-muted-foreground">{a.bankName} · {a.accountNo ?? "—"}</p>}
                </div>
                {canEdit && (
                  <div className="flex gap-1">
                    <button onClick={() => setEdit(a)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted" title="Edit"><Pencil className="h-4 w-4" /></button>
                  </div>
                )}
              </div>
              <p className="mt-3 text-2xl font-black tabular-nums">{formatIDR(a.balance)}</p>
              <p className="text-xs font-medium text-muted-foreground">masuk {formatIDR(a.inSum)} · keluar {formatIDR(a.outSum)}</p>
              {canEdit && <Button variant="outline" size="sm" className="mt-3" onClick={() => setTopup(a)}><ArrowDownToLine className="h-4 w-4" /> Cash In / Penerimaan</Button>}
            </div>
          ))}
        </div>
      )}

      <p className="text-sm font-medium text-muted-foreground">Rincian transaksi masuk/keluar tiap akun ada di tab <b className="text-foreground">Mutasi Kas</b>.</p>

      {openNew && <AccountDialog onClose={() => setOpenNew(false)} />}
      {edit && <AccountDialog account={edit} onClose={() => setEdit(null)} />}
      {topup && <CashInDialog account={topup} onClose={() => setTopup(null)} />}
      {transfer && <TransferDialog accounts={accounts} onClose={() => setTransfer(false)} />}
    </div>
  );
}

function TransferDialog({ accounts, onClose }: { accounts: Account[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fromId, setFromId] = useState(accounts[0]?.id ?? "");
  const [toId, setToId] = useState(accounts[1]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });
  const from = accounts.find((a) => a.id === fromId);

  // Ganti akun asal → pastikan akun tujuan tidak ikut sama.
  function changeFrom(v: string) {
    setFromId(v);
    if (toId === v) { const other = accounts.find((a) => a.id !== v); setToId(other?.id ?? ""); }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    startTransition(async () => {
      const res = await transferBook({ fromId, toId, amount: Number(amount) || 0, date, method: "transfer", notes });
      if (!res.ok) { setError(res.error); return; }
      onClose(); router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-eerie/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-soft">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-extrabold">Pindah Buku</h2><button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button></div>
        <p className="mb-4 text-sm font-medium text-muted-foreground">Pindahkan dana antar akun sendiri. Tidak dihitung sebagai pemasukan/pengeluaran baru — total saldo tetap.</p>
        <form onSubmit={submit} className="space-y-4">
          <div><label className={lbl}>Dari Akun</label>
            <select value={fromId} onChange={(e) => changeFrom(e.target.value)} className={inp + " px-3"}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} · saldo {formatIDR(a.balance)}</option>)}</select>
          </div>
          <div><label className={lbl}>Ke Akun</label>
            <select value={toId} onChange={(e) => setToId(e.target.value)} className={inp + " px-3"}>{accounts.filter((a) => a.id !== fromId).map((a) => <option key={a.id} value={a.id}>{a.name} · saldo {formatIDR(a.balance)}</option>)}</select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Nominal</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={inp} placeholder="0" /></div>
            <div><label className={lbl}>Tanggal</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inp} /></div>
          </div>
          {from && Number(amount) > from.balance && <p className="text-xs font-semibold text-amber-600">Nominal melebihi saldo {from.name} ({formatIDR(from.balance)}).</p>}
          <div><label className={lbl}>Catatan</label><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inp} placeholder="mis. pindah ke rekening operasional" /></div>
          {error && <p className="text-sm font-semibold text-danger">{error}</p>}
          <div className="flex justify-end gap-2.5 pt-1"><Button type="button" variant="ghost" size="sm" onClick={onClose}>Batal</Button><Button type="submit" size="sm" disabled={pending}>{pending ? "Memproses…" : "Pindahkan"}</Button></div>
        </form>
      </div>
    </div>
  );
}

function AccountDialog({ account, onClose }: { account?: Account; onClose: () => void }) {
  const isEdit = Boolean(account);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [name, setName] = useState(account?.name ?? "");
  const [kind, setKind] = useState(account?.kind ?? "bank");
  const [bankName, setBankName] = useState(account?.bankName ?? "");
  const [accountNo, setAccountNo] = useState(account?.accountNo ?? "");
  const [accountHolder, setAccountHolder] = useState(account?.accountHolder ?? "");
  const [opening, setOpening] = useState(account ? String(account.opening) : "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const input = { name, kind, bankName, accountNo, accountHolder, opening: Number(opening) || 0 };
    startTransition(async () => {
      const res = isEdit && account ? await updateAccount(account.id, input) : await createAccount(input);
      if (!res.ok) { setError(res.error); return; }
      onClose(); router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-eerie/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">{isEdit ? "Edit Akun" : "Akun Baru"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Nama Akun</label><input required value={name} onChange={(e) => setName(e.target.value)} className={inp} placeholder="mis. BCA Operasional" /></div>
            <div><label className={lbl}>Jenis</label>
              <select value={kind} onChange={(e) => setKind(e.target.value)} className={inp + " px-3"}><option value="bank">Bank</option><option value="cash">Kas</option></select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Nama Bank</label><input value={bankName} onChange={(e) => setBankName(e.target.value)} className={inp} placeholder="opsional" /></div>
            <div><label className={lbl}>No. Rekening</label><input value={accountNo} onChange={(e) => setAccountNo(e.target.value)} className={inp} placeholder="opsional" /></div>
          </div>
          <div><label className={lbl}>Atas Nama (a.n.) <span className="font-medium text-muted-foreground">— sesuai buku rekening resmi</span></label><input value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} className={inp} placeholder="mis. PT Modatri Fashindo" /></div>
          <div><label className={lbl}>Saldo Awal</label><input type="number" value={opening} onChange={(e) => setOpening(e.target.value)} className={inp} placeholder="0" /></div>
          {error && <p className="text-sm font-semibold text-danger">{error}</p>}
          <div className="flex items-center justify-between pt-1">
            {isEdit ? (confirmDel ? (
              <span className="inline-flex items-center gap-1">
                <button type="button" className="rounded-lg bg-danger px-2 py-1 text-xs font-bold text-white" disabled={pending} onClick={() => startTransition(async () => { if (account) await deleteAccount(account.id); onClose(); router.refresh(); })}>Hapus?</button>
                <button type="button" className="rounded-lg border border-border px-2 py-1 text-xs font-bold" onClick={() => setConfirmDel(false)}>Tidak</button>
              </span>
            ) : <button type="button" onClick={() => setConfirmDel(true)} className="inline-flex items-center gap-1.5 text-sm font-bold text-danger"><Trash2 className="h-4 w-4" /> Hapus</button>) : <span />}
            <div className="flex gap-2.5">
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>Batal</Button>
              <Button type="submit" size="sm" disabled={pending}>{pending ? "Menyimpan…" : "Simpan"}</Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function CashInDialog({ account, onClose }: { account: Account; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState("sales_marketplace");
  const [channel, setChannel] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });
  const isMarket = source === "sales_marketplace";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await recordCashIn({ accountId: account.id, source, channel, date, amount: Number(amount) || 0, notes });
      if (!res.ok) { setError(res.error); return; }
      onClose(); router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-eerie/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">Cash In ke {account.name}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div><label className={lbl}>Sumber Penerimaan</label>
            <select value={source} onChange={(e) => setSource(e.target.value)} className={inp + " px-3"}>
              <option value="sales_marketplace">Penjualan Marketplace (pencairan)</option>
              <option value="capital">Setoran Modal</option>
              <option value="other">Pendapatan Lain</option>
            </select>
          </div>
          {isMarket && (
            <div><label className={lbl}>Channel / Marketplace</label><input value={channel} onChange={(e) => setChannel(e.target.value)} className={inp} placeholder="mis. Shopee / Tokopedia / TikTok Shop" /></div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Nominal {isMarket ? "(netto cair)" : ""}</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={inp} placeholder="0" /></div>
            <div><label className={lbl}>Tanggal</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inp} /></div>
          </div>
          <div><label className={lbl}>Catatan</label><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inp} placeholder={isMarket ? "mis. pencairan periode 1–15 Juli" : "opsional"} /></div>
          {isMarket && <p className="text-xs font-medium text-muted-foreground">Isi jumlah yang benar-benar masuk ke rekening (sudah dipotong biaya admin marketplace).</p>}
          {error && <p className="text-sm font-semibold text-danger">{error}</p>}
          <div className="flex justify-end gap-2.5 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>Batal</Button>
            <Button type="submit" size="sm" disabled={pending}>{pending ? "Menyimpan…" : "Simpan Cash In"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

const lbl = "mb-1.5 block text-sm font-bold";
const inp = "h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm font-medium outline-none focus:border-primary/40";
