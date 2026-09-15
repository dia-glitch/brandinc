"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEMO_COMPANY_ID } from "@/lib/supabase/config";
import { isAdmin } from "@/lib/roles";

// Tabel TRANSAKSI (child -> parent). Master data (materials, products, variants, suppliers, kategori/warna/ukuran) & COA DIPERTAHANKAN.
const TX_TABLES = [
  "cash_purchase_lines", "cash_purchases",
  "stock_transfer_lines", "stock_transfers",
  "sales_return_lines", "sales_returns",
  "sales_order_lines", "sales_orders",
  "sales_entries", "receivables", "payment_requests", "payments", "expenses",
  "spk_costing",
  "material_issue_lines", "material_issues",
  "fg_receipt_lines", "fg_receipts",
  "production_po_lines", "production_pos",
  "purchase_order_lines", "purchase_orders",
  "work_order_specs", "work_order_lines", "work_orders",
  "journal_entry_lines", "journal_entries",
  "stock_balances", "inventory_movements",
  "material_stock_balances", "material_movements",
];

/**
 * Reset data demo: hapus SELURUH transaksi & saldo turunan di Company DEMO.
 * Master data (materials, products, SKU, supplier, kategori/warna/ukuran) & COA TETAP.
 * Selain transaksi, ikut dibersihkan (permintaan user):
 *  - saldo awal akun kas/bank di-nol-kan (opening_balance = 0) -> Kas & Bank + Laba Ditahan di Neraca jadi 0;
 *    akun kas/bank-nya sendiri tetap ada.
 *  - foto katalog (catalog_image_url) & launch_date produk dikosongkan; produk/SKU tetap ada.
 */
export async function resetDemoData(): Promise<{ ok: true; tables: number } | { ok: false; error: string }> {
  const supabase = createClient();
  if (!(await isAdmin(supabase))) return { ok: false, error: "Hanya admin yang boleh mereset data demo." };

  for (const t of TX_TABLES) {
    const { error } = await supabase.from(t).delete().eq("company_id", DEMO_COMPANY_ID);
    if (error) return { ok: false, error: `Gagal menghapus ${t}: ${error.message}` };
  }

  // Nol-kan saldo awal kas/bank (hapus sisa Kas & Bank 10jt + Laba Ditahan 10jt di Neraca). Akun tetap ada.
  {
    const { error } = await supabase.from("cash_accounts").update({ opening_balance: 0 }).eq("company_id", DEMO_COMPANY_ID);
    if (error) return { ok: false, error: `Gagal reset saldo awal kas/bank: ${error.message}` };
  }

  // Kosongkan foto katalog & launch date produk (master produk tetap ada).
  {
    const { error } = await supabase.from("products").update({ catalog_image_url: null, launch_date: null }).eq("company_id", DEMO_COMPANY_ID);
    if (error) return { ok: false, error: `Gagal membersihkan foto katalog / launch date: ${error.message}` };
  }

  ["/settings/data", "/", "/inventory", "/inventory/stock", "/sales", "/finance", "/accounting", "/distribution", "/katalog", "/lifecycle"].forEach((p) => revalidatePath(p));
  return { ok: true, tables: TX_TABLES.length };
}
