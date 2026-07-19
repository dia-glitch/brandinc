-- =====================================================================
-- STORAGE — buat bucket 'payment-docs' & 'spk-images' (Public) + policy.
-- Jalankan di Supabase SQL Editor. Idempotent (aman diulang).
-- Bucket public → getPublicUrl bisa dibaca; policy → user login bisa upload.
-- =====================================================================

-- 1) Buat / set bucket jadi PUBLIC
insert into storage.buckets (id, name, public) values ('payment-docs', 'payment-docs', true)
  on conflict (id) do update set public = true;
insert into storage.buckets (id, name, public) values ('spk-images', 'spk-images', true)
  on conflict (id) do update set public = true;

-- 2) Policy pada storage.objects (khusus 2 bucket ini)
drop policy if exists "brandinc_read"   on storage.objects;
drop policy if exists "brandinc_insert" on storage.objects;
drop policy if exists "brandinc_update" on storage.objects;
drop policy if exists "brandinc_delete" on storage.objects;

-- Baca: publik (agar lampiran & foto bisa ditampilkan lewat URL)
create policy "brandinc_read" on storage.objects
  for select to public
  using (bucket_id in ('payment-docs', 'spk-images'));

-- Upload / ubah / hapus: user login (authenticated)
create policy "brandinc_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('payment-docs', 'spk-images'));

create policy "brandinc_update" on storage.objects
  for update to authenticated
  using (bucket_id in ('payment-docs', 'spk-images'));

create policy "brandinc_delete" on storage.objects
  for delete to authenticated
  using (bucket_id in ('payment-docs', 'spk-images'));
