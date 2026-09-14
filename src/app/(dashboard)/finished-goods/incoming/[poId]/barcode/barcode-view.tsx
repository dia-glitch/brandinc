"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export type LabelSku = { sku: string; size: string; qtyPo: number; received: number; retail: number };
export type BarcodeInfo = { poId: string; poCode: string; spkCode: string; product: string; supplier: string; defaultPrice: number };

const idr = (n: number) => n.toLocaleString("id-ID");

export function BarcodeView({ info, skus }: { info: BarcodeInfo; skus: LabelSku[] }) {
  const [price, setPrice] = useState(String(info.defaultPrice || ""));
  const [counts, setCounts] = useState<Record<string, number>>(() => Object.fromEntries(skus.map((s) => [s.sku, s.received])));

  const setAll = (fn: (s: LabelSku) => number) => setCounts(Object.fromEntries(skus.map((s) => [s.sku, fn(s)])));
  const setOne = (sku: string, v: string) => setCounts((c) => ({ ...c, [sku]: Math.max(0, Math.floor(Number(v) || 0)) }));

  const labels = useMemo(() => {
    const out: LabelSku[] = [];
    for (const s of skus) { const n = counts[s.sku] ?? 0; for (let i = 0; i < n; i++) out.push(s); }
    return out;
  }, [skus, counts]);

  const priceNum = Number(price) || 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <style>{PRINT_CSS}</style>

      <div className="bc-noprint flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href={`/finished-goods/incoming/${info.poId}`} className="grid h-10 w-10 place-items-center rounded-full border border-border hover:bg-muted"><ArrowLeft className="h-4 w-4" /></Link>
          <div>
            <h1 className="text-2xl font-extrabold">Cetak Barcode</h1>
            <p className="text-xs text-muted-foreground">Label hangtag 40×20mm · QR = kode SKU</p>
          </div>
        </div>
        <Button onClick={() => window.print()} disabled={labels.length === 0}><Printer className="h-4 w-4" /> Print {labels.length} Label</Button>
      </div>

      {/* Info + harga */}
      <div className="bc-noprint card grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 lg:grid-cols-5">
        <Info label="PO Number" value={info.poCode} mono />
        <Info label="SPK" value={info.spkCode} mono />
        <Info label="Product" value={info.product} />
        <Info label="Supplier" value={info.supplier} />
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Harga (di label)</p>
          <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric"
            className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2 text-sm font-bold outline-none focus:border-primary/40" />
          <p className="mt-1 text-[10px] font-medium text-muted-foreground">otomatis dari Retail Price di COGM · bisa di-override</p>
        </div>
      </div>

      {/* Jumlah per size */}
      <div className="bc-noprint card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-extrabold">Jumlah Label per Size</h2>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setAll((s) => s.received)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold hover:bg-muted">= Qty diterima</button>
            <button onClick={() => setAll((s) => s.qtyPo)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold hover:bg-muted">= Qty PO</button>
            <button onClick={() => setAll(() => 0)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold hover:bg-muted">Kosongkan</button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {skus.map((s) => (
            <div key={s.sku}>
              <p className="text-xs font-bold">{s.sku} <span className="font-medium text-muted-foreground">· {s.size || "—"}</span></p>
              <p className="text-[10px] font-medium text-muted-foreground">PO {s.qtyPo} · Terima {s.received}</p>
              <input type="number" value={counts[s.sku] ?? 0} onChange={(e) => setOne(s.sku, e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2 text-sm font-bold outline-none focus:border-primary/40" />
            </div>
          ))}
          {skus.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada SKU pada PO ini.</p>}
        </div>
      </div>

      <p className="bc-noprint text-sm font-medium text-muted-foreground">Preview label ({labels.length}) — saat Print, tiap label = 1 halaman 40×20mm:</p>

      {/* Sheet (juga target print) */}
      <div className="bc-sheet">
        {labels.map((s, i) => (
          <div key={i} className="bc-label">
            <div className="bc-qr"><QRCodeSVG value={s.sku} size={64} level="M" /></div>
            <div className="bc-info">
              <div className="bc-name">{info.product}</div>
              <div className="bc-sku"><span className="bc-size">{s.size || "-"}</span>{s.sku}</div>
              <div className="bc-price">IDR {idr(priceNum)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={"mt-0.5 break-words font-bold " + (mono ? "font-mono text-sm" : "")}>{value}</p>
    </div>
  );
}

const PRINT_CSS = `
.bc-sheet { display: flex; flex-wrap: wrap; gap: 8px; }
.bc-label {
  display: flex; align-items: center; gap: 6px;
  width: 220px; height: 110px; padding: 6px;
  border: 1px solid #e5e5e5; border-radius: 8px; background: #fff; overflow: hidden;
}
.bc-qr { width: 84px; height: 84px; flex-shrink: 0; }
.bc-qr svg { width: 100%; height: 100%; }
.bc-info { min-width: 0; flex: 1; }
.bc-name { font-size: 11px; font-weight: 800; line-height: 1.05; color: #111; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.bc-sku { margin-top: 3px; font-family: ui-monospace, monospace; font-size: 10px; font-weight: 700; color: #111; }
.bc-size { display: inline-block; margin-right: 4px; padding: 0 4px; border: 1px solid #111; border-radius: 3px; font-family: inherit; font-size: 9px; font-weight: 800; }
.bc-price { margin-top: 3px; font-size: 12px; font-weight: 900; color: #111; }
@media print {
  @page { size: 40mm 20mm; margin: 0; }
  body { background: #fff !important; }
  .bc-noprint { display: none !important; }
  body * { visibility: hidden; }
  .bc-sheet, .bc-sheet * { visibility: visible; }
  .bc-sheet { position: absolute; left: 0; top: 0; display: block; gap: 0; }
  .bc-label {
    width: 40mm; height: 20mm; padding: 1mm; gap: 1mm;
    border: none; border-radius: 0; box-shadow: none;
    page-break-after: always; break-after: page;
  }
  .bc-qr { width: 17mm; height: 17mm; }
  .bc-name { font-size: 6pt; }
  .bc-sku { font-size: 5.5pt; margin-top: 1pt; }
  .bc-size { font-size: 5pt; }
  .bc-price { font-size: 7pt; margin-top: 1pt; }
}
`;
