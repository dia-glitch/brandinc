"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/roles";
import { ROLE_OPTIONS, normalizeRole } from "@/lib/permissions";

export async function updateUserRole(userId: string, role: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  if (!(await isAdmin(supabase))) return { ok: false, error: "Hanya admin yang boleh mengubah role pengguna." };
  if (!userId) return { ok: false, error: "User tidak valid." };

  const allowed = new Set(ROLE_OPTIONS.map((r) => r.value));
  const next = normalizeRole(role);
  if (!allowed.has(next)) return { ok: false, error: "Role tidak dikenal." };

  const { error } = await supabase.from("user_profiles").update({ role: next }).eq("id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/users");
  return { ok: true };
}
