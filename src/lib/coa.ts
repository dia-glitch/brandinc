/** Bagan Akun (Chart of Accounts) standar untuk fashion multi-brand. */
export type CoaSeed = { code: string; name: string; type: "asset" | "liability" | "equity" | "revenue" | "cogs" | "expense" | "other" };

export const DEFAULT_COA: CoaSeed[] = [
  // ASET
  { code: "1101", name: "Kas", type: "asset" },
  { code: "1102", name: "Bank", type: "asset" },
  { code: "1103", name: "Piutang Usaha (AR)", type: "asset" },
  { code: "1104", name: "Persediaan Bahan Baku", type: "asset" },
  { code: "1105", name: "Persediaan Barang Dalam Proses (WIP)", type: "asset" },
  { code: "1106", name: "Persediaan Barang Jadi", type: "asset" },
  { code: "1107", name: "Uang Muka / Cash Advance", type: "asset" },
  { code: "1201", name: "Aset Tetap", type: "asset" },
  { code: "1202", name: "Akumulasi Penyusutan", type: "asset" },
  // LIABILITAS
  { code: "2101", name: "Utang Usaha (AP)", type: "liability" },
  { code: "2102", name: "Utang Operasional (Payment Request)", type: "liability" },
  { code: "2103", name: "Utang PPN (PPN Keluaran)", type: "liability" },
  { code: "2104", name: "Utang Pajak Lain", type: "liability" },
  { code: "2201", name: "Utang Jangka Panjang", type: "liability" },
  // EKUITAS
  { code: "3101", name: "Modal Disetor", type: "equity" },
  { code: "3102", name: "Laba Ditahan", type: "equity" },
  { code: "3103", name: "Laba Tahun Berjalan", type: "equity" },
  // PENDAPATAN
  { code: "4101", name: "Penjualan Marketplace", type: "revenue" },
  { code: "4102", name: "Penjualan Konsinyasi", type: "revenue" },
  { code: "4103", name: "Penjualan Retail / Store", type: "revenue" },
  { code: "4104", name: "Penjualan Website", type: "revenue" },
  { code: "4201", name: "Diskon Penjualan", type: "revenue" },
  { code: "4202", name: "Retur Penjualan", type: "revenue" },
  // BEBAN POKOK PENJUALAN
  { code: "5101", name: "Harga Pokok Penjualan (HPP)", type: "cogs" },
  { code: "5102", name: "Ongkos Produksi (WIP)", type: "cogs" },
  { code: "5103", name: "Bahan Baku Terpakai", type: "cogs" },
  // BEBAN OPERASIONAL
  { code: "6101", name: "Komisi Channel / Marketplace", type: "expense" },
  { code: "6102", name: "Beban Marketing & Iklan", type: "expense" },
  { code: "6103", name: "Beban Gaji & Upah", type: "expense" },
  { code: "6104", name: "Beban Sewa", type: "expense" },
  { code: "6105", name: "Beban Utilitas", type: "expense" },
  { code: "6106", name: "Beban Logistik & Ongkir", type: "expense" },
  { code: "6107", name: "Beban Perlengkapan", type: "expense" },
  { code: "6108", name: "Beban Pajak & Legal", type: "expense" },
  { code: "6109", name: "Beban Penyusutan", type: "expense" },
  { code: "6110", name: "Beban Operasional Lain", type: "expense" },
  // PENDAPATAN / BEBAN LAIN
  { code: "7101", name: "Pendapatan Lain", type: "other" },
  { code: "7102", name: "Beban Administrasi Bank", type: "other" },
  { code: "7103", name: "Beban Bunga", type: "other" },
];

export const COA_TYPE_LABEL: Record<string, string> = {
  asset: "Aset", liability: "Liabilitas", equity: "Ekuitas", revenue: "Pendapatan", cogs: "Beban Pokok Penjualan", expense: "Beban Operasional", other: "Pendapatan / Beban Lain",
};
export const COA_TYPE_ORDER = ["asset", "liability", "equity", "revenue", "cogs", "expense", "other"];

/** Tipe akun COA yang bisa dipakai sebagai kategori pengeluaran (PR/Expense/AP). */
export const SPENDING_TYPES = ["cogs", "expense", "other"];

/** Kategori pengeluaran default dari COA (nama akun) — dipakai bila tabel COA kosong. */
export const DEFAULT_SPENDING_CATEGORIES = DEFAULT_COA.filter((a) => SPENDING_TYPES.includes(a.type)).map((a) => a.name);

/** Label COA untuk pembayaran otomatis (AP bahan & jasa produksi) agar seragam dgn Accounting. */
export const AP_COA_LABEL: Record<string, string> = {
  material_invoice: "Bahan Baku Terpakai",
  production_invoice: "Ongkos Produksi (WIP)",
};

/** Peta kategori lama (bebas) → nama akun COA, supaya semua laporan seragam. */
export const LEGACY_CATEGORY_MAP: Record<string, string> = {
  "Marketing": "Beban Marketing & Iklan",
  "Operasional": "Beban Operasional Lain",
  "Gaji & Upah": "Beban Gaji & Upah",
  "Sewa": "Beban Sewa",
  "Utilitas": "Beban Utilitas",
  "Logistik & Ongkir": "Beban Logistik & Ongkir",
  "Perlengkapan": "Beban Perlengkapan",
  "Pajak & Legal": "Beban Pajak & Legal",
  "Lainnya": "Beban Operasional Lain",
  "Raw Material": "Bahan Baku Terpakai",
  "Bahan Baku": "Bahan Baku Terpakai",
  "Pembelian Bahan": "Bahan Baku Terpakai",
  "Jasa Produksi": "Ongkos Produksi (WIP)",
  "Komisi": "Komisi Channel / Marketplace",
};

/** Normalisasi nama kategori ke nama akun COA (untuk laporan). */
export function coaCategory(name: string | null | undefined): string {
  const n = (name ?? "").trim();
  if (!n) return "Beban Operasional Lain";
  return LEGACY_CATEGORY_MAP[n] ?? n;
}
