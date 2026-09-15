"use client";

import { useState, useTransition } from "react";
import {
  ShoppingBag, Calculator, Boxes, Package, FileText, Factory, Truck,
  ClipboardCheck, ReceiptText, ArrowLeftRight, Wallet, Send, Download, ChevronLeft, BarChart3,
} from "lucide-react";
import { REPORT_META, type ReportKey, type ReportMeta, type ReportResult } from "./reports-meta";
import { runReport } from "./actions";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  ShoppingBag, Calculator, Boxes, Package, FileText, Factory, Truck,
  ClipboardCheck, ReceiptText, ArrowLeftRight, Wallet, Send,
};

const fmtNum = (v: number) => v.toLocaleString("id-ID", { maximumFractionDigits: 2 });

function toCSV(columns: { label: string }[], rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const header = columns.map((c) => esc(c.label)).join(",");
  const body = rows.map((r) => r.map(esc).join(",")).join("\n");
  return header + "\n" + body;
}

function download(filename: string, csv: string) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function LaporanView() {
  const [active, setActive] = useState<ReportMeta | null>(null);

  if (!active) {
    return (
      <div className="space-y-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Analitik &amp; Laporan</p>
          <h1 className="text-2xl font-extrabold">Laporan</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            Tarik data lengkap dari semua modul · generate untuk dilihat dulu, lalu export ke CSV/Excel.
          </p>
        </div>
        <p className="text-sm font-semibold text-muted-foreground">Pilih jenis laporan yang ingin dibuat:</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {REPORT_META.map((rm) => {
            const Icon = ICONS[rm.icon] ?? BarChart3;
            return (
              <button key={rm.key} onClick={() => setActive(rm)}
                className="card group flex flex-col items-start gap-3 p-5 text-left transition hover:border-primary/40 hover:shadow-soft">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-muted text-foreground transition group-hover:bg-vanila">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-base font-extrabold leading-tight">{rm.title}</p>
                  <p className="mt-1 text-sm font-medium text-muted-foreground">{rm.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return <ReportDetail meta={active} onBack={() => setActive(null)} />;
}

function ReportDetail({ meta, onBack }: { meta: ReportMeta; onBack: () => void }) {
  const Icon = ICONS[meta.icon] ?? BarChart3;
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [result, setResult] = useState<ReportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function generate() {
    setError(null);
    start(async () => {
      try {
        const res = await runReport(meta.key, meta.hasDate ? { from: from || undefined, to: to || undefined } : undefined);
        setResult(res);
      } catch {
        setError("Gagal menarik data. Coba lagi.");
      }
    });
  }

  function onDownload() {
    if (!result) return;
    download(`${meta.key}-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(result.columns, result.rows));
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Semua laporan
      </button>

      <div className="card p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-muted"><Icon className="h-5 w-5" /></span>
          <div>
            <h2 className="text-lg font-extrabold leading-tight">{meta.title}</h2>
            <p className="mt-0.5 text-sm font-medium text-muted-foreground">{meta.desc}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          {meta.hasDate && (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Dari Tanggal</span>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                  className="h-11 rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none focus:border-primary/40" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Sampai Tanggal</span>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                  className="h-11 rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none focus:border-primary/40" />
              </label>
              <span className="pb-2 text-xs font-medium text-muted-foreground">Filter berdasarkan <b>{meta.dateLabel ?? "tanggal"}</b>. Kosongkan = semua periode.</span>
            </>
          )}
          <button onClick={generate} disabled={pending}
            className="ml-auto inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {pending ? "Memproses…" : "Buat Laporan"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm font-semibold text-danger">{error}</p>}
      </div>

      {result && (
        <div className="card overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
            <h3 className="text-base font-extrabold">Hasil · {result.rows.length} baris</h3>
            <button onClick={onDownload} disabled={result.rows.length === 0}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-eerie px-4 text-sm font-bold text-white hover:opacity-90 disabled:opacity-40">
              <Download className="h-4 w-4" /> Download CSV
            </button>
          </div>
          {result.rows.length === 0 ? (
            <p className="p-10 text-center text-sm font-medium text-muted-foreground">Tidak ada data untuk filter ini.</p>
          ) : (
            <div className="max-h-[65vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface">
                  <tr className="text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {result.columns.map((c, i) => (
                      <th key={i} className={"whitespace-nowrap px-4 py-3 " + (c.numeric ? "text-right" : "")}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.slice(0, 500).map((row, ri) => (
                    <tr key={ri} className="border-t border-border font-medium">
                      {row.map((cell, ci) => {
                        const numeric = result.columns[ci]?.numeric;
                        return (
                          <td key={ci} className={"whitespace-nowrap px-4 py-2.5 " + (numeric ? "text-right tabular-nums" : "")}>
                            {numeric ? fmtNum(Number(cell)) : String(cell ?? "")}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.rows.length > 500 && (
                <p className="border-t border-border p-3 text-center text-xs font-medium text-muted-foreground">
                  Menampilkan 500 baris pertama · download CSV untuk semua {result.rows.length} baris.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
