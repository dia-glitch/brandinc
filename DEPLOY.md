# Deploy Brand.Inc — Panduan Langkah demi Langkah

Stack: **Next.js 14** (frontend + server actions) di **Vercel**, backend **Supabase** (Postgres + Auth + Storage).
Runtime hanya butuh 2 environment variable Supabase. Total ~30–45 menit.

---

## Ringkasan alur

1. Siapkan backend Supabase (SQL migrasi, Storage bucket, Auth).
2. Push kode ke GitHub.
3. Import ke Vercel + isi env var → Deploy.
4. Hubungkan domain Vercel ke Supabase Auth.
5. Verifikasi + buat akun tim.

---

## 1. Backend — Supabase

Pakai project Supabase yang selama ini dipakai (tidak perlu bikin baru).

**1a. Catat kredensial.** Supabase Dashboard → **Project Settings → API**:
- `Project URL` → jadi `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` key → jadi `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**1b. Jalankan migrasi database.** SQL Editor → **New query** → tempel seluruh isi
`supabase/sql/deploy_all.sql` → **Run**. File ini idempotent (aman diulang) dan mencakup:
kolom-kolom baru (distribution, vendor/PIC, role), matikan RLS, backfill user, set admin.
> Kalau email admin bukan `dia@modatrifashindo.com`, ubah baris di bagian "Jadikan akun Anda ADMIN".

**1c. Buat Storage bucket** (untuk lampiran & foto). Storage → **New bucket**, buat dua bucket **Public**:
- `payment-docs` (lampiran Payment Request)
- `spk-images` (foto SPK produksi)

**1d. Matikan pendaftaran publik** (PENTING — karena RLS mati, akses dijaga di aplikasi).
Authentication → **Sign In / Providers** → matikan "Allow new users to sign up",
atau batasi. Buat akun tim manual di Authentication → **Users → Add user**.

---

## 2. Push kode ke GitHub

Di folder proyek (mis. `brandinc`), lewat terminal:

```bash
git init
git add .
git commit -m "Brand.Inc ERP — initial deploy"
git branch -M main
# buat repo PRIVATE dulu di github.com, lalu:
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

> `.env` sudah masuk `.gitignore` — kredensial tidak akan ikut ter-push. Aman.

---

## 3. Deploy ke Vercel

1. Buka **vercel.com** → login (pakai GitHub) → **Add New… → Project**.
2. **Import** repo GitHub tadi.
3. Framework otomatis terdeteksi **Next.js** — biarkan Build Command & Output default.
4. Buka **Environment Variables**, tambahkan (untuk Production, Preview, Development):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL dari langkah 1a |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key dari langkah 1a |

5. Klik **Deploy**. Tunggu build selesai (~2 menit) → dapat URL `https://<nama>.vercel.app`.

> `DATABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY` **tidak perlu** di Vercel (hanya untuk skrip Drizzle lokal).

---

## 4. Hubungkan domain ke Supabase Auth

Supabase → Authentication → **URL Configuration**:
- **Site URL**: `https://<nama>.vercel.app`
- **Redirect URLs**: tambahkan `https://<nama>.vercel.app/**`

Tanpa ini, login bisa gagal redirect.

---

## 5. Verifikasi setelah live

1. Buka URL Vercel → login dengan akun admin.
2. **Accounting → Bagan Akun → "Isi COA Bawaan"** (sekali, agar kategori COA lengkap).
3. **Settings → Pengguna**: set role tiap anggota tim.
4. Uji cepat: buat Payment Request, cek Dashboard, cek Distribution.
5. Login dengan akun non-admin (mis. rnd) → pastikan menu & tombol terbatas sesuai role.

---

## Update berikutnya (setelah live)

- Ubah kode → `git add . && git commit -m "..." && git push` → Vercel auto-deploy.
- Ada perubahan tabel? jalankan file `.sql` terkait di Supabase SQL Editor.

---

## Catatan keamanan

- **RLS dimatikan** (mode DEMO single-company). Kontrol akses sepenuhnya di aplikasi (RBAC per role). Aman untuk ERP internal satu perusahaan **selama pendaftaran publik dimatikan** dan akun hanya dibuat manual oleh admin.
- Jangan pernah menaruh `service_role` key di env yang berawalan `NEXT_PUBLIC_` atau di sisi browser.
- Kalau ke depan mau multi-perusahaan / akses publik, perlu mengaktifkan kembali RLS dengan policy per company/brand.

---

## Alternatif hosting

Vercel paling mulus untuk Next.js. Netlify juga bisa (pakai plugin Next.js resmi) dengan env var yang sama; langkah Supabase identik.
