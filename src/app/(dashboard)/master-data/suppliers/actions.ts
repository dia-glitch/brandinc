"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEMO_COMPANY_ID } from "@/lib/supabase/config";

type Result = { ok: true } | { ok: false; error: string };

function revalidate() {
  revalidatePath("/master-data/suppliers");
}

// ---------- Supplier ----------
export type SupplierInput = {
  name: string;
  categoryId: string | null;
  phone: string;
  email: string;
  is_taxable: boolean; // true = PKP, false = Non-PKP
  npwp: string;
  bankName: string;
  bankAccountNo: string;
  bankAccountName: string;
  is_active: boolean;
};

/** Kode supplier berikutnya: SUP-0001, SUP-0002, ... (zero-padded agar urut). */
async function nextSupplierCode(supabase: ReturnType<typeof createClient>): Promise<string> {
  const { data } = await supabase
    .from("suppliers")
    .select("code")
    .like("code", "SUP-%")
    .order("code", { ascending: false })
    .limit(1);
  const last = (data?.[0]?.code as string | undefined) ?? "";
  const m = last.match(/(\d+)$/);
  const n = m ? parseInt(m[1], 10) : 0;
  return "SUP-" + String(n + 1).padStart(4, "0");
}

export async function createSupplier(input: SupplierInput): Promise<Result> {
  const supabase = createClient();
  const code = await nextSupplierCode(supabase);
  const { error } = await supabase.from("suppliers").insert({
    company_id: DEMO_COMPANY_ID,
    brand_id: null,
    code,
    name: input.name.trim(),
    category_id: input.categoryId,
    phone: input.phone.trim() || null,
    email: input.email.trim() || null,
    is_taxable: input.is_taxable,
    npwp: input.npwp.trim() || null,
    bank_name: input.bankName.trim() || null,
    bank_account_no: input.bankAccountNo.trim() || null,
    bank_account_name: input.bankAccountName.trim() || null,
    is_active: input.is_active,
    is_demo: false,
  });
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function updateSupplier(id: string, input: SupplierInput): Promise<Result> {
  const supabase = createClient();
  const { error } = await supabase
    .from("suppliers")
    .update({
      name: input.name.trim(),
      category_id: input.categoryId,
      phone: input.phone.trim() || null,
      email: input.email.trim() || null,
      is_taxable: input.is_taxable,
      npwp: input.npwp.trim() || null,
      bank_name: input.bankName.trim() || null,
      bank_account_no: input.bankAccountNo.trim() || null,
      bank_account_name: input.bankAccountName.trim() || null,
      is_active: input.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function deleteSupplier(id: string): Promise<Result> {
  const supabase = createClient();
  const { error } = await supabase
    .from("suppliers")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

// ---------- Kategori Supplier ----------
export async function createSupplierCategory(name: string): Promise<Result> {
  const supabase = createClient();
  const { error } = await supabase.from("supplier_categories").insert({
    company_id: DEMO_COMPANY_ID,
    brand_id: null,
    name: name.trim(),
    is_active: true,
    is_demo: false,
  });
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function updateSupplierCategory(id: string, name: string): Promise<Result> {
  const supabase = createClient();
  const { error } = await supabase
    .from("supplier_categories")
    .update({ name: name.trim(), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

export async function deleteSupplierCategory(id: string): Promise<Result> {
  const supabase = createClient();
  const { error } = await supabase
    .from("supplier_categories")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}
