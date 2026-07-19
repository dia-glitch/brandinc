"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEMO_COMPANY_ID } from "@/lib/supabase/config";

export type BrandInput = {
  name: string;
  code: string;
  segment: string;
  is_active: boolean;
};

type Result = { ok: true } | { ok: false; error: string };

/** Tambah brand baru ke database (RLS memastikan hanya user berwenang). */
export async function createBrand(input: BrandInput): Promise<Result> {
  const supabase = createClient();
  const { error } = await supabase.from("brands").insert({
    company_id: DEMO_COMPANY_ID,
    name: input.name.trim(),
    code: input.code.trim(),
    segment: input.segment.trim() || null,
    is_active: input.is_active,
    is_demo: false,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/master-data/brands");
  return { ok: true };
}

/** Ubah data brand yang sudah ada. */
export async function updateBrand(id: string, input: BrandInput): Promise<Result> {
  const supabase = createClient();
  const { error } = await supabase
    .from("brands")
    .update({
      name: input.name.trim(),
      code: input.code.trim(),
      segment: input.segment.trim() || null,
      is_active: input.is_active,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/master-data/brands");
  return { ok: true };
}

/** Soft delete: sembunyikan brand (deleted_at diisi), data tetap ada di DB. */
export async function deleteBrand(id: string): Promise<Result> {
  const supabase = createClient();
  const { error } = await supabase
    .from("brands")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/master-data/brands");
  return { ok: true };
}
