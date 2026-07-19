"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEMO_COMPANY_ID } from "@/lib/supabase/config";
import { getRole } from "@/lib/roles";
import { canAct } from "@/lib/permissions";

type Result = { ok: true } | { ok: false; error: string };
function rv() { revalidatePath("/production/cogm"); }

/** Simpan retail price manual per SPK (ditolak bila sudah dikunci). */
export async function saveRetail(spkId: string, retailPrice: number): Promise<Result> {
  const supabase = createClient();
  if (!canAct(await getRole(supabase), "prod_cogm")) return { ok: false, error: "Anda tidak punya akses untuk aksi ini." };
  const { data: existing } = await supabase.from("spk_costing").select("id,locked").eq("spk_id", spkId).maybeSingle();
  if (existing?.locked) return { ok: false, error: "Retail price sudah dikunci. Buka kunci dulu untuk mengubah." };
  const { error } = await supabase.from("spk_costing").upsert(
    { company_id: DEMO_COMPANY_ID, brand_id: null, spk_id: spkId, retail_price: retailPrice, is_demo: false, updated_at: new Date().toISOString() },
    { onConflict: "spk_id" }
  );
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true };
}

/** Kunci / buka kunci retail price. */
export async function setLock(spkId: string, locked: boolean): Promise<Result> {
  const supabase = createClient();
  if (!canAct(await getRole(supabase), "prod_cogm")) return { ok: false, error: "Anda tidak punya akses untuk aksi ini." };
  const { data: existing } = await supabase.from("spk_costing").select("id").eq("spk_id", spkId).maybeSingle();
  if (!existing) {
    const { error } = await supabase.from("spk_costing").insert({ company_id: DEMO_COMPANY_ID, brand_id: null, spk_id: spkId, locked, is_demo: false });
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("spk_costing").update({ locked, updated_at: new Date().toISOString() }).eq("spk_id", spkId);
    if (error) return { ok: false, error: error.message };
  }
  rv(); return { ok: true };
}
