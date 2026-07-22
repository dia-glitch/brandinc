"use client";

import { useState } from "react";
import {
  LayoutDashboard, Boxes, Warehouse, CreditCard, PackageOpen, Factory, Truck, Store,
  Wallet, BookText, Settings, Users, ArrowRight, TrendingUp, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Badge akses → warna (mengikuti matriks role).
type Tag = "view" | "admin" | "sales" | "finance" | "produksi" | "purchasing" | "gudang" | "outbound";
const TAG_STYLE: Record<Tag, { label: string; cls: string }> = {
  view: { label: "Lihat: semua", cls: "bg-muted text-muted-foreground" },
  admin: { label: "Admin", cls: "bg-primary text-primary-foreground" },
  sales: { label: "MD Sales", cls: "bg-blue-100 text-blue-700" },
  finance: { label: "Finance", cls: "bg-emerald-100 text-emerald-700" },
  produksi: { label: "Produksi (Designer/R&D/MDP)", cls: "bg-amber-100 text-amber-700" },
  purchasing: { label: "Purchasing", cls: "bg-violet-100 text-violet-700" },
  gudang: { label: "Gudang / QC", cls: "bg-teal-100 text-teal-700" },
  outbound: { label: "Outbound", cls: "bg-orange-100 text-orange-700" },
};

type Card = { n: string; icon: LucideIcon; title: string; tags: Tag[]; desc: string; bullets?: string[] };
type Group = { key: string; label: string; cards: Card[] };

const GROUPS: Group[] = [
  {
    key: "alur", label: "Alur Umum",
    cards: [
      { n: "01", icon: Boxes, title: "Master Data", tags: ["admin", "view"], desc: "Fondasi sistem — disiapkan sekali di awal.", bullets: ["Brand, kategori, warna, ukuran", "Produk & SKU, gudang, supplier", "Akun penjualan (channel) & COA"] },
      { n: "02", icon: PackageOpen, title: "Raw Material", tags: ["purchasing", "produksi"], desc: "Kelola bahan baku sebelum produksi.", bullets: ["Stok bahan & master material", "PO bahan / pembelian tunai"] },
      { n: "03", icon: Factory, title: "Production", tags: ["produksi"], desc: "Ubah bahan jadi barang jadi + hitung biaya.", bullets: ["SPK & PO produksi", "Material issue (pemakaian bahan)", "COGM (harga pokok produksi)"] },
      { n: "04", icon: Store, title: "Finished Goods", tags: ["gudang"], desc: "Terima barang jadi dari produksi.", bullets: ["Incoming & QC (Good / Damage)", "Stok masuk & terkunci di rekap"] },
      { n: "05", icon: Warehouse, title: "Inventory", tags: ["admin", "view"], desc: "Pantau & sesuaikan stok berjalan.", bullets: ["Stok per lokasi & katalog SKU", "Log pergerakan & Stock Opname"] },
      { n: "06", icon: CreditCard, title: "Sales", tags: ["sales"], desc: "Jual per produk — stok & keuangan auto ter-update.", bullets: ["Kurangi stok + catat COGS", "Piutang (AR) / marketplace"] },
      { n: "07", icon: Truck, title: "Distribution", tags: ["sales", "outbound"], desc: "Pindah stok antar gudang / store.", bullets: ["Request → Picking/Packing → Surat Jalan → Transfer", "Tab Anomali untuk selisih opname"] },
      { n: "08", icon: Wallet, title: "Finance", tags: ["finance"], desc: "Tagih, terima, dan bayar.", bullets: ["AR (piutang) & AP (hutang)", "Payment Request, Expenses, Kas & Bank"] },
      { n: "09", icon: BookText, title: "Accounting", tags: ["finance"], desc: "Laporan keuangan otomatis dari transaksi.", bullets: ["Neraca, Laba Rugi, Arus Kas", "Bagan Akun (COA)"] },
      { n: "10", icon: LayoutDashboard, title: "Dashboard", tags: ["view"], desc: "Ringkasan kinerja real-time — penjualan, laba, stok, produk terlaris." },
    ],
  },
  {
    key: "operasional", label: "Operasional",
    cards: [
      { n: "01", icon: Boxes, title: "Master Data", tags: ["admin", "view"], desc: "Kelola data acuan yang dipakai seluruh modul.", bullets: ["Brand, kategori, warna, ukuran", "Supplier, gudang, akun penjualan"] },
      { n: "02", icon: Warehouse, title: "Inventory", tags: ["admin", "view"], desc: "Stok barang jadi per lokasi & penyesuaian.", bullets: ["Katalog / Master · Stok per Lokasi", "Log Pergerakan (riwayat masuk/keluar)", "Stock Opname (hitung fisik → sesuaikan)"] },
      { n: "03", icon: CreditCard, title: "Sales", tags: ["sales"], desc: "Penjualan per SKU; mengurangi stok & mencatat COGS + AR.", bullets: ["Penjualan (harga jual, diskon, komisi)", "Retur penjualan & Ledger SKU", "Upload bulk"] },
      { n: "04", icon: PackageOpen, title: "Raw Material", tags: ["purchasing", "produksi"], desc: "Bahan baku & pembeliannya.", bullets: ["Stok bahan · Master material", "PO bahan · Pembelian tunai"] },
      { n: "05", icon: Factory, title: "Production", tags: ["produksi"], desc: "Proses produksi & harga pokok.", bullets: ["Product & SKU · SPK · PO Produksi", "Material Issue · COGM"] },
      { n: "06", icon: Truck, title: "Distribution", tags: ["sales", "outbound"], desc: "Pemindahan stok berstatus dengan surat jalan.", bullets: ["Request (MD Sales) → Proses (Outbound)", "Isi qty real + alasan selisih → Anomali", "Cetak Surat Jalan → Transfer Lokasi"] },
      { n: "07", icon: Store, title: "Finished Goods", tags: ["gudang"], desc: "Penerimaan & QC barang jadi.", bullets: ["Stok rekap (terkunci)", "Incoming & QC (Good / Damage)"] },
    ],
  },
  {
    key: "keuangan", label: "Keuangan",
    cards: [
      { n: "01", icon: Wallet, title: "Finance", tags: ["finance"], desc: "Pusat kas, tagihan, dan pengeluaran.", bullets: ["Hutang (AP) & Piutang (AR)", "Payment Request → review → bayar", "Expenses, Refund, Kas & Bank, Mutasi, Ringkasan"] },
      { n: "02", icon: CreditCard, title: "Payment Request", tags: ["finance", "view"], desc: "Pengajuan pembayaran (cash advance / reimburse / invoice).", bullets: ["Siapa pun boleh mengajukan (Pemohon otomatis)", "Review, setujui, bayar → hanya Finance/Admin"] },
      { n: "03", icon: BookText, title: "Accounting", tags: ["finance"], desc: "Laporan keuangan yang tersusun otomatis.", bullets: ["Neraca · Laba Rugi (per brand) · Arus Kas", "Bagan Akun (COA) — sumber kategori biaya"] },
    ],
  },
  {
    key: "sistem", label: "Sistem & Data",
    cards: [
      { n: "01", icon: Users, title: "Settings › Pengguna & Role", tags: ["admin"], desc: "Tetapkan peran tiap pengguna sesuai matriks akses.", bullets: ["15 role: admin, finance, MD sales, dll", "Akses = A (aksi) · L (lihat) · kosong (tanpa akses)"] },
      { n: "02", icon: Settings, title: "Settings › Data Management", tags: ["admin"], desc: "Kelola data demo (mode testing).", bullets: ["Reset hanya menghapus transaksi", "Master data, COA, akun kas tetap"] },
      { n: "03", icon: TrendingUp, title: "Business Intelligence", tags: ["view"], desc: "Analitik lanjutan (segera hadir)." },
    ],
  },
];

export default function PanduanPage() {
  const [tab, setTab] = useState(GROUPS[0].key);
  const group = GROUPS.find((g) => g.key === tab) ?? GROUPS[0];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Panduan Penggunaan</h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">Brand.Inc — ringkasan tiap menu & alur kerja, beserta role yang boleh mengaksesnya.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {GROUPS.map((g) => (
          <button key={g.key} onClick={() => setTab(g.key)} data-active={tab === g.key} className="pill">{g.label}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {group.cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.n} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-black tabular-nums text-primary/70">{c.n}</span>
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-muted"><Icon className="h-[18px] w-[18px]" /></span>
                  <h3 className="text-base font-extrabold">{c.title}</h3>
                </div>
                <div className="flex flex-wrap justify-end gap-1">
                  {c.tags.map((t) => (
                    <span key={t} className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", TAG_STYLE[t].cls)}>{TAG_STYLE[t].label}</span>
                  ))}
                </div>
              </div>
              <p className="mt-3 text-sm font-medium text-muted-foreground">{c.desc}</p>
              {c.bullets && (
                <ul className="mt-3 space-y-1.5">
                  {c.bullets.map((b, i) => (
                    <li key={i} className="flex gap-2 text-sm font-medium">
                      <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/60" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="card flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
        <span className="text-xs font-black uppercase tracking-wide text-muted-foreground">Keterangan role:</span>
        {(Object.keys(TAG_STYLE) as Tag[]).map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5 text-xs font-semibold">
            <span className={cn("h-3 w-3 rounded-full", TAG_STYLE[t].cls)} /> {TAG_STYLE[t].label}
          </span>
        ))}
        <span className="ml-auto text-xs font-medium text-muted-foreground">Detail akses per halaman diatur admin di Settings › Pengguna.</span>
      </div>
    </div>
  );
}
