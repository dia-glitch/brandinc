-- ============================================================
-- GO-LIVE — MULAI BERSIH
-- Hapus SEMUA data demo (transaksi + master) supaya mulai dari kosong.
-- TETAP: brands, warehouses (gudang), cash_accounts (akun kas/bank),
--        chart_of_accounts (COA), customers.
-- Jalankan di Supabase → SQL Editor → RUN. Aman diulang.
-- ============================================================
begin;

-- 1) TRANSAKSI & saldo turunan (child -> parent)
delete from cash_purchase_lines;
delete from cash_purchases;
delete from stock_transfer_lines;
delete from stock_transfers;
delete from sales_return_lines;
delete from sales_returns;
delete from sales_order_lines;
delete from sales_orders;
delete from sales_entries;
delete from receivables;
delete from payment_requests;
delete from payments;
delete from expenses;
delete from spk_costing;
delete from material_issue_lines;
delete from material_issues;
delete from fg_receipt_lines;
delete from fg_receipts;
delete from production_po_lines;
delete from production_pos;
delete from purchase_order_lines;
delete from purchase_orders;
delete from work_order_specs;
delete from work_order_lines;
delete from work_orders;
delete from journal_entry_lines;
delete from journal_entries;
delete from stock_balances;
delete from inventory_movements;
delete from material_stock_balances;
delete from material_movements;

-- tabel verifikasi/antrian pembayaran (hapus hanya bila tabelnya ada)
do $$ begin
  if to_regclass('public.ap_verifications') is not null then delete from ap_verifications; end if;
  if to_regclass('public.payment_queue')   is not null then delete from payment_queue;   end if;
end $$;

-- 2) MASTER DATA DEMO (child -> parent, hormati FK)
delete from product_variants;
delete from products;
delete from materials;
delete from suppliers;
delete from categories;
delete from colors;
delete from sizes;
delete from material_categories;
delete from supplier_categories;

-- 3) Nol-kan saldo awal kas/bank (akun tetap ada -> Neraca Kas & Bank + Laba Ditahan jadi 0)
update cash_accounts set opening_balance = 0;

commit;

-- Cek hasil (harus 0 semua)
select
  (select count(*) from materials)         as materials,
  (select count(*) from products)          as products,
  (select count(*) from product_variants)  as variants,
  (select count(*) from suppliers)         as suppliers,
  (select count(*) from categories)        as categories,
  (select count(*) from colors)            as colors,
  (select count(*) from sizes)             as sizes;
