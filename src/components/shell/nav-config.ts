import {
  LayoutDashboard, Boxes, Warehouse, PackageOpen,
  Factory, Store, Truck, CreditCard, Wallet, BookText, BarChart3, Settings, HelpCircle,
  type LucideIcon,
} from "lucide-react";
import type { PageKey } from "@/lib/permissions";

export type NavSub = { key: PageKey; href: string };
export type NavItem = { label: string; icon: LucideIcon; pages: NavSub[]; mvp?: boolean };
export type NavGroup = { label: string; items: NavItem[] };

/**
 * Navigasi utama. Tiap item punya daftar sub-halaman (pages) beserta PageKey-nya.
 * Sidebar menampilkan item bila role bisa melihat ≥1 sub-halaman, dan mengarahkan
 * ke sub-halaman pertama yang boleh diakses.
 */
export const NAV: NavGroup[] = [
  {
    label: "Utama",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, mvp: true, pages: [{ key: "dashboard", href: "/" }] },
    ],
  },
  {
    label: "Operasional",
    items: [
      { label: "Master Data", icon: Boxes, mvp: true, pages: [{ key: "master_data", href: "/master-data/brands" }] },
      { label: "Inventory", icon: Warehouse, mvp: true, pages: [{ key: "inventory", href: "/inventory" }] },
      { label: "Sales", icon: CreditCard, mvp: true, pages: [{ key: "sales_penjualan", href: "/sales" }] },
      {
        label: "Raw Material", icon: PackageOpen, pages: [
          { key: "rm_stock", href: "/raw-material" },
          { key: "rm_create", href: "/raw-material/materials" },
          { key: "rm_po", href: "/raw-material/po" },
          { key: "rm_cash", href: "/raw-material/cash-purchase" },
        ],
      },
      {
        label: "Production", icon: Factory, pages: [
          { key: "prod_product", href: "/production/products" },
          { key: "prod_spk", href: "/production/spk" },
          { key: "prod_po", href: "/production/po" },
          { key: "prod_material_issue", href: "/production/material-issue" },
          { key: "prod_cogm", href: "/production/cogm" },
        ],
      },
      { label: "Distribution", icon: Truck, pages: [{ key: "dist_submit", href: "/distribution" }, { key: "dist_process", href: "/distribution" }] },
      {
        label: "Finished Goods", icon: Store, pages: [
          { key: "fg_stock", href: "/finished-goods" },
          { key: "fg_incoming_qc", href: "/finished-goods/incoming" },
        ],
      },
    ],
  },
  {
    label: "Keuangan",
    items: [
      {
        label: "Finance", icon: Wallet, pages: [
          { key: "fin_other", href: "/finance" },
          { key: "fin_payment_request", href: "/finance/payment-request" },
        ],
      },
      { label: "Accounting", icon: BookText, pages: [{ key: "accounting", href: "/accounting" }] },
    ],
  },
  {
    label: "Analitik & Sistem",
    items: [
      { label: "Business Intelligence", icon: BarChart3, mvp: true, pages: [{ key: "dashboard", href: "/bi" }] },
      {
        label: "Settings", icon: Settings, mvp: true, pages: [
          { key: "settings", href: "/settings/users" },
          { key: "settings", href: "/settings/data" },
        ],
      },
    ],
  },
  {
    label: "Bantuan",
    items: [
      { label: "Panduan", icon: HelpCircle, mvp: true, pages: [{ key: "dashboard", href: "/panduan" }] },
    ],
  },
];
