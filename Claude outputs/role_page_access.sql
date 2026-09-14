-- =============================================================
-- RBAC dinamis: matriks akses per-role per-halaman (editable UI)
-- Level: 'A' = Aksi (lihat + ubah), 'L' = Lihat saja, 'none' = tanpa akses.
-- Tabel KOSONG = pakai default bawaan app (permissions.ts). Baris di sini
-- meng-override default per sel. admin selalu akses penuh (tidak disimpan di sini).
-- =============================================================
create table if not exists public.role_page_access (
  role       text not null,
  page_key   text not null,
  level      text not null check (level in ('A', 'L', 'none')),
  updated_at timestamptz not null default now(),
  primary key (role, page_key)
);

-- Demo memakai gating di level aplikasi (RLS dimatikan seperti tabel lain).
alter table public.role_page_access disable row level security;

-- (opsional) izinkan anon membaca — dibutuhkan client read-only saat hydrate.
grant select, insert, update, delete on public.role_page_access to anon, authenticated;
