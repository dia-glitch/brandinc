"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/roles";
import { invalidateMatrix } from "@/lib/rbac";
import { applyOverrides, MATRIX_ROLES, PAGE_KEYS, type AccessOverride } from "@/lib/permissions";
import type { Cell, SaveResult } from "./types";

/**
 * Simpan matriks akses (full snapshot semua sel role×halaman). Hanya admin.
 * Menulis ke role_page_access (upsert), lalu terapkan langsung + paksa instance
 * lain reload + refresh layout supaya menu & gating ikut berubah.
 */
export async function saveMatrix(rows: { role: string; page_key: string; level: Cell }[]): Promise<SaveResult> {
  const supabase = createClient();
  if ((await getRole(supabase)) !== "admin") {
    return { ok: false, error: "Hanya admin yang boleh mengubah akses halaman." };
  }
  const validRoles = new Set<string>(MATRIX_ROLES as string[]);
  const validKeys = new Set<string>(PAGE_KEYS as string[]);
  const clean = rows.filter(
    (r) => validRoles.has(r.role) && validKeys.has(r.page_key) && ["A", "L", "none"].includes(r.level)
  );
  const now = new Date().toISOString();
  const payload = clean.map((r) => ({ role: r.role, page_key: r.page_key, level: r.level, updated_at: now }));

  const { error } = await supabase.from("role_page_access").upsert(payload, { onConflict: "role,page_key" });
  if (error) return { ok: false, error: error.message };

  applyOverrides(clean as AccessOverride[]); // efek langsung di instance ini
  invalidateMatrix(); // instance lain reload pada request berikutnya
  revalidatePath("/", "layout"); // refresh menu & halaman
  return { ok: true };
}
