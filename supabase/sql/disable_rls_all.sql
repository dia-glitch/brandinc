-- =====================================================================
-- MATIKAN RLS untuk semua tabel (pola DEMO single-tenant).
-- Aman dijalankan berulang. Jalankan di Supabase SQL Editor.
-- Tujuan: semua user login (apapun role-nya) melihat data DEMO yang sama;
-- pembatasan akses diatur di aplikasi (RBAC), bukan di RLS.
-- =====================================================================

alter table public.brands disable row level security;
alter table public.cash_accounts disable row level security;
alter table public.cash_purchase_lines disable row level security;
alter table public.cash_purchases disable row level security;
alter table public.categories disable row level security;
alter table public.chart_of_accounts disable row level security;
alter table public.colors disable row level security;
alter table public.companies disable row level security;
alter table public.customers disable row level security;
alter table public.expense_categories disable row level security;
alter table public.expenses disable row level security;
alter table public.fg_receipt_lines disable row level security;
alter table public.fg_receipts disable row level security;
alter table public.inventory_movements disable row level security;
alter table public.journal_entries disable row level security;
alter table public.journal_entry_lines disable row level security;
alter table public.material_categories disable row level security;
alter table public.material_issue_lines disable row level security;
alter table public.material_issues disable row level security;
alter table public.material_movements disable row level security;
alter table public.material_stock_balances disable row level security;
alter table public.materials disable row level security;
alter table public.payment_requests disable row level security;
alter table public.payments disable row level security;
alter table public.production_po_lines disable row level security;
alter table public.production_pos disable row level security;
alter table public.products disable row level security;
alter table public.product_variants disable row level security;
alter table public.spk_costing disable row level security;
alter table public.purchase_order_lines disable row level security;
alter table public.purchase_orders disable row level security;
alter table public.receivables disable row level security;
alter table public.sales_channels disable row level security;
alter table public.sales_entries disable row level security;
alter table public.sales_order_lines disable row level security;
alter table public.sales_orders disable row level security;
alter table public.sales_return_lines disable row level security;
alter table public.sales_returns disable row level security;
alter table public.sizes disable row level security;
alter table public.stock_balances disable row level security;
alter table public.stock_transfer_lines disable row level security;
alter table public.stock_transfers disable row level security;
alter table public.supplier_categories disable row level security;
alter table public.suppliers disable row level security;
alter table public.user_profiles disable row level security;
alter table public.warehouses disable row level security;
alter table public.work_order_lines disable row level security;
alter table public.work_order_specs disable row level security;
alter table public.work_orders disable row level security;
