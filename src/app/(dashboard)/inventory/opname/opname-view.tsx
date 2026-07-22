"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, ClipboardCheck, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatIDR } from "@/lib/utils";
import { adjustStock, type OpnameLine } from "./actions";

export type Opt = { id: string; name: string };
export type OpnameRow = { variantId: string; warehouseId: string; stockStatus: string; sku: string; product: string; brand: string; warehouse: string; qtySystem: number; avgCost: number };

const keyOf = (r: OpnameRow) => `${r.variantId}|${r.warehouseId}|${r.stockStatus}`;

export function OpnameView({ rows, warehouses, canEdit = true }: { rows: OpnameRow[]; warehouses: Opt[]; canEdit?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [wh, setWh] = useState("");
  const [note, setNote] = useState("");
  const [fisik, setFisik] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const query = q.trim().toLowerCase();

  const list = useMemo(() => rows.filter((r) =>
    (!wh || r.warehouse === wh) && (!query || `${r.sku} ${r.product} ${r.warehouse}`.toLowerCase().includes(query))
  ), [rows, wh, query]);

  const setVal = (k: string, v: string) => setFisik((p) => ({ ...p, [k]: v }));

  // Baris yang diisi & berbeda dari sistem.
  const changed = useMemo(() => {
    const out: { row: OpnameRow; qtyFisik: number; delta: number }[] = [];
    for (const r of rows) {
      const raw = fisik[keyOf(r)];
      if (raw === undefined || raw === "") continue;
      const qtyFisik = Number(raw);
      if (!Number.isFinite(qtyFisik) || qtyFisik < 0) continue;
      const delta = qtyFisik - r.qtySystem;
      if (Math.abs(delta) > 0.0001) out.push({ row: r, qtyFisik, delta });
    }
    return out;
  }, [rows, fisik]);

  const selisihValue = changed.reduce((s, c) => s + c.delta * c.row.avgCost, 0);

  function submit() {
    setError(null); setSaved(null);
    if (changed.length === 0) { setError("Belum ada qty fisik yang berbeda dari sistem."); return; }
    const lines: OpnameLine[] = changed.map((c) => ({ variantId: c.row.variantId, warehouseId: c.row.warehouseId, stockStatus: c.row.stockStatus, qtyFisik: c.qtyFisik }));
    start(async () => {
      const res = await adjustStock({ note, lines });
      if (!res.ok) { setError(res.error); return; }
      setSaved(res.count); setFisik({}); router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Inventory</p>
          <h1 className="text-2xl font-extrabold">Stock Opname / Penyesuaian</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">Isi <b>Qty Fisik</b> hasil hitung. Sistem mencatat selisihnya sebagai penyesuaian &amp; menyamakan stok. Kosongkan baris yang tidak dihitung.</p>
        </div>
      </div>

      {saved != null && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"><CheckCircle2 className="mr-1 inline h-4 w-4" /> {saved} baris disesuaikan. Tercatat di Log Pergerakan (jenis: Penyesuaian).</div>}

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari SKU / produk…" className={inp + " pl-9"} />
        </div>
        <select value={wh} onChange={(e) => setWh(e.target.value)} className={sel}><option value="">Semua Gudang</option>{warehouses.map((w) => <option key={w.id} value={w.name}>{w.name}</option>)}</select>
      </div>

      {!canEdit && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700">Mode lihat saja — kamu tidak punya akses melakukan penyesuaian stok.</div>}

      {list.length === 0 ? (
        <div className="card p-10 text-center text-sm font-medium text-muted-foreground">Tidak ada stok yang cocok.</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <th className="py-2.5 pl-4 pr-3">SKU / Produk</th><th className="py-2.5 pr-3">Gudang</th><th className="py-2.5 pr-3">Status</th>
                <th className="py-2.5 pr-3 text-right">Qty Sistem</th><th className="py-2.5 pr-3 text-right">Qty Fisik</th><th className="py-2.5 pr-3 text-right">Selisih</th><th className="py-2.5 pr-4 text-right">COGM</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => {
                const k = keyOf(r);
                const raw = fisik[k];
                const has = raw !== undefined && raw !== "";
                const delta = has ? (Number(raw) || 0) - r.qtySystem : 0;
                return (
                  <tr key={k} className={cn("border-t border-border/60 font-semibold", has && Math.abs(delta) > 0.0001 && "bg-amber-50/60")}>
                    <td className="py-2 pl-4 pr-3"><span className="font-mono text-xs">{r.sku}</span><div className="text-xs font-medium text-muted-foreground">{r.product}</div></td>
                    <td className="py-2 pr-3 font-medium text-muted-foreground">{r.warehouse}</td>
                    <td className="py-2 pr-3">{r.stockStatus === "damaged" ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">Damage</span> : <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">Good</span>}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.qtySystem}</td>
                    <td className="py-2 pr-3 text-right">
                      <input type="number" step="any" min={0} value={raw ?? ""} disabled={!canEdit} onChange={(e) => setVal(k, e.target.value)}
                        placeholder={String(r.qtySystem)} className="h-9 w-24 rounded-lg border border-border bg-background px-2 text-right text-sm font-bold outline-none focus:border-primary/40 disabled:bg-muted/40" />
                    </td>
                    <td className={cn("py-2 pr-3 text-right tabular-nums font-black", !has ? "text-muted-foreground" : delta > 0 ? "text-emerald-700" : delta < 0 ? "text-danger" : "text-muted-foreground")}>{has ? (delta > 0 ? `+${delta}` : delta) : "—"}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">{formatIDR(r.avgCost)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {canEdit && (
        <div className="card flex flex-wrap items-end justify-between gap-3 p-4">
          <div className="min-w-[240px] flex-1">
            <label className="mb-1.5 block text-sm font-bold">Alasan / Keterangan Opname</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="mis. Opname akhir bulan / barang rusak / selisih hitung" className={inp} />
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-muted-foreground">{changed.length} baris berubah · nilai selisih {formatIDR(selisihValue)}</p>
            <Button size="sm" className="mt-1.5" onClick={submit} disabled={pending || changed.length === 0}>
              <ClipboardCheck className="h-4 w-4" /> {pending ? "Memproses…" : `Proses Opname (${changed.length})`}
            </Button>
          </div>
        </div>
      )}
      {error && <p className="text-sm font-semibold text-danger">{error}</p>}
    </div>
  );
}

const inp = "h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none focus:border-primary/40";
const sel = "h-10 rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none focus:border-primary/40";
