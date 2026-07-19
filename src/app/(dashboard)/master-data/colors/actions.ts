"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEMO_COMPANY_ID } from "@/lib/supabase/config";
import { getRole } from "@/lib/roles";
import { canAct } from "@/lib/permissions";

export type ColorInput = {
  name: string;
  code: string;
  hex: string;
  parentId: string | null;
  is_active: boolean;
};

type Result = { ok: true } | { ok: false; error: string };

export async function createColor(input: ColorInput): Promise<Result> {
  const supabase = createClient();
  if (!canAct(await getRole(supabase), "master_data")) return { ok: false, error: "Anda tidak punya akses untuk aksi ini." };
  const { error } = await supabase.from("colors").insert({
    company_id: DEMO_COMPANY_ID,
    brand_id: null,
    parent_id: input.parentId,
    name: input.name.trim(),
    code: input.code.trim() || null,
    hex: input.hex.trim() || null,
    is_active: input.is_active,
    is_demo: false,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/master-data/colors");
  return { ok: true };
}

export async function updateColor(id: string, input: ColorInput): Promise<Result> {
  const supabase = createClient();
  if (!canAct(await getRole(supabase), "master_data")) return { ok: false, error: "Anda tidak punya akses untuk aksi ini." };
  const { error } = await supabase
    .from("colors")
    .update({
      parent_id: input.parentId,
      name: input.name.trim(),
      code: input.code.trim() || null,
      hex: input.hex.trim() || null,
      is_active: input.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/master-data/colors");
  return { ok: true };
}

/** Soft delete: warna + sub-warnanya (kalau ini parent) sekaligus. */
export async function deleteColor(id: string): Promise<Result> {
  const supabase = createClient();
  if (!canAct(await getRole(supabase), "master_data")) return { ok: false, error: "Anda tidak punya akses untuk aksi ini." };
  const { error } = await supabase
    .from("colors")
    .update({ deleted_at: new Date().toISOString() })
    .or(`id.eq.${id},parent_id.eq.${id}`);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/master-data/colors");
  return { ok: true };
}
