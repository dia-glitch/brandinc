-- =====================================================================
-- KATALOG — foto real produk (terpisah dari foto SPK).
-- 1) Kolom catalog_image_url di products (1 foto utama per produk/style).
-- 2) Bucket 'catalog-images' (Public) + perbarui policy storage semua bucket app.
-- Jalankan di Supabase SQL Editor. Idempotent (aman diulang).
-- =====================================================================

alter table public.products add column if not exists catalog_image_url text;

insert into storage.buckets (id, name, public) values ('catalog-images', 'catalog-images', true)
  on conflict (id) do update set public = true;

drop policy if exists "brandinc_read"   on storage.objects;
drop policy if exists "brandinc_insert" on storage.objects;
drop policy if exists "brandinc_update" on storage.objects;
drop policy if exists "brandinc_delete" on storage.objects;

create policy "brandinc_read" on storage.objects
  for select to public
  using (bucket_id in ('payment-docs', 'spk-images', 'catalog-images'));

create policy "brandinc_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('payment-docs', 'spk-images', 'catalog-images'));

create policy "brandinc_update" on storage.objects
  for update to authenticated
  using (bucket_id in ('payment-docs', 'spk-images', 'catalog-images'));

create policy "brandinc_delete" on storage.objects
  for delete to authenticated
  using (bucket_id in ('payment-docs', 'spk-images', 'catalog-images'));
