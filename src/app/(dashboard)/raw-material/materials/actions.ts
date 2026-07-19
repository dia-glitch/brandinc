"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEMO_COMPANY_ID } from "@/lib/supabase/config";

type Result = { ok: true } | { ok: false; error: string };
function rv() { revalidatePath("/raw-material/materials"); }

export type MaterialInput = {
  name: string;
  brandId: string | null;
  categoryId: string | null;
  unit: string;
  is_active: boolean;
};

/** Kode material berikutnya per prefix kategori, mis. FB-0001. */
async function nextCode(supabase: ReturnType<typeof createClient>, prefix: string): Promise<string> {
  const { data } = await supabase.from("materials").select("code").like("code", `${prefix}-%`).order("code", { ascending: false }).limit(1);
  const last = (data?.[0]?.code as string | undefined) ?? "";
  const m = last.match(/(\d+)$/);
  return `${prefix}-` + String((m ? parseInt(m[1], 10) : 0) + 1).padStart(4, "0");
}

export async function createMaterial(input: MaterialInput): Promise<Result> {
  const supabase = createClient();
  // Ambil kode kategori untuk prefix
  let prefix = "MTR";
  if (input.categoryId) {
    const { data: cat } = await supabase.from("material_categories").select("code").eq("id", input.categoryId).maybeSingle();
    const c = (cat?.code as string | undefined)?.trim();
    if (c) prefix = c.toUpperCase();
  }
  const code = await nextCode(supabase, prefix);
  const { error } = await supabase.from("materials").insert({
    company_id: DEMO_COMPANY_ID, brand_id: input.brandId, code,
    name: input.name.trim(), category_id: input.categoryId, unit: input.unit.trim() || null,
    is_active: input.is_active, is_demo: false,
  });
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true };
}

export async function updateMaterial(id: string, input: MaterialInput): Promise<Result> {
  const supabase = createClient();
  const { error } = await supabase.from("materials").update({
    name: input.name.trim(), brand_id: input.brandId, category_id: input.categoryId, unit: input.unit.trim() || null,
    is_active: input.is_active, updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true };
}

export async function deleteMaterial(id: string): Promise<Result> {
  const supabase = createClient();
  const { error } = await supabase.from("materials").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true };
}

// ---- Kategori material (nama + kode prefix) ----
export async function createMaterialCategory(name: string, code: string): Promise<Result> {
  const supabase = createClient();
  const { error } = await supabase.from("material_categories").insert({
    company_id: DEMO_COMPANY_ID, brand_id: null, name: name.trim(), code: code.trim().toUpperCase() || null, is_active: true, is_demo: false,
  });
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true };
}
export async function updateMaterialCategory(id: string, name: string, code: string): Promise<Result> {
  const supabase = createClient();
  const { error } = await supabase.from("material_categories").update({ name: name.trim(), code: code.trim().toUpperCase() || null, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true };
}
export async function deleteMaterialCategory(id: string): Promise<Result> {
  const supabase = createClient();
  const { error } = await supabase.from("material_categories").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true };
}
