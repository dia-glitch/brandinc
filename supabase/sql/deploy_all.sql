-- =====================================================================
-- DEPLOY_ALL.sql — Brand.Inc
-- Jalankan SEKALI di Supabase SQL Editor (New query → paste → Run).
-- Gabungan semua migrasi. Idempotent (aman diulang).
-- =====================================================================

-- ========== 1. RLS OFF (pola DEMO, kontrol akses di aplikasi) ==========

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

-- ========== 2. DISTRIBUTION — alur & kolom ==========
-- Kolom tahapan pada stock_transfers
alter table public.stock_transfers add column if not exists requested_by text;
alter table public.stock_transfers add column if not exists packed_by    text;
alter table public.stock_transfers add column if not exists packed_at    date;
alter table public.stock_transfers add column if not exists completed_at date;

-- Qty real dikirim + alasan selisih (anomali) pada baris transfer
alter table public.stock_transfer_lines add column if not exists qty_packed   numeric(18,4);
alter table public.stock_transfer_lines add column if not exists anomaly_note text;

-- Default status untuk request baru
alter table public.stock_transfers alter column status set default 'requested';

-- Normalisasi data lama: transfer lama (status 'done') dianggap sudah selesai
update public.stock_transfers set status = 'completed', completed_at = coalesce(completed_at, transfer_date)
where status = 'done';

-- Pastikan RLS mati (pola DEMO) — agar semua role melihat data yang sama
alter table public.stock_transfers      disable row level security;
alter table public.stock_transfer_lines disable row level security;

-- ========== 3. PAYMENT REQUEST & EXPENSES — vendor/PIC ==========

-- Payment Request
alter table public.payment_requests add column if not exists requester             text;
alter table public.payment_requests add column if not exists vendor_bank            text;
alter table public.payment_requests add column if not exists vendor_account_no      text;
alter table public.payment_requests add column if not exists vendor_account_holder  text;

-- Expenses
alter table public.expenses add column if not exists requester             text;
alter table public.expenses add column if not exists vendor_bank            text;
alter table public.expenses add column if not exists vendor_account_no      text;
alter table public.expenses add column if not exists vendor_account_holder  text;

-- ========== 4. ROLES / RBAC — kolom, backfill user, set admin ==========
-- 1) Pastikan kolom profil ada
alter table public.user_profiles add column if not exists email text;
alter table public.user_profiles add column if not exists name  text;
alter table public.user_profiles add column if not exists role  text not null default 'staff';

-- 2) Nonaktifkan RLS (pola DEMO) agar insert/list profil berjalan
alter table public.user_profiles disable row level security;

-- 3) BACKFILL: tarik semua user dari auth.users ke user_profiles
--    (supaya member yang sudah ada langsung muncul di Settings › Pengguna)
insert into public.user_profiles (id, email, role)
select u.id, u.email, 'staff'
from   auth.users u
left   join public.user_profiles p on p.id = u.id
where  p.id is null;

-- 3b) Lengkapi email profil dari auth.users (untuk yang masih kosong)
update public.user_profiles p
set    email = u.email
from   auth.users u
where  p.id = u.id and (p.email is null or p.email = '');

-- 4) Jadikan akun Anda ADMIN (WAJIB — agar tidak terkunci)
--    Ganti alamat email bila perlu.
update public.user_profiles p
set    role = 'admin', email = coalesce(nullif(p.email,''), u.email)
from   auth.users u
where  p.id = u.id and u.email = 'dia@modatrifashindo.com';

-- (opsional) lihat hasilnya
-- select id, email, name, role from public.user_profiles order by created_at;

-- =====================================================================
-- Nilai role yang valid (untuk kolom role):
--   admin, director, head, finance, designer, rnd, mdp, purchasing, qc,
--   warehouse_inbound, warehouse_inventory, warehouse_material,
--   warehouse_outbound, marketing, md_sales
-- (role 'staff' = bawaan minimal: hanya Dashboard, sampai admin menetapkan)
--
-- Menetapkan role bisa lewat halaman Settings › Pengguna (lebih praktis),
-- atau manual, contoh:
--   update public.user_profiles set role='finance'
--   where email='budi@contoh.com';
-- =====================================================================
