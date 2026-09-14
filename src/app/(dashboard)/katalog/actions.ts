"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/roles";
import { canAct } from "@/lib/permissions";

export type SaveResult = { ok: true } | { ok: false; error: string };

/** Simpan / hapus URL foto katalog (foto real) sebuah produk. Hanya role ber-Aksi di Katalog. */
export async function setCatalogImage(productId: string, url: string | null): Promise<SaveResult> {
  const supabase = createClient();
  if (!canAct(await getRole(supabase), "catalog")) {
    return { ok: false, error: "Anda tidak punya akses untuk mengubah foto katalog." };
  }
  const { error } = await supabase.from("products").update({ catalog_image_url: url || null }).eq("id", productId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/katalog");
  return { ok: true };
}
