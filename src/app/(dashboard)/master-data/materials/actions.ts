"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEMO_COMPANY_ID } from "@/lib/supabase/config";

type Result = { ok: true } | { ok: false; error: string };
function rv() { revalidatePath("/master-data/materials"); }

export type MaterialInput = {
  name: string;
  categoryId: string | null;
  unit: string;
  is_active: boolean;
};

async function nextCode(supabase: ReturnType<typeof createClient>): Promise<string> {
  const { data } = await supabase.from("materials").select("code").like("code", "MTR-%").order("code", { ascending: false }).limit(1);
  const last = (data?.[0]?.code as string | undefined) ?? "";
  const m = last.match(/(\d+)$/);
  return "MTR-" + String((m ? parseInt(m[1], 10) : 0) + 1).padStart(4, "0");
}

export async function createMaterial(input: MaterialInput): Promise<Result> {
  const supabase = createClient();
  const code = await nextCode(supabase);
  const { error } = await supabase.from("materials").insert({
    company_id: DEMO_COMPANY_ID, brand_id: null, code,
    name: input.name.trim(), category_id: input.categoryId, unit: input.unit.trim() || null,
    is_active: input.is_active, is_demo: false,
  });
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true };
}

export async function updateMaterial(id: string, input: MaterialInput): Promise<Result> {
  const supabase = createClient();
  const { error } = await supabase.from("materials").update({
    name: input.name.trim(), category_id: input.categoryId, unit: input.unit.trim() || null,
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

// ---- Kategori material ----
export async function createMaterialCategory(name: string): Promise<Result> {
  const supabase = createClient();
  const { error } = await supabase.from("material_categories").insert({
    company_id: DEMO_COMPANY_ID, brand_id: null, name: name.trim(), is_active: true, is_demo: false,
  });
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true };
}
export async function updateMaterialCategory(id: string, name: string): Promise<Result> {
  const supabase = createClient();
  const { error } = await supabase.from("material_categories").update({ name: name.trim(), updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true };
}
export async function deleteMaterialCategory(id: string): Promise<Result> {
  const supabase = createClient();
  const { error } = await supabase.from("material_categories").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true };
}
