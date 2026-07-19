-- =====================================================================
-- RESET DEMO DATA (blueprint Bab 12)
-- Menghapus SELURUH data di sebuah Company DEMO dalam SATU transaksi,
-- dengan urutan dependensi yang benar, lalu (opsional) membangun ulang
-- saldo turunan. Data/logic produksi TIDAK tersentuh.
--
-- Aman karena:
--  1) Data demo terisolasi di company_id tersendiri (+ penanda is_demo).
--  2) Hapus anak -> induk sehingga tidak menabrak foreign key.
--  3) stock_balances selalu bisa dibangun ulang dari inventory_movements.
--
-- Guard: fungsi menolak jika company bukan penanda demo (is_demo = true).
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

  -- Urutan HAPUS: dari tabel paling "anak" ke "induk".
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
  delete from public.cash_accounts        where company_id = p_company;
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
  delete from public.work_order_lines    where company_id = p_company;
  delete from public.work_orders         where company_id = p_company;
  delete from public.journal_entry_lines where company_id = p_company;
  delete from public.journal_entries     where company_id = p_company;
  delete from public.stock_balances      where company_id = p_company;
  delete from public.inventory_movements where company_id = p_company;
  delete from public.material_stock_balances where company_id = p_company;
  delete from public.material_movements  where company_id = p_company;
  delete from public.product_variants    where company_id = p_company;
  delete from public.products            where company_id = p_company;
  delete from public.categories          where company_id = p_company;
  delete from public.colors              where company_id = p_company;
  delete from public.sizes               where company_id = p_company;
  delete from public.materials           where company_id = p_company;
  delete from public.material_categories where company_id = p_company;
  delete from public.expense_categories  where company_id = p_company;
  delete from public.sales_channels      where company_id = p_company;
  delete from public.suppliers           where company_id = p_company;
  delete from public.supplier_categories where company_id = p_company;
  delete from public.customers           where company_id = p_company;
  delete from public.warehouses          where company_id = p_company;
  delete from public.chart_of_accounts   where company_id = p_company;
  delete from public.brands              where company_id = p_company;
  -- companies & user_brand_access sengaja DIPERTAHANKAN agar tenant demo tetap ada
  -- (siap dimuati sample lagi). Hapus baris companies hanya bila benar-benar ingin membuang tenant.

  raise notice 'Demo data untuk company % sudah direset bersih.', p_company;
end $$;

-- Contoh pemakaian (dari SQL editor / Server Action dengan service role):
--   select public.reset_demo_data('<uuid-company-demo>');
