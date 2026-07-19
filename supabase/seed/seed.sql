-- =====================================================================
-- SEED DATA DEMO (blueprint Bab 12)
-- Membuat satu Company DEMO + brand + master + CoA + sedikit transaksi.
-- Semua ber-is_demo = true dan berada di company demo → bisa direset bersih
-- via public.reset_demo_data(<company_id>).
-- Jalankan di SQL editor Supabase SETELAH tabel & RLS dibuat.
-- =====================================================================
do $$
declare
  c_demo uuid := '11111111-1111-1111-1111-111111111111';
  b_a    uuid := '22222222-2222-2222-2222-2222222222aa';
  b_b    uuid := '22222222-2222-2222-2222-2222222222bb';
  wh     uuid := gen_random_uuid();
  p1     uuid := gen_random_uuid();
  v1     uuid := gen_random_uuid();
begin
  -- Company & brand demo
  insert into public.companies (id, legal_name, code, base_currency, is_demo)
    values (c_demo, 'PT Moda Demo', 'DEMO', 'IDR', true)
    on conflict (id) do nothing;

  insert into public.brands (id, company_id, name, code, segment, is_active, is_demo) values
    (b_a, c_demo, 'Aurelia', 'BRD-A', 'Womenswear', true, true),
    (b_b, c_demo, 'Basique', 'BRD-B', 'Basics', true, true)
    on conflict (id) do nothing;

  -- Gudang
  insert into public.warehouses (company_id, brand_id, is_demo, code, name, kind)
    values (c_demo, null, true, 'WH-01', 'Gudang Pusat', 'warehouse')
    returning id into wh;

  -- Produk + SKU
  insert into public.products (id, company_id, brand_id, is_demo, style_code, name)
    values (p1, c_demo, b_a, true, 'DR-101', 'Sarah Dress');
  insert into public.product_variants (id, company_id, brand_id, is_demo, product_id, sku, color, size, retail_price, standard_cost)
    values (v1, c_demo, b_a, true, p1, 'DR-101-BLK-M', 'Black', 'M', 349000, 145000);

  -- Bagan akun minimal
  insert into public.chart_of_accounts (company_id, brand_id, is_demo, code, name, type) values
    (c_demo, null, true, '1-1200', 'Persediaan Barang Jadi', 'asset'),
    (c_demo, null, true, '4-1000', 'Penjualan', 'revenue'),
    (c_demo, null, true, '5-1000', 'Harga Pokok Penjualan', 'expense'),
    (c_demo, null, true, '1-1000', 'Kas & Bank', 'asset');

  -- Contoh 1 pergerakan stok masuk (receipt) + saldo awal
  insert into public.inventory_movements (company_id, brand_id, is_demo, variant_id, warehouse_id, movement_type, stock_status, qty, unit_cost)
    values (c_demo, b_a, true, v1, wh, 'receipt', 'available', 50, 145000);
  insert into public.stock_balances (company_id, brand_id, is_demo, variant_id, warehouse_id, stock_status, qty_on_hand, moving_avg_cost)
    values (c_demo, b_a, true, v1, wh, 'available', 50, 145000)
    on conflict (variant_id, warehouse_id, stock_status)
    do update set qty_on_hand = excluded.qty_on_hand, moving_avg_cost = excluded.moving_avg_cost;

  raise notice 'Seed demo selesai. Company DEMO id = %', c_demo;
end $$;
