import { Plus, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettingsTabs } from "../tabs";
import { ResetDemoButton } from "./reset-demo-button";

const SETS = [
  { name: "Sample Produk & Stok", rows: "1.240", date: "12 Jul" },
  { name: "Sample Penjualan", rows: "3.510", date: "12 Jul" },
  { name: "Jurnal & Stok turunan", rows: "auto", date: "—" },
];

export default function DataManagementPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <SettingsTabs />
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Settings</p>
        <h1 className="text-2xl font-extrabold">🧪 Data Management</h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          Kelola data sample untuk testing. Semua terisolasi di Company DEMO — aman dihapus, tak menyentuh data/logic asli.
        </p>
      </div>

      <div className="rounded-2xl border border-vanila bg-vanila/25 p-4 text-sm font-semibold text-eerie">
        Anda sedang di <b>Company: DEMO</b>. Data di sini terpisah penuh dari data produksi.
      </div>

      <div className="flex flex-wrap gap-2.5">
        <Button size="sm" disabled title="Segera hadir"><Plus className="h-4 w-4" /> Muat Data Sample</Button>
        <Button variant="outline" size="sm" disabled title="Segera hadir"><Download className="h-4 w-4" /> Ekspor Data Demo</Button>
      </div>

      <div className="card p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <th className="px-5 py-3">Set Data</th>
              <th className="px-5 py-3 text-right">Baris</th>
              <th className="px-5 py-3">Dibuat</th>
            </tr>
          </thead>
          <tbody>
            {SETS.map((s) => (
              <tr key={s.name} className="border-t border-border font-semibold">
                <td className="px-5 py-4">{s.name}</td>
                <td className="px-5 py-4 text-right tabular-nums text-muted-foreground">{s.rows}</td>
                <td className="px-5 py-4 font-medium text-muted-foreground">{s.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Danger zone */}
      <div className="rounded-2xl border border-danger/40 bg-danger/5 p-5">
        <p className="flex items-center gap-2 font-extrabold text-danger">Reset Semua Data Demo</p>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          Menghapus SELURUH data <b>transaksi</b> &amp; saldo turunan di Company DEMO (penjualan, retur, piutang, pembelian,
          produksi, jurnal, pergerakan &amp; saldo stok), <b>menol-kan saldo awal kas/bank</b> (Kas &amp; Bank + Laba Ditahan di Neraca jadi 0),
          serta <b>mengosongkan foto katalog &amp; launch date</b> produk. <b>Master data (materials, produk, SKU, supplier) &amp; COA tetap; akun kas/bank tetap ada.</b> Hanya admin.
        </p>
        <ResetDemoButton />
      </div>
    </div>
  );
}
