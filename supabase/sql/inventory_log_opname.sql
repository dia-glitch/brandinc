-- =====================================================================
-- Inventory Log & Stock Opname
-- Kolom keterangan pada ledger (untuk alasan penyesuaian/opname).
-- Jalankan di Supabase SQL Editor. Idempotent.
-- =====================================================================
alter table public.inventory_movements add column if not exists note text;

-- (RLS sudah dimatikan di disable_rls_all; baris di bawah aman diulang.)
alter table public.inventory_movements disable row level security;
alter table public.stock_balances      disable row level security;
