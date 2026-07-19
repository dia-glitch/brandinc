"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEMO_COMPANY_ID } from "@/lib/supabase/config";

export type SizeInput = {
  name: string;
  code: string;
  sortOrder: number;
  is_active: boolean;
};

type Result = { ok: true } | { ok: false; error: string };

export async function createSize(input: SizeInput): Promise<Result> {
  const supabase = createClient();

  // Auto urutan bila tidak diisi (ambil terbesar + 10).
  let order = input.sortOrder;
  if (!order || order <= 0) {
    const { data } = await supabase
      .from("sizes")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1);
    order = ((data?.[0]?.sort_order as number | undefined) ?? 0) + 10;
  }

  const { error } = await supabase.from("sizes").insert({
    company_id: DEMO_COMPANY_ID,
    brand_id: null,
    name: input.name.trim(),
    code: input.code.trim() || null,
    sort_order: order,
    is_active: input.is_active,
    is_demo: false,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/master-data/sizes");
  return { ok: true };
}

export async function updateSize(id: string, input: SizeInput): Promise<Result> {
  const supabase = createClient();
  const { error } = await supabase
    .from("sizes")
    .update({
      name: input.name.trim(),
      code: input.code.trim() || null,
      sort_order: input.sortOrder,
      is_active: input.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/master-data/sizes");
  return { ok: true };
}

export async function deleteSize(id: string): Promise<Result> {
  const supabase = createClient();
  const { error } = await supabase
    .from("sizes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/master-data/sizes");
  return { ok: true };
}
