import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase READ-ONLY tanpa cookie/sesi (anon key).
 * Aman dipakai DI DALAM unstable_cache karena tidak menyentuh cookies()/headers()
 * (yang akan melempar error di konteks cache). RLS demo dinonaktifkan → anon
 * boleh membaca tabel operasional. Jangan pakai untuk data per-user.
 */
export function createReadClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
