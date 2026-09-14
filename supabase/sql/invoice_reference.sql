-- =====================================================================
-- INVOICE REFERENCE — kolom tambahan di fg_receipts.
-- invoice_no      = nomor referensi internal (auto, sudah ada)
-- supplier_invoice_no = nomor invoice ASLI dari supplier (diisi manual)
-- invoice_due     = jatuh tempo (auto +14 hari, bisa diubah)
-- invoice_note    = catatan
-- invoice_docs    = lampiran (invoice asli supplier, surat jalan, dll) [{name,url}]
-- Jalankan di Supabase SQL Editor. Idempotent.
-- =====================================================================
alter table public.fg_receipts add column if not exists supplier_invoice_no text;
alter table public.fg_receipts add column if not exists invoice_due date;
alter table public.fg_receipts add column if not exists invoice_note text;
alter table public.fg_receipts add column if not exists invoice_docs jsonb not null default '[]'::jsonb;
