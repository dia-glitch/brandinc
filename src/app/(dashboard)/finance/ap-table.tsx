"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Wallet, FileText, Printer, PackageCheck, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListFilter } from "@/components/ui/list-filter";
import { formatIDR } from "@/lib/utils";
import { Modal, Field } from "@/components/ui/modal";
import { payInvoice } from "./actions";

export type Payable = {
  key: string; refType: string; invoiceNo: string; invoiceDate: string | null;
  party: string; brand: string; subtotal: number; ppn: number; total: number; paid: number; status: string;
  poId: string | null; prodPoId: string | null; receiptId: string | null;
};
export type AccountOpt = { id: string; name: string; balance: number };

export function APTable({ rows, accounts, canEdit = true }: { rows: Payable[]; accounts: AccountOpt[]; canEdit?: boolean }) {
  const [q, setQ] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [pay, setPay] = useState<Payable | null>(null);
  const [detail, setDetail] = useState<Payable | null>(null);

  const brandOpts = useMemo(() => Array.from(new Set(rows.map((r) => r.brand))).filter((b) => b && b !== "—").sort(), [rows]);
  const query = q.trim().toLowerCase();
  const list = rows
    .filter((r) => !brandFilter || r.brand === brandFilter)
    .filter((r) => !statusFilter || r.status === statusFilter)
    .filter((r) => !query || r.invoiceNo.toLowerCase().includes(query) || r.party.toLowerCase().includes(query));

  const outstanding = list.reduce((s, r) => s + Math.max(0, r.total - r.paid), 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <ListFilter q={q} setQ={setQ} brandFilter={brandFilter} setBrandFilter={setBrandFilter} brandOpts={brandOpts} count={list.length} unit="invoice" placeholder="Cari no. invoice / supplier…" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none focus:border-primary/40">
          <option value="">Semua Status</option>
          <option value="unpaid">Belum Bayar</option>
          <option value="partial">Sebagian</option>
          <option value="paid">Lunas</option>
        </select>
        <div className="card px-5 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Total Outstanding</p>
          <p className="text-2xl font-black tabular-nums tracking-tight text-danger">{formatIDR(outstanding)}</p>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="card p-10 text-center text-sm font-medium text-muted-foreground">Belum ada hutang / invoice.</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <th className="py-2.5 pl-4 pr-3">No. Invoice</th>
                <th className="py-2.5 pr-3">Jenis</th>
                <th className="py-2.5 pr-3">Supplier/Vendor</th>
                <th className="py-2.5 pr-3">Brand</th>
                <th className="py-2.5 pr-3">Tgl</th>
                <th className="py-2.5 pr-3 text-right">Total</th>
                <th className="py-2.5 pr-3 text-right">Dibayar</th>
                <th className="py-2.5 pr-3">Status</th>
                <th className="py-2.5 pr-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.key} className="border-t border-border font-semibold hover:bg-muted/40">
                  <td className="py-2.5 pl-4 pr-3 font-mono text-xs">{r.invoiceNo}</td>
                  <td className="py-2.5 pr-3 font-medium text-muted-foreground">{r.refType === "production_invoice" ? "Jasa Produksi" : "Bahan"}</td>
                  <td className="py-2.5 pr-3">{r.party}</td>
                  <td className="py-2.5 pr-3 font-medium text-muted-foreground">{r.brand}</td>
                  <td className="py-2.5 pr-3 font-medium text-muted-foreground">{r.invoiceDate ?? "\u2014"}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{formatIDR(r.total)}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-emerald-700">{r.paid > 0 ? formatIDR(r.paid) : "\u2014"}</td>
                  <td className="py-2.5 pr-3">{r.status === "paid" ? <Badge tone="success">Lunas</Badge> : r.status === "partial" ? <Badge tone="accent">Sebagian</Badge> : <Badge tone="danger">Belum</Badge>}</td>
                  <td className="py-2.5 pr-4 text-right"><Button variant="outline" size="sm" onClick={() => setDetail(r)}><Eye className="h-4 w-4" /> Detail</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detail && <APDetailModal payable={detail} canEdit={canEdit} onClose={() => setDetail(null)} onPay={() => { const r = detail; setDetail(null); setPay(r); }} />}
      {pay && <PayDialog payable={pay} accounts={accounts} onClose={() => setPay(null)} />}
    </div>
  );
}

function DocLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer"
      className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2 text-sm font-bold hover:bg-muted">
      {icon} {label}
    </a>
  );
}

function APDetailModal({ payable, canEdit, onClose, onPay }: { payable: Payable; canEdit: boolean; onClose: () => void; onPay: () => void }) {
  const r = payable;
  const out = Math.max(0, r.total - r.paid);
  const footer = (
    <>
      {canEdit && out > 0 && <Button size="sm" onClick={onPay}><Wallet className="h-4 w-4" /> Bayar</Button>}
      <Button size="sm" variant="ghost" onClick={onClose}>Tutup</Button>
    </>
  );
  return (
    <Modal
      size="lg"
      onClose={onClose}
      badge={r.status === "paid" ? <Badge tone="success">Lunas</Badge> : r.status === "partial" ? <Badge tone="accent">Sebagian</Badge> : <Badge tone="danger">Belum Bayar</Badge>}
      title={<span className="font-mono">{r.invoiceNo}</span>}
      subtitle={r.refType === "production_invoice" ? "Jasa Produksi" : "Bahan / Material"}
      footer={footer}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Supplier / Vendor">{r.party}</Field>
        <Field label="Brand">{r.brand}</Field>
        <Field label="Tgl Invoice">{r.invoiceDate ?? "\u2014"}</Field>
        <Field label="Total">{formatIDR(r.total)}</Field>
        <Field label="Dibayar">{r.paid > 0 ? formatIDR(r.paid) : "\u2014"}</Field>
        <Field label="Outstanding">{formatIDR(out)}</Field>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Dokumen untuk verifikasi</p>
        <div className="flex flex-wrap gap-2">
          {r.refType === "material_invoice" ? (
            <>
              <DocLink href={`/print/po/${r.poId}`} icon={<Printer className="h-4 w-4" />} label="PO Awal" />
              <DocLink href={`/print/invoice/${r.poId}`} icon={<FileText className="h-4 w-4" />} label="Invoice Detail" />
            </>
          ) : (
            <>
              <DocLink href={`/print/prodpo/${r.prodPoId}`} icon={<Printer className="h-4 w-4" />} label="PO Produksi" />
              <DocLink href={`/print/grn/${r.receiptId}`} icon={<PackageCheck className="h-4 w-4" />} label="GR / Penerimaan (GRN)" />
              <DocLink href={`/print/grninvoice/${r.receiptId}`} icon={<FileText className="h-4 w-4" />} label="Invoice Detail" />
            </>
          )}
        </div>
        <p className="mt-2 text-xs font-medium text-muted-foreground">Tiap dokumen bisa dibuka (view) &amp; disimpan PDF lewat tombol Print di halamannya.</p>
      </div>
    </Modal>
  );
}

function PayDialog({ payable, accounts, onClose }: { payable: Payable; accounts: AccountOpt[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const outstanding = Math.max(0, payable.total - payable.paid);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [amount, setAmount] = useState(String(outstanding));
  const [method, setMethod] = useState("transfer");
  const [date, setDate] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await payInvoice({ refType: payable.refType, invoiceNo: payable.invoiceNo, accountId, date, amount: Number(amount) || 0, method, notes: "" });
      if (!res.ok) { setError(res.error); return; }
      onClose(); router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-eerie/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">Bayar Invoice</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="mb-4 rounded-xl bg-muted/60 px-3.5 py-2.5 text-sm">
          <p className="font-mono font-bold">{payable.invoiceNo}</p>
          <p className="text-muted-foreground">{payable.party} · Outstanding <b className="text-danger">{formatIDR(outstanding)}</b></p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={lbl}>Bayar dari Akun</label>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inp + " px-3"}>
              <option value="">— Pilih —</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} · saldo {formatIDR(a.balance)}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Nominal</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Tanggal</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inp} /></div>
          </div>
          <div>
            <label className={lbl}>Metode</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className={inp + " px-3"}>
              <option value="transfer">Transfer</option><option value="tunai">Tunai</option><option value="giro">Giro</option>
            </select>
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
