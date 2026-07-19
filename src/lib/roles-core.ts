import { type Role, normalizeRole } from "@/lib/permissions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = { from: (table: string) => any };

/**
 * Resolusi role dari user_profiles — versi ringan tanpa import react/server,
 * aman dipakai di middleware (Edge runtime). Menerima client Supabase apa pun.
 * Bootstrap: tabel kosong → user pertama = admin. Error/hilang → admin (fail-open).
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
