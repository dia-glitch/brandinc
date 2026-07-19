-- =====================================================================
-- FIX: matikan RLS pada tabel yang sebelumnya kelewat.
-- product_variants → sumber SKU/produk (Inventory Katalog & Stok per Lokasi).
-- spk_costing → costing SPK produksi.
-- Jalankan di Supabase SQL Editor. Idempotent.
-- =====================================================================
alter table public.product_variants disable row level security;
alter table public.spk_costing       disable row level security;
