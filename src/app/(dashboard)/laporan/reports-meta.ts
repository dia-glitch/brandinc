/** Metadata report hub (plain module, bukan "use server"). */
export type ReportKey =
  | "sales" | "cogm" | "inventory_val" | "material_stock"
  | "po_material" | "po_produksi" | "inbound" | "qc"
  | "invoice_ap" | "mutasi_kas" | "expenses" | "distribusi";

export type ReportMeta = {
  key: ReportKey;
  title: string;
  desc: string;
  icon: string;   // nama lucide (dipetakan di client)
  hasDate: boolean;
  dateLabel?: string;
};

export const REPORT_META: ReportMeta[] = [
  { key: "sales",          title: "Penjualan",                 desc: "Semua transaksi penjualan + baris SKU, qty & harga.",       icon: "ShoppingBag",     hasDate: true,  dateLabel: "Tanggal Order" },
  { key: "cogm",           title: "COGM — Biaya Produksi",     desc: "Biaya produksi per SKU: COGM/pcs, retail & margin.",        icon: "Calculator",      hasDate: false },
  { key: "inventory_val",  title: "Inventory (Valuasi Stok Jadi)", desc: "Stok barang jadi per gudang × COGM — snapshot terkini.", icon: "Boxes",           hasDate: false },
  { key: "material_stock", title: "Stok Material",             desc: "Saldo material per gudang × avg cost — snapshot terkini.", icon: "Package",       hasDate: false },
  { key: "po_material",    title: "Purchase Order (Material)", desc: "PO material + supplier, qty, nilai & status.",              icon: "FileText",        hasDate: true,  dateLabel: "Tanggal PO" },
  { key: "po_produksi",    title: "PO Produksi",               desc: "PO makloon/CMT per SKU + ongkos WIP & status.",             icon: "Factory",         hasDate: true,  dateLabel: "Tanggal PO" },
  { key: "inbound",        title: "Inbound / Penerimaan",      desc: "Penerimaan barang jadi (good / repair / damage).",          icon: "Truck",           hasDate: true,  dateLabel: "Tanggal Terima" },
  { key: "qc",             title: "QC Penerimaan",             desc: "Hasil QC per item: good / repair / reject + %good.",        icon: "ClipboardCheck",  hasDate: true,  dateLabel: "Tanggal Terima" },
  { key: "invoice_ap",     title: "Invoice / Hutang (AP)",     desc: "Invoice supplier/WIP + nilai, dibayar & status.",           icon: "ReceiptText",     hasDate: true,  dateLabel: "Tanggal Invoice" },
  { key: "mutasi_kas",     title: "Mutasi Kas",                desc: "Semua pembayaran masuk/keluar per akun kas/bank.",          icon: "ArrowLeftRight",  hasDate: true,  dateLabel: "Tanggal Bayar" },
  { key: "expenses",       title: "Pengeluaran",               desc: "Beban operasional + payee, jumlah & status.",               icon: "Wallet",          hasDate: true,  dateLabel: "Tanggal" },
  { key: "distribusi",     title: "Distribusi / Transfer",     desc: "Transfer stok antar gudang + qty diminta/dikirim & nilai.", icon: "Send",            hasDate: true,  dateLabel: "Tanggal Transfer" },
];

export type ReportCol = { label: string; numeric?: boolean };
export type ReportResult = { columns: ReportCol[]; rows: (string | number)[][] };
export type ReportRange = { from?: string; to?: string };
