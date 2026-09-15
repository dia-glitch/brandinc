"use server";

import { createClient } from "@/lib/supabase/server";
import { getSkuCosting } from "@/lib/costing";
import { getPayables } from "@/lib/finance";
import type { ReportKey, ReportResult, ReportRange } from "./reports-meta";

type SB = ReturnType<typeof createClient>;
const num = (v: unknown) => Number(v) || 0;
const d10 = (v: unknown) => ((v as string | null) ?? "").slice(0, 10);
function inRange(date: string, r?: ReportRange) {
  if (!r) return true;
  if (r.from && date && date < r.from) return false;
  if (r.to && date && date > r.to) return false;
  if ((r.from || r.to) && !date) return false;
  return true;
}

async function nameMaps(supabase: SB) {
  const [brands, suppliers, warehouses, products, variants, materials, accounts] = await Promise.all([
    supabase.from("brands").select("id,name").is("deleted_at", null),
    supabase.from("suppliers").select("id,name").is("deleted_at", null),
    supabase.from("warehouses").select("id,name").is("deleted_at", null),
    supabase.from("products").select("id,name").is("deleted_at", null),
    supabase.from("product_variants").select("id,sku,product_id,size,brand_id").is("deleted_at", null),
    supabase.from("materials").select("id,code,name,brand_id").is("deleted_at", null),
    supabase.from("cash_accounts").select("id,name").is("deleted_at", null),
  ]);
  return {
    brand: new Map((brands.data ?? []).map((b) => [b.id as string, (b.name as string) ?? "—"])),
    supplier: new Map((suppliers.data ?? []).map((s) => [s.id as string, (s.name as string) ?? "—"])),
    warehouse: new Map((warehouses.data ?? []).map((w) => [w.id as string, (w.name as string) ?? "—"])),
    product: new Map((products.data ?? []).map((p) => [p.id as string, (p.name as string) ?? "—"])),
    variant: new Map((variants.data ?? []).map((v) => [v.id as string, v])),
    material: new Map((materials.data ?? []).map((m) => [m.id as string, m])),
    account: new Map((accounts.data ?? []).map((a) => [a.id as string, (a.name as string) ?? "—"])),
  };
}

// ---------------------------------------------------------------------------
async function repSales(supabase: SB, r?: ReportRange): Promise<ReportResult> {
  const m = await nameMaps(supabase);
  const [ordRes, lineRes] = await Promise.all([
    supabase.from("sales_orders").select("id,code,brand_id,customer,settlement,order_date").is("deleted_at", null),
    supabase.from("sales_order_lines").select("order_id,sku,product_name,qty,price").is("deleted_at", null),
  ]);
  const ord = new Map((ordRes.data ?? []).map((o) => [o.id as string, o]));
  const rows: (string | number)[][] = [];
  for (const l of lineRes.data ?? []) {
    const o = ord.get(l.order_id as string); if (!o) continue;
    const date = d10(o.order_date); if (!inRange(date, r)) continue;
    const qty = num(l.qty), price = num(l.price);
    rows.push([date, (o.code as string) ?? "", m.brand.get((o.brand_id as string) ?? "") ?? "—",
      (o.customer as string | null) ?? "", (o.settlement as string) ?? "", (l.sku as string | null) ?? "",
      (l.product_name as string | null) ?? "", qty, price, qty * price]);
  }
  rows.sort((a, b) => String(b[0]).localeCompare(String(a[0])));
  return { columns: [
    { label: "Tanggal" }, { label: "Kode" }, { label: "Brand" }, { label: "Customer" }, { label: "Settlement" },
    { label: "SKU" }, { label: "Produk" }, { label: "Qty", numeric: true }, { label: "Harga", numeric: true }, { label: "Subtotal", numeric: true },
  ], rows };
}

async function repCogm(supabase: SB): Promise<ReportResult> {
  const m = await nameMaps(supabase);
  const costing = await getSkuCosting(supabase);
  const rows: (string | number)[][] = [];
  for (const v of m.variant.values()) {
    const sku = (v.sku as string) ?? ""; if (!sku) continue;
    const c = costing.get(sku); const cogm = c?.cogm ?? 0, retail = c?.retail ?? 0;
    if (cogm === 0 && retail === 0) continue;
    rows.push([sku, m.product.get((v.product_id as string) ?? "") ?? "—",
      m.brand.get((v.brand_id as string) ?? "") ?? "—", cogm, retail, retail - cogm]);
  }
  rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  return { columns: [
    { label: "SKU" }, { label: "Produk" }, { label: "Brand" },
    { label: "COGM/pcs", numeric: true }, { label: "Retail", numeric: true }, { label: "Margin", numeric: true },
  ], rows };
}

async function repInventoryVal(supabase: SB): Promise<ReportResult> {
  const m = await nameMaps(supabase);
  const costing = await getSkuCosting(supabase);
  const balRes = await supabase.from("stock_balances").select("variant_id,warehouse_id,stock_status,qty_on_hand,moving_avg_cost").is("deleted_at", null);
  const rows: (string | number)[][] = [];
  for (const b of balRes.data ?? []) {
    const qty = num(b.qty_on_hand); if (qty <= 0) continue;
    const v = m.variant.get((b.variant_id as string) ?? "");
    const sku = (v?.sku as string) ?? "";
    const cogm = costing.get(sku)?.cogm ?? num(b.moving_avg_cost);
    rows.push([sku, v ? (m.product.get((v.product_id as string) ?? "") ?? "—") : "—",
      v ? (m.brand.get((v.brand_id as string) ?? "") ?? "—") : "—",
      m.warehouse.get((b.warehouse_id as string) ?? "") ?? "—",
      (b.stock_status as string) ?? "available", qty, cogm, qty * cogm]);
  }
  rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  return { columns: [
    { label: "SKU" }, { label: "Produk" }, { label: "Brand" }, { label: "Gudang" }, { label: "Status" },
    { label: "Stok", numeric: true }, { label: "COGM", numeric: true }, { label: "Nilai", numeric: true },
  ], rows };
}

async function repMaterialStock(supabase: SB): Promise<ReportResult> {
  const m = await nameMaps(supabase);
  const balRes = await supabase.from("material_stock_balances").select("material_id,warehouse_id,qty_on_hand,moving_avg_cost").is("deleted_at", null);
  const rows: (string | number)[][] = [];
  for (const b of balRes.data ?? []) {
    const qty = num(b.qty_on_hand); if (qty <= 0) continue;
    const mat = m.material.get((b.material_id as string) ?? "");
    const cost = num(b.moving_avg_cost);
    rows.push([(mat?.code as string | null) ?? "", (mat?.name as string | null) ?? "—",
      mat ? (m.brand.get((mat.brand_id as string) ?? "") ?? "—") : "—",
      m.warehouse.get((b.warehouse_id as string) ?? "") ?? "—", qty, cost, qty * cost]);
  }
  rows.sort((a, b) => String(a[1]).localeCompare(String(b[1])));
  return { columns: [
    { label: "Kode" }, { label: "Material" }, { label: "Brand" }, { label: "Gudang" },
    { label: "Stok", numeric: true }, { label: "Avg Cost", numeric: true }, { label: "Nilai", numeric: true },
  ], rows };
}

async function repPoMaterial(supabase: SB, r?: ReportRange): Promise<ReportResult> {
  const m = await nameMaps(supabase);
  const [poRes, lineRes] = await Promise.all([
    supabase.from("purchase_orders").select("id,code,po_date,supplier_id,status").is("deleted_at", null),
    supabase.from("purchase_order_lines").select("po_id,material_name,unit,qty,unit_price,received_qty").is("deleted_at", null),
  ]);
  const po = new Map((poRes.data ?? []).map((p) => [p.id as string, p]));
  const rows: (string | number)[][] = [];
  for (const l of lineRes.data ?? []) {
    const p = po.get(l.po_id as string); if (!p) continue;
    const date = d10(p.po_date); if (!inRange(date, r)) continue;
    const qty = num(l.qty), price = num(l.unit_price);
    rows.push([date, (p.code as string) ?? "", m.supplier.get((p.supplier_id as string) ?? "") ?? "—",
      (p.status as string) ?? "", (l.material_name as string | null) ?? "", (l.unit as string | null) ?? "",
      qty, price, qty * price, num(l.received_qty)]);
  }
  rows.sort((a, b) => String(b[0]).localeCompare(String(a[0])));
  return { columns: [
    { label: "Tanggal" }, { label: "Kode PO" }, { label: "Supplier" }, { label: "Status" }, { label: "Material" }, { label: "Unit" },
    { label: "Qty", numeric: true }, { label: "Harga", numeric: true }, { label: "Subtotal", numeric: true }, { label: "Diterima", numeric: true },
  ], rows };
}

async function repPoProduksi(supabase: SB, r?: ReportRange): Promise<ReportResult> {
  const m = await nameMaps(supabase);
  const [poRes, lineRes] = await Promise.all([
    supabase.from("production_pos").select("id,code,brand_id,supplier_id,po_date,status").is("deleted_at", null),
    supabase.from("production_po_lines").select("po_id,sku,product_name,qty,unit_cost,received_qty").is("deleted_at", null),
  ]);
  const po = new Map((poRes.data ?? []).map((p) => [p.id as string, p]));
  const rows: (string | number)[][] = [];
  for (const l of lineRes.data ?? []) {
    const p = po.get(l.po_id as string); if (!p) continue;
    const date = d10(p.po_date); if (!inRange(date, r)) continue;
    const qty = num(l.qty), cost = num(l.unit_cost);
    rows.push([date, (p.code as string) ?? "", m.brand.get((p.brand_id as string) ?? "") ?? "—",
      m.supplier.get((p.supplier_id as string) ?? "") ?? "—", (p.status as string) ?? "",
      (l.sku as string | null) ?? "", (l.product_name as string | null) ?? "", qty, cost, qty * cost, num(l.received_qty)]);
  }
  rows.sort((a, b) => String(b[0]).localeCompare(String(a[0])));
  return { columns: [
    { label: "Tanggal" }, { label: "Kode" }, { label: "Brand" }, { label: "Supplier" }, { label: "Status" },
    { label: "SKU" }, { label: "Produk" }, { label: "Qty", numeric: true }, { label: "Ongkos/pcs", numeric: true }, { label: "Subtotal", numeric: true }, { label: "Diterima", numeric: true },
  ], rows };
}

async function repInbound(supabase: SB, r?: ReportRange): Promise<ReportResult> {
  const m = await nameMaps(supabase);
  const [rcRes, lineRes] = await Promise.all([
    supabase.from("fg_receipts").select("id,code,brand_id,receipt_date").is("deleted_at", null),
    supabase.from("fg_receipt_lines").select("receipt_id,sku,product_name,qty_incoming,qty_good,qty_repair,qty_damage,unit_cost").is("deleted_at", null),
  ]);
  const rc = new Map((rcRes.data ?? []).map((x) => [x.id as string, x]));
  const rows: (string | number)[][] = [];
  for (const l of lineRes.data ?? []) {
    const h = rc.get(l.receipt_id as string); if (!h) continue;
    const date = d10(h.receipt_date); if (!inRange(date, r)) continue;
    rows.push([date, (h.code as string) ?? "", m.brand.get((h.brand_id as string) ?? "") ?? "—",
      (l.sku as string | null) ?? "", (l.product_name as string | null) ?? "",
      num(l.qty_incoming), num(l.qty_good), num(l.qty_repair), num(l.qty_damage), num(l.unit_cost)]);
  }
  rows.sort((a, b) => String(b[0]).localeCompare(String(a[0])));
  return { columns: [
    { label: "Tanggal" }, { label: "Kode" }, { label: "Brand" }, { label: "SKU" }, { label: "Produk" },
    { label: "Incoming", numeric: true }, { label: "Good", numeric: true }, { label: "Repair", numeric: true }, { label: "Damage", numeric: true }, { label: "Unit Cost", numeric: true },
  ], rows };
}

async function repQc(supabase: SB, r?: ReportRange): Promise<ReportResult> {
  const m = await nameMaps(supabase);
  const [rcRes, lineRes] = await Promise.all([
    supabase.from("fg_receipts").select("id,code,brand_id,receipt_date").is("deleted_at", null),
    supabase.from("fg_receipt_lines").select("receipt_id,sku,product_name,qty_incoming,qty_good,qty_repair,qty_damage").is("deleted_at", null),
  ]);
  const rc = new Map((rcRes.data ?? []).map((x) => [x.id as string, x]));
  const rows: (string | number)[][] = [];
  for (const l of lineRes.data ?? []) {
    const h = rc.get(l.receipt_id as string); if (!h) continue;
    const date = d10(h.receipt_date); if (!inRange(date, r)) continue;
    const inc = num(l.qty_incoming), good = num(l.qty_good);
    const pct = inc > 0 ? Math.round((good / inc) * 1000) / 10 : 0;
    rows.push([date, (h.code as string) ?? "", (l.sku as string | null) ?? "", (l.product_name as string | null) ?? "",
      inc, good, num(l.qty_repair), num(l.qty_damage), pct]);
  }
  rows.sort((a, b) => String(b[0]).localeCompare(String(a[0])));
  return { columns: [
    { label: "Tanggal" }, { label: "Kode" }, { label: "SKU" }, { label: "Produk" },
    { label: "Incoming", numeric: true }, { label: "Good", numeric: true }, { label: "Repair", numeric: true }, { label: "Damage", numeric: true }, { label: "%Good", numeric: true },
  ], rows };
}

async function repInvoiceAp(supabase: SB, r?: ReportRange): Promise<ReportResult> {
  const payables = await getPayables(supabase);
  const rows: (string | number)[][] = [];
  for (const p of payables) {
    const date = (p.invoiceDate ?? "").slice(0, 10); if (!inRange(date, r)) continue;
    const tipe = p.refType === "material_invoice" ? "Material" : "Produksi";
    const statusLabel = p.status === "paid" ? "Lunas" : p.status === "partial" ? "Sebagian" : "Belum";
    rows.push([date, p.invoiceNo, tipe, p.party, p.brand, p.subtotal, p.ppn, p.total, p.paid, Math.max(0, p.total - p.paid),
      statusLabel, p.verified ? "Terverifikasi" : "Belum"]);
  }
  rows.sort((a, b) => String(b[0]).localeCompare(String(a[0])));
  return { columns: [
    { label: "Tanggal" }, { label: "Invoice" }, { label: "Tipe" }, { label: "Supplier" }, { label: "Brand" },
    { label: "Subtotal", numeric: true }, { label: "PPN", numeric: true }, { label: "Total", numeric: true },
    { label: "Dibayar", numeric: true }, { label: "Sisa", numeric: true }, { label: "Status" }, { label: "Verifikasi" },
  ], rows };
}

async function repMutasiKas(supabase: SB, r?: ReportRange): Promise<ReportResult> {
  const m = await nameMaps(supabase);
  const payRes = await supabase.from("payments").select("account_id,pay_date,direction,amount,method,ref_type,notes").is("deleted_at", null);
  const rows: (string | number)[][] = [];
  for (const p of payRes.data ?? []) {
    const date = d10(p.pay_date); if (!inRange(date, r)) continue;
    rows.push([date, m.account.get((p.account_id as string) ?? "") ?? "—",
      (p.direction as string) === "in" ? "Masuk" : "Keluar", (p.method as string | null) ?? "",
      num(p.amount), (p.ref_type as string | null) ?? "", (p.notes as string | null) ?? ""]);
  }
  rows.sort((a, b) => String(b[0]).localeCompare(String(a[0])));
  return { columns: [
    { label: "Tanggal" }, { label: "Akun" }, { label: "Arah" }, { label: "Metode" },
    { label: "Jumlah", numeric: true }, { label: "Ref" }, { label: "Catatan" },
  ], rows };
}

async function repExpenses(supabase: SB, r?: ReportRange): Promise<ReportResult> {
  const m = await nameMaps(supabase);
  const exRes = await supabase.from("expenses").select("category,expense_date,amount,payee,status,requester,brand_id,notes").is("deleted_at", null);
  const rows: (string | number)[][] = [];
  for (const e of exRes.data ?? []) {
    const date = d10(e.expense_date); if (!inRange(date, r)) continue;
    rows.push([date, (e.category as string) ?? "", m.brand.get((e.brand_id as string) ?? "") ?? "—",
      (e.payee as string | null) ?? "", num(e.amount), (e.status as string) ?? "",
      (e.requester as string | null) ?? "", (e.notes as string | null) ?? ""]);
  }
  rows.sort((a, b) => String(b[0]).localeCompare(String(a[0])));
  return { columns: [
    { label: "Tanggal" }, { label: "Kategori" }, { label: "Brand" }, { label: "Payee" },
    { label: "Jumlah", numeric: true }, { label: "Status" }, { label: "Requester" }, { label: "Catatan" },
  ], rows };
}

async function repDistribusi(supabase: SB, r?: ReportRange): Promise<ReportResult> {
  const m = await nameMaps(supabase);
  const [trRes, lineRes] = await Promise.all([
    supabase.from("stock_transfers").select("id,code,from_warehouse_id,to_warehouse_id,transfer_date,status").is("deleted_at", null),
    supabase.from("stock_transfer_lines").select("transfer_id,sku,product_name,qty,qty_packed,unit_cost").is("deleted_at", null),
  ]);
  const tr = new Map((trRes.data ?? []).map((t) => [t.id as string, t]));
  const rows: (string | number)[][] = [];
  for (const l of lineRes.data ?? []) {
    const t = tr.get(l.transfer_id as string); if (!t) continue;
    const date = d10(t.transfer_date); if (!inRange(date, r)) continue;
    const qtyReq = num(l.qty), qtyPacked = l.qty_packed == null ? qtyReq : num(l.qty_packed);
    rows.push([date, (t.code as string) ?? "", m.warehouse.get((t.from_warehouse_id as string) ?? "") ?? "—",
      m.warehouse.get((t.to_warehouse_id as string) ?? "") ?? "—", (t.status as string) ?? "",
      (l.sku as string | null) ?? "", (l.product_name as string | null) ?? "", qtyReq, qtyPacked, qtyPacked * num(l.unit_cost)]);
  }
  rows.sort((a, b) => String(b[0]).localeCompare(String(a[0])));
  return { columns: [
    { label: "Tanggal" }, { label: "Kode" }, { label: "Dari" }, { label: "Ke" }, { label: "Status" },
    { label: "SKU" }, { label: "Produk" }, { label: "Qty Minta", numeric: true }, { label: "Qty Kirim", numeric: true }, { label: "Nilai", numeric: true },
  ], rows };
}

/** Dispatcher server action. */
export async function runReport(key: ReportKey, range?: ReportRange): Promise<ReportResult> {
  const supabase = createClient();
  switch (key) {
    case "sales":          return repSales(supabase, range);
    case "cogm":           return repCogm(supabase);
    case "inventory_val":  return repInventoryVal(supabase);
    case "material_stock": return repMaterialStock(supabase);
    case "po_material":    return repPoMaterial(supabase, range);
    case "po_produksi":    return repPoProduksi(supabase, range);
    case "inbound":        return repInbound(supabase, range);
    case "qc":             return repQc(supabase, range);
    case "invoice_ap":     return repInvoiceAp(supabase, range);
    case "mutasi_kas":     return repMutasiKas(supabase, range);
    case "expenses":       return repExpenses(supabase, range);
    case "distribusi":     return repDistribusi(supabase, range);
    default:               return { columns: [], rows: [] };
  }
}
