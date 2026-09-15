-- =====================================================================
-- Manual close PO (Delivered) untuk Inbound/Receiving.
-- delivered_at != null  → PO ditutup manual (status "Selesai/Delivered").
-- Tidak mengubah kolom status produksi yang lain (open/partial/completed).
-- Jalankan di Supabase SQL Editor. Idempotent (aman diulang).
-- =====================================================================
alter table public.production_pos add column if not exists delivered_at timestamptz;
