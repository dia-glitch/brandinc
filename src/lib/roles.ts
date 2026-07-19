import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { type Role, type PageKey, accessLevel, canAct, canView, normalizeRole } from "@/lib/permissions";
import { resolveRole } from "@/lib/roles-core";

type SB = ReturnType<typeof createClient>;

export type { Role, PageKey };
export { resolveRole };

/**
 * Ambil profil user aktif SEKALI per-render (di-cache React). Memanggil getRole /
 * getUserName / isAdmin berkali-kali dalam satu navigasi hanya menembak DB sekali.
 */
const loadProfile = cache(async (): Promise<{ role: Role; name: string }> => {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { role: "staff", name: "" };
    const { data: prof, error } = await supabase.from("user_profiles").select("role,name,email").eq("id", user.id).maybeSingle();
    if (error) return { role: "admin", name: (user.email ?? "").trim() };
    let role: Role;
    if (prof?.role) role = normalizeRole(prof.role);
    else {
      const { count } = await supabase.from("user_profiles").select("id", { count: "exact", head: true });
      role = (count ?? 0) === 0 ? "admin" : "staff";
    }
    const name = (((prof?.name as string) || (prof?.email as string) || user.email) ?? "").trim();
    return { role, name };
  } catch {
    return { role: "admin", name: "" };
  }
});

/** Role user aktif (server). Param supabase opsional & diabaikan — dedup via cache. */
export async function getRole(_supabase?: SB): Promise<Role> {
  return (await loadProfile()).role;
}

/** Alias lama. */
export const getUserRole = getRole;

export async function isAdmin(_supabase?: SB): Promise<boolean> {
  return (await getRole()) === "admin";
}

/** Nama tampilan user login (PIC internal) — untuk isi otomatis field Pemohon. */
export async function getUserName(_supabase?: SB): Promise<string> {
  return (await loadProfile()).name;
}

/** Helper akses untuk halaman/aksi berbasis role yang sudah di-resolve. */
export async function getAccess(_supabase?: SB) {
  const role = await getRole();
  return {
    role,
    level: (key: PageKey) => accessLevel(role, key),
    canView: (key: PageKey) => canView(role, key),
    canAct: (key: PageKey) => canAct(role, key),
  };
}
