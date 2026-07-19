"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client untuk komponen browser. Memakai anon key + sesi user,
 * sehingga SEMUA query menghormati Row-Level Security (isolasi multi-brand).
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
