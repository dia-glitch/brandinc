-- =============================================================
-- Launch date per produk (parent SKU / style). Diisi setelah proses akhir,
-- saat rencana launch sudah fix. Menjadi pemicu perhitungan aging produk,
-- sell-through, dan aging stock di halaman "Lifecycle Produk".
-- Boleh kosong (belum ditentukan). Satu tanggal per produk (bukan per ukuran).
-- =============================================================
alter table public.products add column if not exists launch_date date;
