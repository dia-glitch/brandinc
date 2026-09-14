"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEMO_COMPANY_ID } from "@/lib/supabase/config";
import { isAdmin } from "@/lib/roles";

// Hanya tabel TRANSAKSI (child → parent). Master data, COA, cash_accounts DIPERTAHANKAN.
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
 * Master data, COA (chart_of_accounts), dan akun kas/bank (cash_accounts) tetap.
 */
export async function resetDemoData(): Promise<{ ok: true; tables: number } | { ok: false; error: string }> {
  const supabase = createClient();
  if (!(await isAdmin(supabase))) return { ok: false, error: "Hanya admin yang boleh mereset data demo." };

  for (const t of TX_TABLES) {
    const { error } = await supabase.from(t).delete().eq("company_id", DEMO_COMPANY_ID);
    if (error) return { ok: false, error: `Gagal menghapus ${t}: ${error.message}` };
  }

  ["/settings/data", "/", "/inventory", "/inventory/stock", "/sales", "/finance", "/accounting", "/distribution"].forEach((p) => revalidatePath(p));
  return { ok: true, tables: TX_TABLES.length };
}
