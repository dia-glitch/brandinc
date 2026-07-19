# Moda.OS — ERP Fashion (Increment 1: Fondasi)

Business Operating System (ERP Lite) untuk perusahaan fashion multi-brand.
Stack: **Next.js (App Router) · TypeScript · TailwindCSS · Drizzle ORM · Supabase (Postgres + Auth + RLS) · Netlify**.
Tema: **Minimalist** (Urbanist + palet Alice Blue / Honeydew / Vanila / Eerie Black / Ghost White).

> Increment ini berisi **fondasi Fase 0–1**: design system tema, app shell (sidebar + topbar + brand switcher + badge demo), halaman contoh (Dashboard, Master Data Brand, Impor Penjualan, Data Management), skema database inti (Drizzle), serta RLS + fungsi reset data demo + seed. Modul lain menyusul per roadmap.

---

## 1. Prasyarat
- Node.js 20+
- Akun **Supabase** (gratis cukup untuk mulai) dan akun **Netlify**
- Akun **GitHub** (untuk deploy otomatis Netlify)

## 2. Jalankan lokal (tanpa Supabase pun bisa dibuka)
```bash
npm install
npm run dev
# buka http://localhost:3000
```
Halaman & tema langsung tampil dengan data contoh. Untuk data nyata, konfigurasikan Supabase di bawah.

## 3. Setup Supabase
1. Buat project baru di Supabase.
2. Salin `.env.example` → `.env` dan isi:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Project Settings → API)
   - `DATABASE_URL` (Project Settings → Database → Connection string / **pooler port 6543**)
   - `SUPABASE_SERVICE_ROLE_KEY` (untuk seed/reset via server — jangan diekspos ke browser)
3. Buat tabel dari skema Drizzle:
   ```bash
   npm run db:push
   ```
4. Aktifkan keamanan & utilitas (jalankan di **SQL Editor** Supabase, berurutan):
   - `supabase/policies/rls.sql`  → Row-Level Security multi-brand
   - `supabase/functions/reset_demo_data.sql` → fungsi reset data demo
   - `supabase/seed/seed.sql` → isi Company DEMO + data sample
5. Beri user Anda akses brand: tambahkan baris di `public.user_brand_access`
   (`user_id` = id dari Auth → Users; `brand_id` = null untuk akses semua brand).

## 4. Deploy ke Netlify
1. Push repo ini ke GitHub.
2. Netlify → **Add new site → Import from GitHub** → pilih repo.
3. Build command & publish sudah diatur di `netlify.toml` (plugin `@netlify/plugin-nextjs`).
4. Set environment variables yang sama seperti `.env` di **Site settings → Environment variables**.
5. Deploy. Selesai.

---

## 5. Struktur folder (ringkas)
```
src/
  app/
    (dashboard)/            # semua halaman ber-shell
      page.tsx              # Dashboard eksekutif
      master-data/brands/   # contoh halaman master (pola list)
      sales/import/         # Impor penjualan harian (H+1)
      settings/data/        # 🧪 Reset data demo
      ...                   # modul lain (placeholder per fase)
    globals.css             # design tokens (light/dark)
    layout.tsx              # font Urbanist
  components/
    shell/                  # sidebar, topbar, nav-config
    ui/                     # button, card, badge (pola shadcn/ui)
    dashboard/              # chart
  lib/
    db/                     # Drizzle: schema (org, masterdata, inventory, accounting)
    supabase/               # client browser & server (RLS-aware)
    utils.ts
supabase/
  policies/rls.sql          # RLS multi-brand
  functions/reset_demo_data.sql
  seed/seed.sql
```

## 6. Prinsip yang sudah tertanam
- **Multi-brand + RLS**: setiap tabel bawa `company_id`/`brand_id`, isolasi dipaksakan di database.
- **Ledger append-only + moving average**: `inventory_movements` sumber kebenaran stok; `stock_balances` bisa dibangun ulang.
- **Double-entry**: `journal_entries` + `journal_entry_lines` (Σdebit=Σkredit).
- **Data demo bisa dihapus bersih**: semua data sample di Company DEMO + penanda `is_demo`, dihapus lewat `reset_demo_data()`.
- **Soft delete** untuk data bisnis (`deleted_at`), **audit columns** di semua tabel.

## 7. Berikutnya (roadmap)
Fase 2 Auth & RBAC → Fase 3 Master Data lengkap → Fase 4 Inventory → Fase 5 Sales Entry/Impor (auto jurnal + COGS). Lihat blueprint arsitektur (`erp-fashion-arsitektur.md`).
