-- =====================================================================
-- Payment Request & Expenses: pisahkan Pemohon (PIC internal, otomatis)
-- dari data Vendor + rekening tujuan pembayaran. Jalankan di SQL Editor.
-- Aman diulang.
-- =====================================================================

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
