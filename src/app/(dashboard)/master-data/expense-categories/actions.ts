"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEMO_COMPANY_ID } from "@/lib/supabase/config";
import { EXPENSE_CATEGORIES } from "@/lib/finance";

type Result = { ok: true } | { ok: false; error: string };
function rv() {
  revalidatePath("/master-data/expense-categories");
  revalidatePath("/finance/expenses");
  revalidatePath("/finance/payment-request");
}

export type CategoryInput = { name: string; code: string; coaCode: string; isActive: boolean };

export async function createCategory(input: CategoryInput): Promise<Result> {
  const supabase = createClient();
  if (!input.name.trim()) return { ok: false, error: "Nama kategori wajib diisi." };
  const { error } = await supabase.from("expense_categories").insert({
    company_id: DEMO_COMPANY_ID, brand_id: null, name: input.name.trim(),
    code: input.code.trim() || null, coa_code: input.coaCode.trim() || null, is_active: input.isActive, is_demo: false,
  });
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true };
}

export async function updateCategory(id: string, input: CategoryInput): Promise<Result> {
  const supabase = createClient();
  const { error } = await supabase.from("expense_categories").update({
    name: input.name.trim(), code: input.code.trim() || null, coa_code: input.coaCode.trim() || null,
    is_active: input.isActive, updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true };
}

/** Isi kategori bawaan ke master data — hanya nama yang BELUM ada (aman dari dobel). */
export async function seedDefaultCategories(): Promise<{ ok: true; added: number } | { ok: false; error: string }> {
  const supabase = createClient();
  const { data: existing } = await supabase.from("expense_categories").select("name").is("deleted_at", null);
  const have = new Set((existing ?? []).map((c) => (c.name as string).trim().toLowerCase()));
  const toAdd = EXPENSE_CATEGORIES.filter((n) => !have.has(n.trim().toLowerCase()));
  if (toAdd.length === 0) { rv(); return { ok: true, added: 0 }; }
  const { error } = await supabase.from("expense_categories").insert(
    toAdd.map((name) => ({ company_id: DEMO_COMPANY_ID, brand_id: null, name, is_active: true, is_demo: false }))
  );
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true, added: toAdd.length };
}

export async function deleteCategory(id: string): Promise<Result> {
  const supabase = createClient();
  const { error } = await supabase.from("expense_categories").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true };
}
