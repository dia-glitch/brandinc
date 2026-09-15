-- ============================================================
-- RESTORE MASTER DIMENSI (categories, colors, sizes)
-- yang terhapus tak sengaja. Dibangun ulang dari data yang terlihat.
-- Struktur 2-tingkat: Kategori LV1->LV2, Warna LV1->LV2; Ukuran flat.
-- Induk LV1 ("Pakaian", "Umum") = placeholder, bebas di-rename lewat app.
-- Aman diulang (on conflict di-skip via NOT EXISTS by name).
-- ============================================================
do $$
declare
  c_demo   uuid := '11111111-1111-1111-1111-111111111111';
  cat_par  uuid;
  col_par  uuid;
begin
  -- ---------- KATEGORI (LV1 induk + LV2 anak, kode LV2 dipakai utk SKU) ----------
  if not exists (select 1 from categories where company_id=c_demo and parent_id is null and name='Pakaian') then
    insert into categories (company_id, is_demo, parent_id, code, name)
      values (c_demo, false, null, 'PK', 'Pakaian') returning id into cat_par;
  else
    select id into cat_par from categories where company_id=c_demo and parent_id is null and name='Pakaian' limit 1;
  end if;

  insert into categories (company_id, is_demo, parent_id, code, name)
  select c_demo, false, cat_par, x.code, x.name
  from (values ('CR','Cardigan'), ('DS','Dress'), ('JK','Jacket')) as x(code,name)
  where not exists (select 1 from categories c where c.company_id=c_demo and c.parent_id=cat_par and c.name=x.name);

  -- ---------- WARNA (LV1 induk + LV2 anak) ----------
  if not exists (select 1 from colors where company_id=c_demo and parent_id is null and name='Umum') then
    insert into colors (company_id, is_demo, parent_id, name)
      values (c_demo, false, null, 'Umum') returning id into col_par;
  else
    select id into col_par from colors where company_id=c_demo and parent_id is null and name='Umum' limit 1;
  end if;

  insert into colors (company_id, is_demo, parent_id, name)
  select c_demo, false, col_par, x.name
  from (values ('Almond'), ('Blush'), ('Aqua Blue')) as x(name)
  where not exists (select 1 from colors c where c.company_id=c_demo and c.parent_id=col_par and c.name=x.name);

  -- ---------- UKURAN (flat, sort_order) ----------
  insert into sizes (company_id, is_demo, code, name, sort_order)
  select c_demo, false, x.code, x.name, x.ord
  from (values ('S','S',10), ('M','M',20), ('L','L',30), ('XL','XL',40),
               ('SM','S/M',25), ('F','Free',50)) as x(code,name,ord)
  where not exists (select 1 from sizes s where s.company_id=c_demo and s.name=x.name);

  raise notice 'Restore dimensi selesai.';
end $$;

-- Cek hasil
select 'categories' t, count(*) n from categories where deleted_at is null
union all select 'colors', count(*) from colors where deleted_at is null
union all select 'sizes',  count(*) from sizes  where deleted_at is null;
