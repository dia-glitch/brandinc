"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEMO_COMPANY_ID } from "@/lib/supabase/config";
import { getRole } from "@/lib/roles";
import { canAct } from "@/lib/permissions";

type Result = { ok: true; code: string } | { ok: false; error: string };
type SimpleResult = { ok: true } | { ok: false; error: string };

export type SPKLineInput = {
  productId: string;
  variantId: string;
  sku: string;
  size: string;
  productName: string;
  ratio: number;
  qty: number;
};

export type SPKInput = {
  brandId: string;
  brandCode: string;
  spkDate: string;
  supplierId: string | null;
  supplierType: string;
  merchandiser: string;
  dueDelivery: string;
  buttonAccessories: string;
  careLabel: string;
  vendorComment: string;
  imageUrl: string;
  notes: string;
  lines: SPKLineInput[];
  specs: SPKSpecInput[];
};

export type SPKSpecInput = {
  name: string;
  type: string;
  values: Record<string, number>;
};

/** No urut SPK berikutnya per brand → SPK-{BrandCode}-{001}. */
async function nextSpkNo(supabase: ReturnType<typeof createClient>, brandId: string): Promise<number> {
  const { data } = await supabase
    .from("work_orders")
    .select("spk_no")
    .eq("brand_id", brandId)
    .order("spk_no", { ascending: false })
    .limit(1);
  return ((data?.[0]?.spk_no as number | undefined) ?? 0) + 1;
}

export async function createSPK(input: SPKInput): Promise<Result> {
  const supabase = createClient();
  if (!canAct(await getRole(supabase), "prod_spk")) return { ok: false, error: "Anda tidak punya akses untuk aksi ini." };
  const lines = input.lines.filter((l) => l.qty > 0);
  if (lines.length === 0) return { ok: false, error: "Tambah minimal satu baris (ukuran + jumlah)." };

  const no = await nextSpkNo(supabase, input.brandId);
  const code = `SPK-${input.brandCode.trim().toUpperCase()}-${String(no).padStart(3, "0")}`;

  const { data: spk, error: spkErr } = await supabase
    .from("work_orders")
    .insert({
      company_id: DEMO_COMPANY_ID,
      brand_id: input.brandId,
      code,
      spk_no: no,
      spk_date: input.spkDate || null,
      supplier_id: input.supplierId,
      supplier_type: input.supplierType.trim() || null,
      merchandiser: input.merchandiser.trim() || null,
      due_delivery: input.dueDelivery || null,
      button_accessories: input.buttonAccessories.trim() || null,
      care_label: input.careLabel.trim() || null,
      vendor_comment: input.vendorComment.trim() || null,
      image_url: input.imageUrl.trim() || null,
      notes: input.notes.trim() || null,
      status: "open",
      is_demo: false,
    })
    .select("id")
    .single();
  if (spkErr || !spk) return { ok: false, error: spkErr?.message ?? "Gagal membuat SPK." };

  const rows = lines.map((l) => ({
    company_id: DEMO_COMPANY_ID,
    brand_id: input.brandId,
    spk_id: spk.id,
    product_id: l.productId,
    variant_id: l.variantId,
    sku: l.sku,
    size: l.size,
    product_name: l.productName,
    ratio: l.ratio || null,
    qty: l.qty,
    is_demo: false,
  }));
  const { error: lineErr } = await supabase.from("work_order_lines").insert(rows);
  if (lineErr) {
    await supabase.from("work_orders").delete().eq("id", spk.id);
    return { ok: false, error: lineErr.message };
  }

  // Size Specification (cm) — opsional
  const specRows = input.specs
    .filter((s) => s.name.trim())
    .map((s, i) => ({
      company_id: DEMO_COMPANY_ID,
      brand_id: input.brandId,
      spk_id: spk.id,
      name: s.name.trim(),
      type: s.type || null,
      sort_order: i,
      values: s.values,
      is_demo: false,
    }));
  if (specRows.length > 0) {
    const { error: specErr } = await supabase.from("work_order_specs").insert(specRows);
    if (specErr) {
      await supabase.from("work_order_lines").delete().eq("spk_id", spk.id);
      await supabase.from("work_orders").delete().eq("id", spk.id);
      return { ok: false, error: "Gagal menyimpan Size Spec: " + specErr.message + ". Jalankan SQL tabel work_order_specs." };
    }
  }

  revalidatePath("/production/spk");
  return { ok: true, code };
}

/** Set/ganti foto produk pada SPK yang sudah ada. */
export async function setSpkImage(id: string, imageUrl: string): Promise<SimpleResult> {
  const supabase = createClient();
  if (!canAct(await getRole(supabase), "prod_spk")) return { ok: false, error: "Anda tidak punya akses untuk aksi ini." };
  const { error } = await supabase
    .from("work_orders")
    .update({ image_url: imageUrl || null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/production/spk");
  return { ok: true };
}

export async function cancelSPK(id: string): Promise<SimpleResult> {
  const supabase = createClient();
  if (!canAct(await getRole(supabase), "prod_spk")) return { ok: false, error: "Anda tidak punya akses untuk aksi ini." };
  const { error } = await supabase
    .from("work_orders")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/production/spk");
  return { ok: true };
}

export async function restoreSPK(id: string): Promise<SimpleResult> {
  const supabase = createClient();
  if (!canAct(await getRole(supabase), "prod_spk")) return { ok: false, error: "Anda tidak punya akses untuk aksi ini." };
  const { error } = await supabase
    .from("work_orders")
    .update({ status: "open", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/production/spk");
  return { ok: true };
}
