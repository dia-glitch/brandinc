-- =====================================================================
-- FINANCE DESK / PAYMENT TODAY
-- Antrian "bayar hari ini". Item siap-bayar (AP, Expense, Payment Request
-- approved) ditandai di Finance Desk → muncul di tab Payment Today.
-- source: 'ap' | 'expense' | 'pr'. ref_key: invoice_no (ap) / id (expense,pr).
-- ref_type utk AP: 'material_invoice' | 'production_invoice' (utk posting).
-- Jalankan di Supabase SQL Editor. Idempotent (aman diulang).
-- =====================================================================
create table if not exists public.payment_queue (
  source     text not null,
  ref_key    text not null,
  ref_type   text,
  marked_at  timestamptz not null default now(),
  marked_by  text,
  primary key (source, ref_key)
);
alter table public.payment_queue disable row level security;
grant select, insert, update, delete on public.payment_queue to anon, authenticated;
