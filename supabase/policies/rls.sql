-- =====================================================================
-- ROW-LEVEL SECURITY — isolasi multi-brand (blueprint Bab 4.4 & Bab 8/R1)
-- Jalankan SETELAH tabel dibuat (drizzle db:push).
-- Prinsip: akses data lewat Supabase client (JWT user) -> RLS berlaku.
-- =====================================================================

-- Peta akses user -> brand (siapa boleh lihat brand mana).
create table if not exists public.user_brand_access (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null,
  brand_id   uuid,                 -- null = akses seluruh brand di company (owner/director/auditor)
  role       text not null default 'viewer'
);

-- Cegah duplikat (brand_id null diperlakukan sebagai satu nilai).
create unique index if not exists uq_user_brand_access
  on public.user_brand_access (user_id, company_id, coalesce(brand_id, '00000000-0000-0000-0000-000000000000'::uuid));

alter table public.user_brand_access enable row level security;
drop policy if exists uba_self on public.user_brand_access;
create policy uba_self on public.user_brand_access
  for select using (user_id = auth.uid());

-- Helper: company & brand yang boleh diakses user saat ini.
create or replace function public.current_company_ids() returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct company_id), '{}')
  from public.user_brand_access where user_id = auth.uid();
$$;

create or replace function public.current_brand_ids() returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct brand_id), '{}')
  from public.user_brand_access
  where user_id = auth.uid() and brand_id is not null;
$$;

create or replace function public.has_all_brands(p_company uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_brand_access
    where user_id = auth.uid() and company_id = p_company and brand_id is null
  );
$$;

-- Beri hak akses tabel ke role 'authenticated' (RLS tetap membatasi baris).
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- Companies pakai kolom id (bukan company_id) -> policy khusus.
alter table public.companies enable row level security;
drop policy if exists companies_tenant on public.companies;
create policy companies_tenant on public.companies
  using (id = any (public.current_company_ids()))
  with check (id = any (public.current_company_ids()));

-- Brands juga pakai kolom id sebagai identitas brand -> policy khusus.
alter table public.brands enable row level security;
drop policy if exists brands_tenant on public.brands;
create policy brands_tenant on public.brands
  using (company_id = any (public.current_company_ids())
    and (id = any (public.current_brand_ids()) or public.has_all_brands(company_id)))
  with check (company_id = any (public.current_company_ids())
    and (id = any (public.current_brand_ids()) or public.has_all_brands(company_id)));

-- Terapkan RLS + policy standar ke seluruh tabel bisnis multi-tenant.
do $$
declare
  t text;
  pol text;
  tables text[] := array[
    'products','product_variants','suppliers','customers','warehouses',
    'inventory_movements','stock_balances',
    'chart_of_accounts','journal_entries','journal_entry_lines'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security;', t);
    pol := t || '_tenant';
    execute format('drop policy if exists %I on public.%I;', pol, t);
    execute format(
      'create policy %I on public.%I '
      || 'using (company_id = any (public.current_company_ids()) '
      || 'and (brand_id is null or brand_id = any (public.current_brand_ids()) or public.has_all_brands(company_id))) '
      || 'with check (company_id = any (public.current_company_ids()) '
      || 'and (brand_id is null or brand_id = any (public.current_brand_ids()) or public.has_all_brands(company_id)));',
      pol, t
    );
  end loop;
end $$;
