"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEMO_COMPANY_ID } from "@/lib/supabase/config";

export type CategoryInput = {
  name: string;
  code: string;
  parentId: string | null;
  is_active: boolean;
};

type Result = { ok: true } | { ok: false; error: string };

export async function createCategory(input: CategoryInput): Promise<Result> {
  const supabase = createClient();
  const { error } = await supabase.from("categories").insert({
    company_id: DEMO_COMPANY_ID,
    brand_id: null, // kategori dipakai bersama semua brand
    parent_id: input.parentId,
    code: input.code.trim(),
    name: input.name.trim(),
    is_active: input.is_active,
    is_demo: false,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/master-data/categories");
  return { ok: true };
}

export async function updateCategory(id: string, input: CategoryInput): Promise<Result> {
  const supabase = createClient();
  const { error } = await supabase
    .from("categories")
    .update({
      parent_id: input.parentId,
      code: input.code.trim(),
      name: input.name.trim(),
      is_active: input.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/master-data/categories");
  return { ok: true };
}

/** Soft delete: sembunyikan kategori + sub-kategorinya sekaligus. */
export async function deleteCategory(id: string): Promise<Result> {
  const supabase = createClient();
  const { error } = await supabase
    .from("categories")
    .update({ deleted_at: new Date().toISOString() })
    .or(`id.eq.${id},parent_id.eq.${id}`);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/master-data/categories");
  return { ok: true };
}
