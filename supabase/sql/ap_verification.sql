-- =====================================================================
-- VERIFIKASI FINANCE untuk Hutang (AP).
-- Payable (invoice bahan PO / jasa produksi GRN) diverifikasi finance dulu
-- sebelum masuk antrian bayar (Finance Desk). Baris = invoice terverifikasi.
-- Status alur: Belum Verifikasi -> Terverifikasi -> (bayar di Payment Today) -> Lunas.
-- Jalankan di Supabase SQL Editor. Idempotent (aman diulang).
-- =====================================================================
create table if not exists public.ap_verifications (
  invoice_no  text primary key,
  verified_at timestamptz not null default now(),
  verified_by text
);

-- Pola DEMO: matikan RLS. Tambahan policy permissive sbg cadangan bila RLS
-- ter-enable lagi (mis. dari Table Editor / script global).
alter table public.ap_verifications disable row level security;
drop policy if exists ap_verifications_all on public.ap_verifications;
create policy ap_verifications_all on public.ap_verifications for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on public.ap_verifications to anon, authenticated;
