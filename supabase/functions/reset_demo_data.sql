-- =====================================================================
-- RESET DEMO DATA (revisi) — hanya menghapus DATA TRANSAKSI.
-- DIPERTAHANKAN (TIDAK dihapus):
--   • Semua MASTER DATA: brands, categories, colors, sizes, materials,
--     material_categories, expense_categories, sales_channels, suppliers,
--     supplier_categories, customers, warehouses, products, product_variants.
--   • COA: chart_of_accounts.
--   • Akun Finance: cash_accounts (beserta saldo awal).
--   • companies & user_profiles.
--
-- DIHAPUS (transaksi & saldo turunan): penjualan, retur, piutang, payment
--   request, payments, expenses, pembelian (PO/tunai), produksi (WO/SPK/GRN/
--   material issue), jurnal, transfer stok, serta stock_balances /
--   inventory_movements / material_stock_balances / material_movements.
--   Stok kembali 0 (bisa dibangun ulang dari transaksi baru).
--
-- Guard: menolak bila company bukan demo (is_demo = true).
-- =====================================================================
create or replace function public.reset_demo_data(p_company uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.companies where id = p_company and is_demo = true) then
    raise exception 'reset_demo_data ditolak: company % bukan demo (is_demo=false).', p_company;
  end if;

  -- ---- Transaksi (anak -> induk) ----
  delete from public.cash_purchase_lines  where company_id = p_company;
  delete from public.cash_purchases       where company_id = p_company;
  delete from public.stock_transfer_lines where company_id = p_company;
  delete from public.stock_transfers      where company_id = p_company;
  delete from public.sales_return_lines   where company_id = p_company;
  delete from public.sales_returns        where company_id = p_company;
  delete from public.sales_order_lines    where company_id = p_company;
  delete from public.sales_orders         where company_id = p_company;
  delete from public.sales_entries        where company_id = p_company;
  delete from public.receivables          where company_id = p_company;
  delete from public.payment_requests     where company_id = p_company;
  delete from public.payments             where company_id = p_company;
  delete from public.expenses             where company_id = p_company;
  delete from public.spk_costing          where company_id = p_company;
  delete from public.material_issue_lines where company_id = p_company;
  delete from public.material_issues      where company_id = p_company;
  delete from public.fg_receipt_lines     where company_id = p_company;
  delete from public.fg_receipts          where company_id = p_company;
  delete from public.production_po_lines  where company_id = p_company;
  delete from public.production_pos       where company_id = p_company;
  delete from public.purchase_order_lines where company_id = p_company;
  delete from public.purchase_orders      where company_id = p_company;
  delete from public.work_order_specs     where company_id = p_company;
  delete from public.work_order_lines     where company_id = p_company;
  delete from public.work_orders          where company_id = p_company;
  delete from public.journal_entry_lines  where company_id = p_company;
  delete from public.journal_entries      where company_id = p_company;

  -- ---- Saldo/pergerakan stok turunan (stok kembali 0) ----
  delete from public.stock_balances          where company_id = p_company;
  delete from public.inventory_movements     where company_id = p_company;
  delete from public.material_stock_balances where company_id = p_company;
  delete from public.material_movements      where company_id = p_company;

  -- =====================================================================
  -- SENGAJA DIPERTAHANKAN (JANGAN dihapus):
  --   brands, categories, colors, sizes, materials, material_categories,
  --   expense_categories, sales_channels, suppliers, supplier_categories,
  --   customers, warehouses, products, product_variants   (MASTER DATA)
  --   chart_of_accounts                                   (COA)
  --   cash_accounts                                       (Akun Finance)
  --   companies, user_profiles
  -- =====================================================================

  raise notice 'Data TRANSAKSI demo untuk company % sudah direset. Master data, COA, & akun kas/bank tetap.', p_company;
end $$;

-- Pemakaian (SQL editor / server action service role):
--   select public.reset_demo_data('11111111-1111-1111-1111-111111111111');
