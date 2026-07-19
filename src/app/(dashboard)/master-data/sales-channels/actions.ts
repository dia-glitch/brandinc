"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEMO_COMPANY_ID } from "@/lib/supabase/config";
import { getRole } from "@/lib/roles";
import { canAct } from "@/lib/permissions";

type Result = { ok: true } | { ok: false; error: string };
function rv() {
  revalidatePath("/master-data/sales-channels");
  revalidatePath("/finance/cash");
}

export type ChannelInput = { name: string; grup: string; code: string; warehouseId: string | null; isActive: boolean };

const DEFAULTS: { name: string; grup: string }[] = [
  { name: "Shopee", grup: "online" },
  { name: "Tiktok", grup: "online" },
  { name: "Website", grup: "online" },
  { name: "Store A", grup: "offline" },
  { name: "Store B", grup: "offline" },
];

export async function createChannel(input: ChannelInput): Promise<Result> {
  const supabase = createClient();
  if (!canAct(await getRole(supabase), "master_data")) return { ok: false, error: "Anda tidak punya akses untuk aksi ini." };
  if (!input.name.trim()) return { ok: false, error: "Nama akun penjualan wajib diisi." };
  const { error } = await supabase.from("sales_channels").insert({
    company_id: DEMO_COMPANY_ID, brand_id: null, name: input.name.trim(),
    grup: input.grup || "online", code: input.code.trim() || null, warehouse_id: input.warehouseId || null, is_active: input.isActive, is_demo: false,
  });
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true };
}

export async function updateChannel(id: string, input: ChannelInput): Promise<Result> {
  const supabase = createClient();
  if (!canAct(await getRole(supabase), "master_data")) return { ok: false, error: "Anda tidak punya akses untuk aksi ini." };
  const { error } = await supabase.from("sales_channels").update({
    name: input.name.trim(), grup: input.grup || "online", code: input.code.trim() || null, warehouse_id: input.warehouseId || null,
    is_active: input.isActive, updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true };
}

export async function deleteChannel(id: string): Promise<Result> {
  const supabase = createClient();
  if (!canAct(await getRole(supabase), "master_data")) return { ok: false, error: "Anda tidak punya akses untuk aksi ini." };
  const { error } = await supabase.from("sales_channels").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true };
}

/** Isi akun penjualan bawaan (Shopee, Tiktok, Website, Store A, Store B) — hanya yang belum ada. */
export async function seedDefaultChannels(): Promise<{ ok: true; added: number } | { ok: false; error: string }> {
  const supabase = createClient();
  if (!canAct(await getRole(supabase), "master_data")) return { ok: false, error: "Anda tidak punya akses untuk aksi ini." };
  const { data: existing } = await supabase.from("sales_channels").select("name").is("deleted_at", null);
  const have = new Set((existing ?? []).map((c) => (c.name as string).trim().toLowerCase()));
  const toAdd = DEFAULTS.filter((d) => !have.has(d.name.toLowerCase()));
  if (toAdd.length === 0) { rv(); return { ok: true, added: 0 }; }
  const { error } = await supabase.from("sales_channels").insert(
    toAdd.map((d) => ({ company_id: DEMO_COMPANY_ID, brand_id: null, name: d.name, grup: d.grup, is_active: true, is_demo: false }))
  );
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true, added: toAdd.length };
}
