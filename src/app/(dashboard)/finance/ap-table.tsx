"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Printer, PackageCheck, Eye, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListFilter } from "@/components/ui/list-filter";
import { formatIDR } from "@/lib/utils";
import { Modal, Field } from "@/components/ui/modal";
import { verifyPayable, unverifyPayable } from "./actions";

export type Payable = {
  key: string; refType: string; invoiceNo: string; invoiceDate: string | null;
  party: string; brand: string; subtotal: number; ppn: number; total: number; paid: number; status: string;
  verified: boolean;
  poId: string | null; prodPoId: string | null; receiptId: string | null;
};
export type AccountOpt = { id: string; name: string; balance: number };

type ApState = "belum" | "verified" | "partial" | "paid";
function apState(r: Payable): ApState {
  if (r.status === "paid") return "paid";
  if (r.status === "partial") return "partial";
  return r.verified ? "verified" : "belum";
}
function ApBadge({ r }: { r: Payable }) {
  const st = apState(r);
  if (st === "paid") return <Badge tone="success">Lunas</Badge>;
  if (st === "partial") return <Badge tone="accent">Sebagian</Badge>;
  if (st === "verified") return <Badge tone="info">Terverifikasi</Badge>;
  return <Badge tone="danger">Belum Verifikasi</Badge>;
}

export function APTable({ rows, canEdit = true }: { rows: Payable[]; accounts?: AccountOpt[]; canEdit?: boolean }) {
  const [q, setQ] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [detail, setDetail] = useState<Payable | null>(null);

  const brandOpts = useMemo(() => Array.from(new Set(rows.map((r) => r.brand))).filter((b) => b && b !== "—").sort(), [rows]);
  const query = q.trim().toLowerCase();
  const list = rows
    .filter((r) => !brandFilter || r.brand === brandFilter)
    .filter((r) => !statusFilter || apState(r) === statusFilter)
    .filter((r) => !query || r.invoiceNo.toLowerCase().includes(query) || r.party.toLowerCase().includes(query));

  const outstanding = list.reduce((s, r) => s + Math.max(0, r.total - r.paid), 0);
  const belumVerif = rows.filter((r) => apState(r) === "belum").length;

  // Perbarui detail yang terbuka bila data berubah (mis. setelah verifikasi).
  const openDetail = detail ? rows.find((r) => r.key === detail.key) ?? detail : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <ListFilter q={q} setQ={setQ} brandFilter={brandFilter} setBrandFilter={setBrandFilter} brandOpts={brandOpts} count={list.length} unit="invoice" placeholder="Cari no. invoice / supplier…" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none focus:border-primary/40">
          <option value="">Semua Status</option>
          <option value="belum">Belum Verifikasi</option>
          <option value="verified">Terverifikasi</option>
          <option value="partial">Sebagian</option>
          <option value="paid">Lunas</option>
        </select>
        <div className="card px-5 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Total Outstanding</p>
          <p className="text-2xl font-black tabular-nums tracking-tight text-danger">{formatIDR(outstanding)}</p>
        </div>
        <div className="card px-5 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Belum Verifikasi</p>
          <p className="text-2xl font-black tabular-nums tracking-tight">{belumVerif}</p>
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
                  <td className="py-2.5 pr-3 font-medium text-muted-foreground">{r.invoiceDate ?? "—"}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{formatIDR(r.total)}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-emerald-700">{r.paid > 0 ? formatIDR(r.paid) : "—"}</td>
                  <td className="py-2.5 pr-3"><ApBadge r={r} /></td>
                  <td className="py-2.5 pr-4 text-right"><Button variant="outline" size="sm" onClick={() => setDetail(r)}><Eye className="h-4 w-4" /> Detail</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openDetail && <APDetailModal payable={openDetail} canEdit={canEdit} onClose={() => setDetail(null)} />}
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

function APDetailModal({ payable, canEdit, onClose }: { payable: Payable; canEdit: boolean; onClose: () => void }) {
  const r = payable;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const out = Math.max(0, r.total - r.paid);
  const st = apState(r);
  const canToggleVerif = canEdit && (st === "belum" || st === "verified");

  function doVerify(on: boolean) {
    setErr(null);
    start(async () => {
      const res = on ? await verifyPayable(r.invoiceNo) : await unverifyPayable(r.invoiceNo);
      if (!res.ok) { setErr(res.error); return; }
      router.refresh();
    });
  }

  const footer = (
    <>
      {canToggleVerif && (st === "belum" ? (
        <Button size="sm" disabled={pending} onClick={() => doVerify(true)}><ShieldCheck className="h-4 w-4" /> {pending ? "Memproses…" : "Verifikasi Finance"}</Button>
      ) : (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => doVerify(false)}>{pending ? "Memproses…" : "Batalkan Verifikasi"}</Button>
      ))}
      <Button size="sm" variant="ghost" onClick={onClose}>Tutup</Button>
    </>
  );

  return (
    <Modal
      size="lg"
      onClose={onClose}
      badge={<ApBadge r={r} />}
      title={<span className="font-mono">{r.invoiceNo}</span>}
      subtitle={r.refType === "production_invoice" ? "Jasa Produksi" : "Bahan / Material"}
      footer={footer}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Supplier / Vendor">{r.party}</Field>
        <Field label="Brand">{r.brand}</Field>
        <Field label="Tgl Invoice">{r.invoiceDate ?? "—"}</Field>
        <Field label="Total">{formatIDR(r.total)}</Field>
        <Field label="Dibayar">{r.paid > 0 ? formatIDR(r.paid) : "—"}</Field>
        <Field label="Outstanding">{formatIDR(out)}</Field>
      </div>

      <div className={"rounded-xl border px-4 py-3 text-sm font-semibold " + (st === "belum" ? "border-danger/30 bg-danger/5 text-danger" : st === "verified" ? "border-sky-300 bg-alice/40 text-eerie" : "border-emerald-300 bg-honeydew/40 text-eerie")}>
        {st === "belum" && "Belum diverifikasi finance. Verifikasi dulu agar bisa masuk antrian Finance Desk & dibayar."}
        {st === "verified" && "Sudah diverifikasi finance — siap masuk Finance Desk. Pembayaran dilakukan di tab Payment Today (status jadi Lunas otomatis setelah dibayar)."}
        {st === "partial" && "Sudah dibayar sebagian. Sisa tagihan menunggu pembayaran di Payment Today."}
        {st === "paid" && "Sudah lunas."}
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
        {err && <p className="mt-2 text-sm font-semibold text-danger">{err} — pastikan tabel ap_verifications sudah dibuat (supabase/sql/ap_verification.sql).</p>}
      </div>
    </Modal>
  );
}
