-- =====================================================================
-- DISTRIBUTION — alur bertahap (request → packed → completed)
-- Jalankan di Supabase SQL Editor. Aman diulang.
-- =====================================================================

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
