"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEMO_COMPANY_ID } from "@/lib/supabase/config";
import { DEFAULT_COA } from "@/lib/coa";

type Result = { ok: true } | { ok: false; error: string };
function rv() { revalidatePath("/accounting/coa"); }

export type CoaInput = { code: string; name: string; type: string };

export async function createCoa(input: CoaInput): Promise<Result> {
  const supabase = createClient();
  if (!input.code.trim() || !input.name.trim()) return { ok: false, error: "Kode & nama akun wajib diisi." };
  const { error } = await supabase.from("chart_of_accounts").insert({
    company_id: DEMO_COMPANY_ID, brand_id: null, code: input.code.trim(), name: input.name.trim(), type: input.type || "expense", is_postable: "true", is_demo: false,
  });
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true };
}

export async function updateCoa(id: string, input: CoaInput): Promise<Result> {
  const supabase = createClient();
  const { error } = await supabase.from("chart_of_accounts").update({
    code: input.code.trim(), name: input.name.trim(), type: input.type || "expense", updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true };
}

export async function deleteCoa(id: string): Promise<Result> {
  const supabase = createClient();
  const { error } = await supabase.from("chart_of_accounts").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true };
}

export async function seedDefaultCoa(): Promise<{ ok: true; added: number } | { ok: false; error: string }> {
  const supabase = createClient();
  const { data: existing } = await supabase.from("chart_of_accounts").select("code").is("deleted_at", null);
  const have = new Set((existing ?? []).map((c) => (c.code as string).trim()));
  const toAdd = DEFAULT_COA.filter((c) => !have.has(c.code));
  if (toAdd.length === 0) { rv(); return { ok: true, added: 0 }; }
  const { error } = await supabase.from("chart_of_accounts").insert(
    toAdd.map((c) => ({ company_id: DEMO_COMPANY_ID, brand_id: null, code: c.code, name: c.name, type: c.type, is_postable: "true", is_demo: false }))
  );
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true, added: toAdd.length };
}
