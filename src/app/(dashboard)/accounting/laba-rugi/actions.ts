"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEMO_COMPANY_ID } from "@/lib/supabase/config";

type Result = { ok: true } | { ok: false; error: string };
function rv() { revalidatePath("/accounting/laba-rugi"); revalidatePath("/accounting"); }

export type SalesEntryInput = {
  brandId: string; channelId: string | null; period: string; entryDate: string;
  gross: number; discount: number; hpp: number; commission: number; ppn: number; notes: string;
};

export async function createSalesEntry(input: SalesEntryInput): Promise<Result> {
  const supabase = createClient();
  if (!input.brandId) return { ok: false, error: "Pilih brand." };
  if (!(input.gross > 0)) return { ok: false, error: "Penjualan bruto harus > 0." };
  const { error } = await supabase.from("sales_entries").insert({
    company_id: DEMO_COMPANY_ID, brand_id: input.brandId, channel_id: input.channelId, period: input.period.trim() || null,
    entry_date: input.entryDate || null, gross: input.gross, discount: input.discount || 0, hpp: input.hpp || 0,
    commission: input.commission || 0, ppn: input.ppn || 0, notes: input.notes.trim() || null, is_demo: false,
  });
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true };
}

export async function deleteSalesEntry(id: string): Promise<Result> {
  const supabase = createClient();
  const { error } = await supabase.from("sales_entries").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true };
}
