"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Trash2, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListFilter } from "@/components/ui/list-filter";
import { formatIDR } from "@/lib/utils";
import { createExpense, deleteExpense, payExpense } from "../actions";

export type ExpenseRow = { id: string; category: string; date: string | null; amount: number; payee: string; brand: string; brandId: string | null; requester: string; vendorBank: string; vendorAccountNo: string; vendorAccountHolder: string; notes: string | null; status: string };
export type BrandOpt = { id: string; name: string };
export type AccountOpt = { id: string; name: string; balance: number };

export function ExpenseView({ rows, categories, brands, accounts, userName = "" }: { rows: ExpenseRow[]; categories: string[]; brands: BrandOpt[]; accounts: AccountOpt[]; userName?: string }) {
  const [q, setQ] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [payRow, setPayRow] = useState<ExpenseRow | null>(null);

  const brandOpts = useMemo(() => Array.from(new Set(rows.map((r) => r.brand))).filter((b) => b && b !== "—").sort(), [rows]);
  const query = q.trim().toLowerCase();
  const list = rows
    .filter((r) => !brandFilter || r.brand === brandFilter)
    .filter((r) => !query || r.category.toLowerCase().includes(query) || (r.payee ?? "").toLowerCase().includes(query) || (r.requester ?? "").toLowerCase().includes(query));
  const total = list.reduce((s, r) => s + r.amount, 0);
  const unpaid = list.filter((r) => r.status !== "paid").reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Finance</p>
          <h1 className="text-2xl font-extrabold">Expenses (Manual)</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">Biaya lain: marketing, operasional, gaji, dll. Total: <b>{formatIDR(total)}</b> · belum bayar: <b className="text-danger">{formatIDR(unpaid)}</b></p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Tambah Expense</Button>
      </div>

      <ListFilter q={q} setQ={setQ} brandFilter={brandFilter} setBrandFilter={setBrandFilter} brandOpts={brandOpts} count={list.length} unit="expense" placeholder="Cari kategori / PIC / vendor…" />

      {list.length === 0 ? (
        <div className="card p-10 text-center text-sm font-medium text-muted-foreground">Belum ada expense.</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <th className="py-2.5 pl-4 pr-3">Tgl</th>
                <th className="py-2.5 pr-3">Kategori</th>
                <th className="py-2.5 pr-3">Pemohon (PIC)</th>
                <th className="py-2.5 pr-3">Vendor</th>
                <th className="py-2.5 pr-3">Brand</th>
                <th className="py-2.5 pr-3 text-right">Nominal</th>
                <th className="py-2.5 pr-3">Status</th>
                <th className="py-2.5 pr-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className="border-t border-border font-semibold hover:bg-muted/40">
                  <td className="py-2.5 pl-4 pr-3 font-medium text-muted-foreground">{r.date ?? "—"}</td>
                  <td className="py-2.5 pr-3">{r.category}</td>
                  <td className="py-2.5 pr-3 font-medium text-muted-foreground">{r.requester || "—"}</td>
                  <td className="py-2.5 pr-3 font-medium text-muted-foreground">{r.payee || "—"}</td>
                  <td className="py-2.5 pr-3 font-medium text-muted-foreground">{r.brand}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{formatIDR(r.amount)}</td>
                  <td className="py-2.5 pr-3">{r.status === "paid" ? <Badge tone="success">Lunas</Badge> : <Badge tone="danger">Belum</Badge>}</td>
                  <td className="py-2.5 pr-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {r.status !== "paid" && <Button variant="ghost" size="sm" onClick={() => setPayRow(r)}><Wallet className="h-4 w-4" /> Bayar</Button>}
                      <DeleteBtn id={r.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && <ExpenseForm categories={categories} brands={brands} userName={userName} onClose={() => setOpen(false)} />}
      {payRow && <PayExpenseDialog row={payRow} accounts={accounts} onClose={() => setPayRow(null)} />}
    </div>
  );
}

function DeleteBtn({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);
  if (confirm) return (
    <span className="inline-flex items-center gap-1">
      <button className="rounded-lg bg-danger px-2 py-1 text-xs font-bold text-white" disabled={pending} onClick={() => startTransition(async () => { await deleteExpense(id); router.refresh(); })}>Hapus?</button>
      <button className="rounded-lg border border-border px-2 py-1 text-xs font-bold" onClick={() => setConfirm(false)}>Tidak</button>
    </span>
  );
  return <Button variant="ghost" size="icon" onClick={() => setConfirm(true)} title="Hapus"><Trash2 className="h-4 w-4" /></Button>;
}

function ExpenseForm({ categories, brands, userName, onClose }: { categories: string[]; brands: BrandOpt[]; userName: string; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState(categories[0] ?? "");
  const [date, setDate] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });
  const [amount, setAmount] = useState("");
  const [payee, setPayee] = useState("");
  const [vBank, setVBank] = useState("");
  const [vAccNo, setVAccNo] = useState("");
  const [vAccHolder, setVAccHolder] = useState("");
  const [brandId, setBrandId] = useState("");
  const [notes, setNotes] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createExpense({ category, date, amount: Number(amount) || 0, payee, brandId: brandId || null, notes, vendorBank: vBank, vendorAccountNo: vAccNo, vendorAccountHolder: vAccHolder });
      if (!res.ok) { setError(res.error); return; }
      onClose(); router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-eerie/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">Tambah Expense</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Kategori</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={inp + " px-3"}>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Tanggal</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inp} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Nominal</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={inp} placeholder="0" /></div>
            <div><label className={lbl}>Brand (opsional)</label>
              <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className={inp + " px-3"}>
                <option value="">— Umum —</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>
          <div className="rounded-xl bg-muted/50 px-3.5 py-2 text-sm">
            <span className="font-semibold text-muted-foreground">Pemohon (PIC): </span><b>{userName || "otomatis dari user login"}</b><span className="ml-1 text-xs text-muted-foreground">· otomatis</span>
          </div>
          <div className="rounded-xl border border-border p-3">
            <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Rekening Tujuan (Vendor/Penerima)</p>
            <div><label className={lbl}>Nama Vendor / Penerima</label><input value={payee} onChange={(e) => setPayee(e.target.value)} className={inp} placeholder="mis. Agency X" /></div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div><label className={lbl}>Bank</label><input value={vBank} onChange={(e) => setVBank(e.target.value)} className={inp} placeholder="mis. BCA" /></div>
              <div><label className={lbl}>No. Rekening</label><input value={vAccNo} onChange={(e) => setVAccNo(e.target.value)} className={inp} placeholder="1234567890" /></div>
              <div><label className={lbl}>Atas Nama</label><input value={vAccHolder} onChange={(e) => setVAccHolder(e.target.value)} className={inp} placeholder="pemilik rekening" /></div>
            </div>
          </div>
          <div><label className={lbl}>Catatan</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-medium outline-none focus:border-primary/40" placeholder="opsional" /></div>
          {error && <p className="text-sm font-semibold text-danger">{error}</p>}
          <div className="flex justify-end gap-2.5 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>Batal</Button>
            <Button type="submit" size="sm" disabled={pending}>{pending ? "Menyimpan…" : "Simpan"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PayExpenseDialog({ row, accounts, onClose }: { row: ExpenseRow; accounts: AccountOpt[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [method, setMethod] = useState("transfer");
  const [date, setDate] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await payExpense({ expenseId: row.id, amount: row.amount, accountId, date, method });
      if (!res.ok) { setError(res.error); return; }
      onClose(); router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-eerie/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">Bayar Expense</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="mb-3 rounded-xl bg-muted/60 px-3.5 py-2.5 text-sm"><b>{row.category}</b> · {formatIDR(row.amount)}{row.requester ? ` · pemohon ${row.requester}` : ""}</div>
        {(row.payee || row.vendorBank || row.vendorAccountNo) && (
          <div className="mb-4 rounded-xl border border-border px-3.5 py-2.5 text-sm">
            <p className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Transfer ke rekening vendor</p>
            <p className="mt-1 font-bold">{row.payee || "—"}{row.vendorBank ? ` · ${row.vendorBank}` : ""}</p>
            {(row.vendorAccountNo || row.vendorAccountHolder) && <p className="text-muted-foreground">{row.vendorAccountNo || "—"}{row.vendorAccountHolder ? ` · a.n. ${row.vendorAccountHolder}` : ""}</p>}
          </div>
        )}
        <form onSubmit={submit} className="space-y-4">
          <div><label className={lbl}>Bayar dari Akun</label>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inp + " px-3"}>
              <option value="">— Pilih —</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} · saldo {formatIDR(a.balance)}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Tanggal</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Metode</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)} className={inp + " px-3"}>
                <option value="transfer">Transfer</option><option value="tunai">Tunai</option><option value="giro">Giro</option>
              </select>
            </div>
          </div>
          {error && <p className="text-sm font-semibold text-danger">{error}</p>}
          <div className="flex justify-end gap-2.5 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>Batal</Button>
            <Button type="submit" size="sm" disabled={pending}>{pending ? "Memproses…" : "Bayar"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

const lbl = "mb-1.5 block text-sm font-bold";
const inp = "h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm font-medium outline-none focus:border-primary/40";
