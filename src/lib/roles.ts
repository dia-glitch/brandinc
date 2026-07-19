import type { createClient } from "@/lib/supabase/server";
import { type Role, type PageKey, accessLevel, canAct, canView, normalizeRole } from "@/lib/permissions";

type SB = ReturnType<typeof createClient>;
type SupabaseLike = { from: (table: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

export type { Role, PageKey };

/**
 * Resolusi role dari user_profiles.
 * Bootstrap: tabel kosong → user pertama = admin. Tabel error/hilang → admin (fail-open, jangan kunci).
 * Baris belum ada tapi tabel terisi → "staff" (akses minimal sampai admin menetapkan).
 */
export async function resolveRole(supabase: SupabaseLike, userId: string): Promise<Role> {
  try {
    const { data: prof, error } = await supabase.from("user_profiles").select("role").eq("id", userId).maybeSingle();
    if (error) return "admin";
    if (prof?.role) return normalizeRole(prof.role);
    const { count } = await supabase.from("user_profiles").select("id", { count: "exact", head: true });
    return (count ?? 0) === 0 ? "admin" : "staff";
  } catch {
    return "admin";
  }
}

/** Role user aktif (server). */
export async function getRole(supabase: SB): Promise<Role> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return "staff";
    return resolveRole(supabase as unknown as SupabaseLike, user.id);
  } catch {
    return "admin";
  }
}

/** Alias lama. */
export const getUserRole = getRole;

export async function isAdmin(supabase: SB): Promise<boolean> {
  return (await getRole(supabase)) === "admin";
}

/** Nama tampilan user login (PIC internal) — untuk isi otomatis field Pemohon. */
export async function getUserName(supabase: SB): Promise<string> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return "";
    const { data: prof } = await supabase.from("user_profiles").select("name,email").eq("id", user.id).maybeSingle();
    return ((prof?.name as string) || (prof?.email as string) || user.email || "").trim();
  } catch {
    return "";
  }
}

/** Helper akses untuk halaman/aksi berbasis role yang sudah di-resolve. */
export async function getAccess(supabase: SB) {
  const role = await getRole(supabase);
  return {
    role,
    level: (key: PageKey) => accessLevel(role, key),
    canView: (key: PageKey) => canView(role, key),
    canAct: (key: PageKey) => canAct(role, key),
  };
}
