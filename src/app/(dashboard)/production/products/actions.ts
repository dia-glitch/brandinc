"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEMO_COMPANY_ID } from "@/lib/supabase/config";

type Result = { ok: true; styleCode: string } | { ok: false; error: string };
type SimpleResult = { ok: true } | { ok: false; error: string };

export type NewProductInput = {
  brandId: string;
  brandCode: string;
  categoryId: string;
  categoryCode: string;
  categoryName: string;
  colorId: string;
  colorName: string;
  rawName: string;               // "Alina"
  sizes: { id: string; name: string }[];
};

function slug(s: string) {
  return s.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Buat produk + varian per ukuran (alur Produksi).
 * SKU = {BrandCode}-{CatCode}{NoUrut 3 digit}-{Ukuran}, mis. BRE-SH001-S
 * Nama tercatat = "{Nama} {Kategori LV2} {Warna LV2}", mis. "Alina Shirt Maroon"
 * No urut dihitung per Brand + Kategori.
 */
export async function createProductWithVariants(input: NewProductInput): Promise<Result> {
  const supabase = createClient();

  if (input.sizes.length === 0) return { ok: false, error: "Pilih minimal satu ukuran." };

  // No urut berikutnya per brand+kategori (termasuk yang sudah dihapus, agar tidak dobel).
  const { data: last } = await supabase
    .from("products")
    .select("product_no")
    .eq("brand_id", input.brandId)
    .eq("category_id", input.categoryId)
    .order("product_no", { ascending: false })
    .limit(1);
  const no = ((last?.[0]?.product_no as number | undefined) ?? 0) + 1;

  const brandCode = slug(input.brandCode);
  const catCode = slug(input.categoryCode);
  const styleCode = `${brandCode}-${catCode}${String(no).padStart(3, "0")}`;
  const fullName = `${input.rawName.trim()} ${input.categoryName} ${input.colorName}`.trim();

  // Insert produk
  const { data: prod, error: prodErr } = await supabase
    .from("products")
    .insert({
      company_id: DEMO_COMPANY_ID,
      brand_id: input.brandId,
      category_id: input.categoryId,
      color_id: input.colorId,
      color: input.colorName,
      style_code: styleCode,
      name: fullName,
      product_no: no,
      is_active: true,
      is_demo: false,
    })
    .select("id")
    .single();
  if (prodErr || !prod) return { ok: false, error: prodErr?.message ?? "Gagal membuat produk." };

  // Insert varian per ukuran
  const rows = input.sizes.map((sz) => ({
    company_id: DEMO_COMPANY_ID,
    brand_id: input.brandId,
    product_id: prod.id,
    sku: `${styleCode}-${slug(sz.name)}`,
    color_id: input.colorId,
    color: input.colorName,
    size_id: sz.id,
    size: sz.name,
    retail_price: 0,
    is_demo: false,
  }));
  const { error: varErr } = await supabase.from("product_variants").insert(rows);
  if (varErr) {
    // rollback produk agar tidak menggantung
    await supabase.from("products").delete().eq("id", prod.id);
    return { ok: false, error: varErr.message };
  }

  revalidatePath("/production/products");
  return { ok: true, styleCode };
}

/** Tambah 1 ukuran (varian) ke produk yang sudah ada. */
export async function addVariant(
  productId: string,
  styleCode: string,
  brandId: string,
  colorId: string | null,
  colorName: string | null,
  size: { id: string; name: string },
  retailPrice: number
): Promise<SimpleResult> {
  const supabase = createClient();
  const { error } = await supabase.from("product_variants").insert({
    company_id: DEMO_COMPANY_ID,
    brand_id: brandId,
    product_id: productId,
    sku: `${styleCode}-${slug(size.name)}`,
    color_id: colorId,
    color: colorName,
    size_id: size.id,
    size: size.name,
    retail_price: retailPrice || 0,
    is_demo: false,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/production/products");
  return { ok: true };
}

/**
 * Batalkan produk (status = cancelled). Data TIDAK dihapus — tetap tampil
 * dengan badge, agar aman terhadap referensi transaksi. Bisa dipulihkan.
 */
export async function cancelProduct(id: string): Promise<SimpleResult> {
  const supabase = createClient();
  const { error } = await supabase
    .from("products")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/production/products");
  return { ok: true };
}

/** Pulihkan produk yang sebelumnya dibatalkan. */
export async function restoreProduct(id: string): Promise<SimpleResult> {
  const supabase = createClient();
  const { error } = await supabase
    .from("products")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/production/products");
  return { ok: true };
}
