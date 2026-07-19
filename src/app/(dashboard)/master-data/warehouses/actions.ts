"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEMO_COMPANY_ID } from "@/lib/supabase/config";
import { getRole } from "@/lib/roles";
import { canAct } from "@/lib/permissions";

type Result = { ok: true } | { ok: false; error: string };
function rv() { revalidatePath("/master-data/warehouses"); }

export type WarehouseInput = {
  name: string;
  code: string;
  kind: string;          // finished | damage | material | store | warehouse
  brandId: string | null;
};

export async function createWarehouse(input: WarehouseInput): Promise<Result> {
  const supabase = createClient();
  if (!canAct(await getRole(supabase), "master_data")) return { ok: false, error: "Anda tidak punya akses untuk aksi ini." };
  if (!input.name.trim()) return { ok: false, error: "Nama gudang wajib diisi." };
  const { error } = await supabase.from("warehouses").insert({
    company_id: DEMO_COMPANY_ID,
    brand_id: input.brandId,
    code: input.code.trim() || input.name.trim().slice(0, 12).toUpperCase(),
    name: input.name.trim(),
    kind: input.kind || "warehouse",
    is_demo: false,
  });
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true };
}

export async function updateWarehouse(id: string, input: WarehouseInput): Promise<Result> {
  const supabase = createClient();
  if (!canAct(await getRole(supabase), "master_data")) return { ok: false, error: "Anda tidak punya akses untuk aksi ini." };
  const { error } = await supabase.from("warehouses").update({
    name: input.name.trim(),
    code: input.code.trim() || null,
    kind: input.kind || "warehouse",
    brand_id: input.brandId,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true };
}

export async function deleteWarehouse(id: string): Promise<Result> {
  const supabase = createClient();
  if (!canAct(await getRole(supabase), "master_data")) return { ok: false, error: "Anda tidak punya akses untuk aksi ini." };
  const { error } = await supabase.from("warehouses").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true };
}
