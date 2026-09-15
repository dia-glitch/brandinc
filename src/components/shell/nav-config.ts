import {
  LayoutDashboard, Boxes, Warehouse, PackageOpen, Factory, Store, Truck, CalendarClock,
  Images, CreditCard, Wallet, BookText, BarChart3, Settings, HelpCircle, Receipt,
  Users, ShieldCheck, Database, type LucideIcon,
} from "lucide-react";
import type { PageKey } from "@/lib/permissions";

export type NavSub = { key: PageKey; href: string };
export type NavItem = { label: string; icon: LucideIcon; pages: NavSub[] };
export type NavSection = { key: string; label: string; desc: string; icon: LucideIcon; items: NavItem[] };

// --- Item definitions (dipakai di section) ---
const Dashboard: NavItem = { label: "Dashboard", icon: LayoutDashboard, pages: [{ key: "dashboard", href: "/" }] };
const RawMaterial: NavItem = { label: "Raw Material", icon: PackageOpen, pages: [
  { key: "rm_stock", href: "/raw-material" },
  { key: "rm_create", href: "/raw-material/materials" },
  { key: "rm_po", href: "/raw-material/po" },
  { key: "rm_cash", href: "/raw-material/cash-purchase" },
] };
const Production: NavItem = { label: "Production", icon: Factory, pages: [
  { key: "prod_product", href: "/production/products" },
  { key: "prod_spk", href: "/production/spk" },
  { key: "prod_po", href: "/production/po" },
  { key: "prod_material_issue", href: "/production/material-issue" },
  { key: "prod_cogm", href: "/production/cogm" },
] };
const FinishedGoods: NavItem = { label: "Finished Goods", icon: Store, pages: [
  { key: "fg_stock", href: "/finished-goods" },
  { key: "fg_incoming_qc", href: "/finished-goods/incoming" },
] };
const Invoice: NavItem = { label: "Invoice", icon: Receipt, pages: [{ key: "fg_stock", href: "/finished-goods/invoice" }] };
const Inventory: NavItem = { label: "Inventory", icon: Warehouse, pages: [{ key: "inventory", href: "/inventory" }] };
const Distribution: NavItem = { label: "Distribution", icon: Truck, pages: [
  { key: "dist_submit", href: "/distribution" }, { key: "dist_process", href: "/distribution" },
] };
const Sales: NavItem = { label: "Sales", icon: CreditCard, pages: [{ key: "sales_penjualan", href: "/sales" }] };
const Katalog: NavItem = { label: "Katalog", icon: Images, pages: [{ key: "catalog", href: "/katalog" }] };
const Lifecycle: NavItem = { label: "Lifecycle Produk", icon: CalendarClock, pages: [{ key: "product_lifecycle", href: "/lifecycle" }] };
const Finance: NavItem = { label: "Finance", icon: Wallet, pages: [
  { key: "fin_other", href: "/finance" }, { key: "fin_payment_request", href: "/finance/payment-request" },
] };
const Accounting: NavItem = { label: "Accounting", icon: BookText, pages: [{ key: "accounting", href: "/accounting" }] };
const BusinessIntelligence: NavItem = { label: "Business Intelligence", icon: BarChart3, pages: [{ key: "dashboard", href: "/bi" }] };
const MasterData: NavItem = { label: "Master Data", icon: Boxes, pages: [{ key: "master_data", href: "/master-data/brands" }] };
const PenggunaRole: NavItem = { label: "Pengguna & Role", icon: Users, pages: [{ key: "settings", href: "/settings/users" }] };
const AksesHalaman: NavItem = { label: "Akses Halaman", icon: ShieldCheck, pages: [{ key: "settings", href: "/settings/access" }] };
const DataManagement: NavItem = { label: "Data Management", icon: Database, pages: [{ key: "settings", href: "/settings/data" }] };
const Panduan: NavItem = { label: "Panduan", icon: HelpCircle, pages: [{ key: "dashboard", href: "/panduan" }] };

/**
 * Navigasi dibagi per-SECTION. Beranda (hub) menampilkan kartu section; sidebar
 * hanya menampilkan menu section yang sedang dibuka → tidak terlalu penuh.
 */
export const SECTIONS: NavSection[] = [
  { key: "dashboard", label: "Dashboard", desc: "Ringkasan bisnis", icon: LayoutDashboard, items: [Dashboard] },
  { key: "produksi", label: "Production & Purchasing", desc: "Bahan baku & produksi", icon: Factory, items: [RawMaterial, Production] },
  { key: "inbound", label: "Inbound / Receiving", desc: "Penerimaan, stok & invoice", icon: PackageOpen, items: [FinishedGoods, Invoice, Inventory] },
  { key: "distribusi", label: "Distribution", desc: "Distribusi antar lokasi & channel", icon: Truck, items: [Distribution] },
  { key: "sales", label: "Sales", desc: "Penjualan, katalog & lifecycle", icon: CreditCard, items: [Sales, Katalog, Lifecycle] },
  { key: "finance", label: "Finance & Accounting", desc: "Keuangan & akuntansi", icon: Wallet, items: [Finance, Accounting] },
  { key: "analitik", label: "Analitik & Laporan", desc: "Business Intelligence & laporan", icon: BarChart3, items: [BusinessIntelligence] },
  { key: "setting", label: "Setting", desc: "Master data & pengaturan", icon: Settings, items: [MasterData, PenggunaRole, AksesHalaman, DataManagement, Panduan] },
];

/** Section key untuk sebuah path (cocokkan segmen modul teratas). null = hub/luar section. */
export function sectionForPath(pathname: string): string | null {
  if (pathname === "/") return "dashboard";
  const seg = pathname.split("/")[1] ?? "";
  if (!seg || seg === "beranda") return null;
  for (const s of SECTIONS) for (const it of s.items) for (const p of it.pages) {
    const pseg = p.href.split("/")[1] ?? "";
    if (pseg && pseg === seg) return s.key;
  }
  return null;
}
