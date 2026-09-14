"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/roles";
import { canAct } from "@/lib/permissions";

export type SaveResult = { ok: true } | { ok: false; error: string };

/** Set / hapus launch date sebuah produk (parent SKU). Hanya role ber-Aksi di Lifecycle. */
export async function updateLaunchDate(productId: string, date: string | null): Promise<SaveResult> {
  const supabase = createClient();
  if (!canAct(await getRole(supabase), "product_lifecycle")) {
    return { ok: false, error: "Anda tidak punya akses untuk mengatur launch date." };
  }
  const value = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  const { error } = await supabase.from("products").update({ launch_date: value }).eq("id", productId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/lifecycle");
  return { ok: true };
}
