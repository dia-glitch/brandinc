"use client";

import { useState, useMemo } from "react";
import { Search, Download, ArrowLeftRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatIDR } from "@/lib/utils";

export type Mutation = {
  id: string; accountId: string | null; account: string; date: string | null; direction: string; amount: number;
  method: string | null; refType: string | null; ref: string; desc: string; isTransfer: boolean; createdAt: string | null;
};
export type AccountOpt = { id: string; name: string; opening: number };

function todayStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function monthStart() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; }
const sortKey = (m: Mutation) => `${m.date ?? m.createdAt ?? ""}|${m.createdAt ?? ""}`;

export function MutasiView({ mutations, accounts }: { mutations: Mutation[]; accounts: AccountOpt[] }) {
  const [q, setQ] = useState("");
  const [accId, setAccId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const singleAccount = accId ? accounts.find((a) => a.id === accId) ?? null : null;

  // Saldo berjalan: hanya bermakna bila 1 akun dipilih. Hitung dari saldo awal, urut menaik.
  const runningById = useMemo(() => {
    const map = new Map<string, number>();
    if (!singleAccount) return map;
    const rows = mutations.filter((m) => m.accountId === singleAccount.id).slice().sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    let bal = singleAccount.opening;
    for (const m of rows) { bal += m.direction === "in" ? m.amount : -m.amount; map.set(m.id, bal); }
    return map;
  }, [mutations, singleAccount]);

  const query = q.trim().toLowerCase();
  const list = useMemo(() => mutations
    .filter((m) => !accId || m.accountId === accId)
    .filter((m) => !from || (m.date ?? "") >= from)
    .filter((m) => !to || (m.date ?? "") <= to)
    .filter((m) => !query || m.desc.toLowerCase().includes(query) || m.ref.toLowerCase().includes(query) || m.account.toLowerCase().includes(query))
    .slice()
    .sort((a, b) => sortKey(b).localeCompare(sortKey(a))), [mutations, accId, from, to, query]);

  const totalDebit = list.reduce((s, m) => s + (m.direction === "in" ? m.amount : 0), 0);
  const totalKredit = list.reduce((s, m) => s + (m.direction === "out" ? m.amount : 0), 0);

  function download() {
    const head = ["Tanggal", "Akun", "Keterangan", "Referensi", "Metode", "Debit (Masuk)", "Kredit (Keluar)"];
    const lines = list.map((m) => [
      m.date ?? "", m.account, m.desc, m.ref === "—" ? "" : m.ref, m.method ?? "",
      m.direction === "in" ? m.amount : "", m.direction === "out" ? m.amount : "",
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const csv = "﻿" + [head.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `mutasi-kas${accId ? "-" + (singleAccount?.name ?? "") : ""}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Finance</p>
          <h1 className="text-2xl font-extrabold">Mutasi Kas</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">Buku kas masuk/keluar semua akun. Pindah buku antar akun ditandai khusus &amp; tidak dihitung sebagai pemasukan.</p>
        </div>
        <button onClick={download} disabled={list.length === 0} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-bold hover:bg-muted disabled:opacity-50"><Download className="h-4 w-4" /> Download CSV</button>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari keterangan / referensi…" className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm font-medium outline-none focus:border-primary/40" />
        </div>
        <select value={accId} onChange={(e) => setAccId(e.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none focus:border-primary/40">
          <option value="">Semua Akun</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <div className="flex items-center gap-1.5 text-sm">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 rounded-xl border border-border bg-background px-2.5 text-sm font-medium outline-none focus:border-primary/40" />
          <span className="text-muted-foreground">s/d</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 rounded-xl border border-border bg-background px-2.5 text-sm font-medium outline-none focus:border-primary/40" />
        </div>
        <button onClick={() => { setFrom(todayStr()); setTo(todayStr()); }} className="h-10 rounded-xl border border-border px-3 text-sm font-bold hover:bg-muted">Hari Ini</button>
        <button onClick={() => { setFrom(monthStart()); setTo(todayStr()); }} className="h-10 rounded-xl border border-border px-3 text-sm font-bold hover:bg-muted">Bulan Ini</button>
        {(from || to || accId || q) && <button onClick={() => { setFrom(""); setTo(""); setAccId(""); setQ(""); }} className="h-10 rounded-xl border border-border px-3 text-sm font-bold hover:bg-muted">Reset</button>}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="card px-4 py-2.5"><p className="text-xs font-bold uppercase text-muted-foreground">Total Debit (Masuk)</p><p className="text-lg font-black tabular-nums text-emerald-700">{formatIDR(totalDebit)}</p></div>
        <div className="card px-4 py-2.5"><p className="text-xs font-bold uppercase text-muted-foreground">Total Kredit (Keluar)</p><p className="text-lg font-black tabular-nums text-danger">{formatIDR(totalKredit)}</p></div>
        <div className="card px-4 py-2.5"><p className="text-xs font-bold uppercase text-muted-foreground">Selisih</p><p className="text-lg font-black tabular-nums">{formatIDR(totalDebit - totalKredit)}</p></div>
      </div>

      {list.length === 0 ? (
        <div className="card p-10 text-center text-sm font-medium text-muted-foreground">Belum ada mutasi pada filter ini.</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <th className="py-2.5 pl-4 pr-3">Tgl</th>
                <th className="py-2.5 pr-3">Akun</th>
                <th className="py-2.5 pr-3">Keterangan</th>
                <th className="py-2.5 pr-3">Referensi</th>
                <th className="py-2.5 pr-3">Metode</th>
                <th className="py-2.5 pr-3 text-right">Debit</th>
                <th className="py-2.5 pr-3 text-right">Kredit</th>
                {singleAccount && <th className="py-2.5 pr-4 text-right">Saldo</th>}
              </tr>
            </thead>
            <tbody>
              {list.map((m) => (
                <tr key={m.id} className="border-t border-border font-semibold hover:bg-muted/40">
                  <td className="py-2.5 pl-4 pr-3 font-medium text-muted-foreground">{m.date ?? "—"}</td>
                  <td className="py-2.5 pr-3">{m.account}</td>
                  <td className="py-2.5 pr-3">
                    <span className="inline-flex items-center gap-1.5">{m.isTransfer && <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground" />}{m.desc}{m.isTransfer && <Badge tone="neutral">internal</Badge>}</span>
                  </td>
                  <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">{m.ref}</td>
                  <td className="py-2.5 pr-3 font-medium text-muted-foreground">{m.method ?? "—"}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-emerald-700">{m.direction === "in" ? formatIDR(m.amount) : "—"}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-danger">{m.direction === "out" ? formatIDR(m.amount) : "—"}</td>
                  {singleAccount && <td className="py-2.5 pr-4 text-right tabular-nums">{runningById.has(m.id) ? formatIDR(runningById.get(m.id)!) : "—"}</td>}
                </tr>
              ))}
              <tr className="border-t-2 border-border bg-muted/40 font-extrabold">
                <td className="py-2.5 pl-4 pr-3" colSpan={5}>Total ({list.length} transaksi)</td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-emerald-700">{formatIDR(totalDebit)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-danger">{formatIDR(totalKredit)}</td>
                {singleAccount && <td className="py-2.5 pr-4"></td>}
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {!singleAccount && <p className="text-xs font-medium text-muted-foreground">Pilih satu akun untuk melihat kolom Saldo berjalan.</p>}
    </div>
  );
}
