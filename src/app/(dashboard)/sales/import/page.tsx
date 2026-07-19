import { UploadCloud, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const STEPS = ["Upload", "Petakan Kolom", "Validasi", "Commit"];
const MAPPING = [
  { file: "tgl_jual", field: "sale_date", ok: true },
  { file: "kode", field: "sku", ok: true },
  { file: "jml", field: "qty", ok: false, note: "2 SKU tak dikenal" },
  { file: "harga", field: "unit_price", ok: true },
];

export default function SalesImportPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Sales</p>
        <h1 className="text-2xl font-extrabold">Impor Penjualan Harian (H+1)</h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          Unggah rekap penjualan dari platform channel. Saat di-commit, stok &amp; jurnal (revenue + COGS) dibuat otomatis.
        </p>
      </div>

      {/* stepper */}
      <div className="flex gap-2">
        {STEPS.map((s, i) => (
          <div
            key={s}
            data-active={i === 1}
            className="flex-1 rounded-xl border border-border bg-surface py-2.5 text-center text-xs font-bold text-muted-foreground data-[active=true]:border-primary data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
          >
            {i + 1} · {s}
          </div>
        ))}
      </div>

      <div className="card space-y-5">
        {/* dropzone */}
        <div className="rounded-2xl border-2 border-dashed border-border p-8 text-center">
          <UploadCloud className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-bold">Seret file CSV atau tarik dari Google Sheet</p>
          <p className="mt-1 text-xs font-medium text-muted-foreground">
            Template: tanggal · channel · SKU · qty · harga · diskon
          </p>
          <Button variant="outline" size="sm" className="mt-4">Pilih File</Button>
        </div>

        {/* mapping */}
        <div>
          <p className="mb-2 text-sm font-extrabold">Petakan kolom</p>
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5">Kolom File</th>
                  <th className="px-4 py-2.5">Field Sistem</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {MAPPING.map((m) => (
                  <tr key={m.file} className="border-t border-border font-semibold">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{m.file}</td>
                    <td className="px-4 py-3">{m.field}</td>
                    <td className="px-4 py-3">
                      {m.ok ? (
                        <Badge tone="success">OK</Badge>
                      ) : (
                        <Badge tone="danger">{m.note}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end gap-2.5">
          <Button variant="ghost" size="sm">Batal</Button>
          <Button size="sm">
            Lanjut Validasi <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
