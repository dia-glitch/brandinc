-- =====================================================================
-- SETUP ROLE / RBAC — Brand.Inc
-- Jalankan di Supabase SQL Editor. Aman diulang (idempotent).
-- =====================================================================

-- 1) Pastikan kolom profil ada
alter table public.user_profiles add column if not exists email text;
alter table public.user_profiles add column if not exists name  text;
alter table public.user_profiles add column if not exists role  text not null default 'staff';

-- 2) Nonaktifkan RLS (pola DEMO) agar insert/list profil berjalan
alter table public.user_profiles disable row level security;

-- 3) BACKFILL: tarik semua user dari auth.users ke user_profiles
--    (supaya member yang sudah ada langsung muncul di Settings › Pengguna)
insert into public.user_profiles (id, email, role)
select u.id, u.email, 'staff'
from   auth.users u
left   join public.user_profiles p on p.id = u.id
where  p.id is null;

-- 3b) Lengkapi email profil dari auth.users (untuk yang masih kosong)
update public.user_profiles p
set    email = u.email
from   auth.users u
where  p.id = u.id and (p.email is null or p.email = '');

-- 4) Jadikan akun Anda ADMIN (WAJIB — agar tidak terkunci)
--    Ganti alamat email bila perlu.
update public.user_profiles p
set    role = 'admin', email = coalesce(nullif(p.email,''), u.email)
from   auth.users u
where  p.id = u.id and u.email = 'dia@modatrifashindo.com';

-- (opsional) lihat hasilnya
-- select id, email, name, role from public.user_profiles order by created_at;

-- =====================================================================
-- Nilai role yang valid (untuk kolom role):
--   admin, director, head, finance, designer, rnd, mdp, purchasing, qc,
--   warehouse_inbound, warehouse_inventory, warehouse_material,
--   warehouse_outbound, marketing, md_sales
-- (role 'staff' = bawaan minimal: hanya Dashboard, sampai admin menetapkan)
--
-- Menetapkan role bisa lewat halaman Settings › Pengguna (lebih praktis),
-- atau manual, contoh:
--   update public.user_profiles set role='finance'
--   where email='budi@contoh.com';
-- =====================================================================
