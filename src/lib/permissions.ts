/**
 * Matriks akses peran (RBAC) — sumber kebenaran hak akses per halaman.
 * Level: "A" = Aksi (boleh ubah/proses), "L" = Lihat saja, null = No Access (menu disembunyikan & URL diblok).
 * Modul murni (tanpa import server) agar bisa dipakai di middleware, server, & client.
 */

export type Role =
  | "admin" | "director" | "head" | "finance" | "designer" | "rnd" | "mdp"
  | "purchasing" | "qc" | "warehouse_inbound" | "warehouse_inventory"
  | "warehouse_material" | "warehouse_outbound" | "marketing" | "md_sales" | "staff";

export type PageKey =
  | "dashboard" | "master_data" | "inventory"
  | "sales_penjualan" | "sales_penerimaan"
  | "rm_stock" | "rm_create" | "rm_po" | "rm_penerimaan" | "rm_cash"
  | "prod_product" | "prod_spk" | "prod_po" | "prod_material_issue" | "prod_cogm"
  | "dist_submit" | "dist_process" | "fg_stock" | "fg_incoming_qc"
  | "fin_payment_request" | "fin_other" | "accounting" | "settings";

export type Level = "A" | "L";

/** Role yang bisa dipilih admin (urut logis). "staff" = bawaan minimal, tidak ditawarkan. */
export const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "admin", label: "Admin — akses penuh" },
  { value: "director", label: "Director" },
  { value: "head", label: "Head" },
  { value: "finance", label: "Finance" },
  { value: "designer", label: "Designer" },
  { value: "rnd", label: "R&D" },
  { value: "mdp", label: "MDP" },
  { value: "purchasing", label: "Purchasing" },
  { value: "qc", label: "QC" },
  { value: "warehouse_inbound", label: "Warehouse — Inbound" },
  { value: "warehouse_inventory", label: "Warehouse — Inventory" },
  { value: "warehouse_material", label: "Warehouse — Material" },
  { value: "warehouse_outbound", label: "Warehouse — Outbound" },
  { value: "marketing", label: "Marketing" },
  { value: "md_sales", label: "MD Sales" },
];

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin", director: "Director", head: "Head", finance: "Finance",
  designer: "Designer", rnd: "R&D", mdp: "MDP", purchasing: "Purchasing", qc: "QC",
  warehouse_inbound: "Warehouse — Inbound", warehouse_inventory: "Warehouse — Inventory",
  warehouse_material: "Warehouse — Material", warehouse_outbound: "Warehouse — Outbound",
  marketing: "Marketing", md_sales: "MD Sales", staff: "Staff (belum diatur)",
};

/** Matriks dari template ALEZA (Brandinc). Key hilang = No Access. admin & staff ditangani terpisah. */
const MATRIX: Record<Exclude<Role, "admin" | "staff">, Partial<Record<PageKey, Level>>> = {
  head: { dashboard: "A", master_data: "L", inventory: "L", sales_penjualan: "L", sales_penerimaan: "L", rm_stock: "L", rm_create: "L", rm_po: "L", rm_penerimaan: "L", rm_cash: "L", prod_product: "L", prod_spk: "L", prod_po: "L", prod_material_issue: "L", prod_cogm: "L", dist_submit: "L", dist_process: "L", fg_stock: "L", fg_incoming_qc: "L", fin_payment_request: "A", fin_other: "L", accounting: "A" },
  designer: { dashboard: "A", master_data: "L", inventory: "L", sales_penjualan: "L", sales_penerimaan: "L", rm_stock: "A", rm_create: "A", rm_po: "L", rm_penerimaan: "L", rm_cash: "A", prod_product: "A", prod_spk: "A", prod_po: "L", prod_material_issue: "A", prod_cogm: "L", fg_stock: "L", fg_incoming_qc: "L", fin_payment_request: "A" },
  director: { dashboard: "A", master_data: "L", inventory: "L", sales_penjualan: "L", sales_penerimaan: "A", rm_stock: "L", rm_create: "L", rm_po: "L", rm_penerimaan: "L", rm_cash: "L", prod_product: "L", prod_spk: "L", prod_po: "L", prod_material_issue: "L", prod_cogm: "L", dist_submit: "L", dist_process: "L", fg_stock: "L", fg_incoming_qc: "L", fin_payment_request: "L", fin_other: "L", accounting: "L" },
  finance: { dashboard: "A", master_data: "L", inventory: "L", sales_penjualan: "L", sales_penerimaan: "L", rm_stock: "L", rm_create: "L", rm_po: "L", rm_penerimaan: "L", rm_cash: "L", prod_product: "L", prod_spk: "L", prod_po: "L", prod_material_issue: "L", prod_cogm: "L", dist_submit: "L", dist_process: "L", fg_stock: "L", fg_incoming_qc: "L", fin_payment_request: "A", fin_other: "A", accounting: "A" },
  rnd: { dashboard: "A", master_data: "L", inventory: "L", sales_penjualan: "L", sales_penerimaan: "L", rm_stock: "A", rm_create: "A", rm_po: "A", rm_penerimaan: "L", rm_cash: "A", prod_product: "A", prod_spk: "A", prod_po: "L", prod_material_issue: "A", prod_cogm: "L", fg_stock: "L", fg_incoming_qc: "L", fin_payment_request: "A" },
  mdp: { dashboard: "A", master_data: "L", inventory: "L", sales_penjualan: "L", sales_penerimaan: "L", rm_stock: "L", rm_create: "A", rm_po: "A", rm_penerimaan: "L", rm_cash: "A", prod_product: "A", prod_spk: "L", prod_po: "A", prod_material_issue: "A", prod_cogm: "L", fg_stock: "L", fg_incoming_qc: "L", fin_payment_request: "A" },
  purchasing: { dashboard: "A", master_data: "L", inventory: "L", sales_penjualan: "L", sales_penerimaan: "L", rm_stock: "L", rm_create: "A", rm_po: "A", rm_penerimaan: "L", rm_cash: "A", fg_stock: "L", fg_incoming_qc: "L", fin_payment_request: "A" },
  qc: { dashboard: "A", master_data: "L", inventory: "L", sales_penjualan: "L", sales_penerimaan: "L", prod_product: "L", prod_spk: "L", prod_po: "L", dist_submit: "L", dist_process: "L", fg_stock: "L", fg_incoming_qc: "A" },
  warehouse_inbound: { dashboard: "A", master_data: "L", inventory: "L", sales_penjualan: "L", sales_penerimaan: "L", prod_product: "L", prod_spk: "L", prod_po: "L", dist_submit: "L", dist_process: "L", fg_stock: "L", fg_incoming_qc: "A" },
  warehouse_inventory: { dashboard: "A", master_data: "L", inventory: "L", sales_penjualan: "L", sales_penerimaan: "L", rm_stock: "L", rm_create: "L", rm_po: "L", rm_penerimaan: "A", rm_cash: "L", prod_product: "L", prod_spk: "L", prod_po: "L", dist_submit: "L", dist_process: "L", fg_stock: "L", fg_incoming_qc: "A" },
  warehouse_material: { dashboard: "A", master_data: "L", inventory: "L", sales_penjualan: "L", sales_penerimaan: "L", rm_stock: "L", rm_create: "L", rm_po: "L", rm_penerimaan: "A", rm_cash: "L", prod_product: "L", prod_spk: "L", prod_po: "L", fg_stock: "L", fg_incoming_qc: "L" },
  warehouse_outbound: { dashboard: "A", master_data: "L", inventory: "L", sales_penjualan: "L", sales_penerimaan: "L", prod_product: "L", prod_spk: "L", prod_po: "L", dist_submit: "L", dist_process: "A", fg_stock: "L", fg_incoming_qc: "L" },
  marketing: { dashboard: "A", inventory: "L", fin_payment_request: "A" },
  md_sales: { dashboard: "A", master_data: "L", inventory: "L", sales_penjualan: "A", sales_penerimaan: "L", dist_submit: "A", dist_process: "L", fin_payment_request: "A" },
};

/** Level akses satu role untuk satu halaman. admin = selalu A; settings hanya admin; staff = dashboard L saja. */
export function accessLevel(role: Role, key: PageKey): Level | null {
  if (role === "admin") return "A";
  if (key === "settings") return null;
  if (role === "staff") return key === "dashboard" ? "L" : null;
  return MATRIX[role]?.[key] ?? null;
}

export const canView = (role: Role, key: PageKey): boolean => accessLevel(role, key) !== null;
export const canAct = (role: Role, key: PageKey): boolean => accessLevel(role, key) === "A";

/** Prefix rute → PageKey (spesifik dulu, umum belakangan). */
const ROUTE_MAP: [string, PageKey][] = [
  ["/finance/payment-request", "fin_payment_request"],
  // AR = bagian Finance → ikut akses "Finance Other Page" (bukan Sales Penerimaan).
  // Permission sales_penerimaan dipakai untuk gating aksi "Terima Pembayaran" (fase 2).
  ["/finance/ar", "fin_other"],
  ["/finance", "fin_other"],
  ["/accounting", "accounting"],
  ["/master-data", "master_data"],
  ["/inventory", "inventory"],
  ["/finished-goods/incoming", "fg_incoming_qc"],
  ["/finished-goods", "fg_stock"],
  ["/sales", "sales_penjualan"],
  ["/raw-material/materials", "rm_create"],
  ["/raw-material/po", "rm_po"],
  ["/raw-material/cash-purchase", "rm_cash"],
  ["/raw-material", "rm_stock"],
  ["/production/products", "prod_product"],
  ["/production/spk", "prod_spk"],
  ["/production/po", "prod_po"],
  ["/production/material-issue", "prod_material_issue"],
  ["/production/cogm", "prod_cogm"],
  ["/production", "prod_product"],
  ["/distribution", "dist_submit"],
  ["/settings", "settings"],
  ["/bi", "dashboard"],
  ["/panduan", "dashboard"],
];

/** PageKey untuk sebuah path. null = rute tak-terjaga (mis. /login, /print) → diizinkan. */
export function pageKeyForPath(path: string): PageKey | null {
  if (path === "/") return "dashboard";
  for (const [prefix, key] of ROUTE_MAP) {
    if (path === prefix || path.startsWith(prefix + "/")) return key;
  }
  return null;
}

/** Boleh melihat sebuah path? (Distribution: view bila boleh submit ATAU proses.) */
export function canViewPath(role: Role, path: string): boolean {
  if (path === "/distribution" || path.startsWith("/distribution/")) {
    return canView(role, "dist_submit") || canView(role, "dist_process");
  }
  const key = pageKeyForPath(path);
  return key ? canView(role, key) : true;
}

const KNOWN_ROLES = new Set<Role>(["admin", "director", "head", "finance", "designer", "rnd", "mdp", "purchasing", "qc", "warehouse_inbound", "warehouse_inventory", "warehouse_material", "warehouse_outbound", "marketing", "md_sales", "staff"]);
export function normalizeRole(value: unknown): Role {
  return typeof value === "string" && KNOWN_ROLES.has(value as Role) ? (value as Role) : "staff";
}
