/** True bila kredensial Supabase sudah diisi di .env. */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/** ID Company DEMO (dari seed). Dipakai untuk memberi akses awal & reset demo. */
export const DEMO_COMPANY_ID = "11111111-1111-1111-1111-111111111111";
