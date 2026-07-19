"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEMO_COMPANY_ID } from "@/lib/supabase/config";
import { isAdmin } from "@/lib/roles";

type Result = { ok: true } | { ok: false; error: string };
type CreateResult = { ok: true; code: string } | { ok: false; error: string };
function rv() {
  revalidatePath("/sales"); revalidatePath("/inventory"); revalidatePath("/inventory/stock");
  revalidatePath("/finance/cash"); revalidatePath("/finance/mutasi"); revalidatePath("/finance/summary");
  revalidatePath("/accounting/laba-rugi");
}

async function nextCode(supabase: ReturnType<typeof createClient>): Promise<string> {
  const { count } = await supabase.from("sales_orders").select("id", { count: "exact", head: true });
  return `SO-${String((count ?? 0) + 1).padStart(4, "0")}`;
}

/** Ubah stok barang jadi (available) + catat ledger. qtyDelta negatif = keluar (jual). */
async function moveStock(supabase: ReturnType<typeof createClient>, variantId: string, warehouseId: string, qtyDelta: number, unitCost: number, movementType: string, brandId: string | null, orderId: string) {
  await supabase.from("inventory_movements").insert({
    company_id: DEMO_COMPANY_ID, brand_id: brandId, variant_id: variantId, warehouse_id: warehouseId,
    movement_type: movementType, stock_status: "available", qty: qtyDelta, unit_cost: unitCost || 0,
    source_doc_type: "sales_order", source_doc_id: orderId, is_demo: false,
  });
  const { data: bal } = await supabase.from("stock_balances")
    .select("qty_on_hand,moving_avg_cost").eq("variant_id", variantId).eq("warehouse_id", warehouseId).eq("stock_status", "available").maybeSingle();
  const oldQty = Number(bal?.qty_on_hand) || 0;
  const newQty = oldQty + qtyDelta;
  await supabase.from("stock_balances").upsert({
    company_id: DEMO_COMPANY_ID, brand_id: brandId, variant_id: variantId, warehouse_id: warehouseId, stock_status: "available",
    qty_on_hand: newQty, moving_avg_cost: Number(bal?.moving_avg_cost) || unitCost || 0, is_demo: false,
  }, { onConflict: "variant_id,warehouse_id,stock_status" });
}

export type SaleLineInput = { variantId: string; warehouseId: string; sku: string; size: string; productName: string; qty: number; retail: number; price: number; cogm: number; extOrderId?: string };
export type SaleInput = {
  brandId: string; channelId: string | null; settlement: string; orderDate: string; extOrderId?: string;
  commission?: number; ppn: number; notes: string; lines: SaleLineInput[];
};

export async function createSale(input: SaleInput): Promise<CreateResult> {
  const supabase = createClient();
  if (!input.brandId) return { ok: false, error: "Pilih brand." };
  const lines = (input.lines ?? []).filter((l) => l.variantId && l.warehouseId && l.qty > 0);
  if (lines.length === 0) return { ok: false, error: "Tambah minimal satu produk (qty > 0)." };

  // Validasi stok cukup.
  for (const l of lines) {
    const { data: bal } = await supabase.from("stock_balances").select("qty_on_hand").eq("variant_id", l.variantId).eq("warehouse_id", l.warehouseId).eq("stock_status", "available").maybeSingle();
    const avail = Number(bal?.qty_on_hand) || 0;
    if (l.qty > avail + 0.0001) return { ok: false, error: `Stok ${l.sku || "produk"} tidak cukup (tersedia ${avail}).` };
  }

  // Diskon otomatis = Σ (retail − harga jual) × qty (hanya bila retail > harga jual).
  const discount = lines.reduce((s, l) => s + Math.max(0, (l.retail || 0) - (l.price || 0)) * l.qty, 0);
  const code = await nextCode(supabase);
  const { data: order, error: oErr } = await supabase.from("sales_orders").insert({
    company_id: DEMO_COMPANY_ID, brand_id: input.brandId, code, channel_id: input.channelId, settlement: input.settlement || "ar",
    ext_order_id: input.extOrderId?.trim() || null, customer: null, order_date: input.orderDate || null, discount, commission: input.commission || 0, ppn: input.ppn || 0,
    notes: input.notes.trim() || null, is_demo: false,
  }).select("id").single();
  if (oErr || !order) return { ok: false, error: oErr?.message ?? "Gagal simpan." };
  const orderId = order.id as string;

  const { error: lErr } = await supabase.from("sales_order_lines").insert(
    lines.map((l) => ({
      company_id: DEMO_COMPANY_ID, brand_id: input.brandId, order_id: orderId, variant_id: l.variantId, warehouse_id: l.warehouseId,
      ext_order_id: (l.extOrderId?.trim() || input.extOrderId?.trim()) || null,
      sku: l.sku || null, size: l.size || null, product_name: l.productName || null, qty: l.qty, retail: l.retail || 0, price: l.price || 0, cogm: l.cogm || 0, is_demo: false,
    }))
  );
  if (lErr) return { ok: false, error: lErr.message };

  for (const l of lines) await moveStock(supabase, l.variantId, l.warehouseId, -l.qty, l.cogm || 0, "sale", input.brandId, orderId);

  rv(); return { ok: true, code };
}

/** Terima pembayaran penjualan → kas masuk. AR/konsinyasi pakai ref_type ar_receipt (nyambung ke Piutang), marketplace pakai sales_receipt. */
export async function receiveSalePayment(input: { id: string; code: string; amount: number; accountId: string; date: string; method: string }): Promise<Result> {
  const supabase = createClient();
  if (!input.accountId) return { ok: false, error: "Pilih akun kas/bank penerima." };
  if (!(input.amount > 0)) return { ok: false, error: "Nominal harus > 0." };
  const { data: o } = await supabase.from("sales_orders").select("settlement").eq("id", input.id).single();
  const refType = (o?.settlement as string) === "ar" ? "ar_receipt" : "sales_receipt";
  const { error } = await supabase.from("payments").insert({
    company_id: DEMO_COMPANY_ID, brand_id: null, account_id: input.accountId, pay_date: input.date || null,
    direction: "in", amount: input.amount, method: input.method || "transfer", ref_type: refType, ref_key: input.code,
    notes: `Penerimaan penjualan ${input.code}`, is_demo: false,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/finance/ar"); rv(); return { ok: true };
}

/** Edit/adjustment penjualan (khusus admin): balikkan stok lama → pasang stok baru. */
export async function updateSale(id: string, input: SaleInput): Promise<Result> {
  const supabase = createClient();
  if (!(await isAdmin(supabase))) return { ok: false, error: "Hanya admin yang boleh edit/adjustment penjualan." };
  const { data: order } = await supabase.from("sales_orders").select("id,brand_id").eq("id", id).is("deleted_at", null).single();
  if (!order) return { ok: false, error: "Penjualan tidak ditemukan." };
  const brandId = input.brandId || (order.brand_id as string);

  const newLines = (input.lines ?? []).filter((l) => l.variantId && l.warehouseId && l.qty > 0);
  if (newLines.length === 0) return { ok: false, error: "Tambah minimal satu produk (qty > 0)." };

  // 1) Balikkan stok baris lama.
  const { data: oldLines } = await supabase.from("sales_order_lines").select("variant_id,warehouse_id,qty,cogm").eq("order_id", id).is("deleted_at", null);
  for (const l of oldLines ?? []) {
    const vid = l.variant_id as string | null; const wh = l.warehouse_id as string | null; const q = Number(l.qty) || 0;
    if (vid && wh && q > 0) await moveStock(supabase, vid, wh, q, Number(l.cogm) || 0, "return", (order.brand_id as string | null) ?? null, id);
  }
  await supabase.from("sales_order_lines").update({ deleted_at: new Date().toISOString() }).eq("order_id", id);

  // 2) Validasi stok cukup untuk baris baru (setelah dibalik).
  for (const l of newLines) {
    const { data: bal } = await supabase.from("stock_balances").select("qty_on_hand").eq("variant_id", l.variantId).eq("warehouse_id", l.warehouseId).eq("stock_status", "available").maybeSingle();
    const avail = Number(bal?.qty_on_hand) || 0;
    if (l.qty > avail + 0.0001) return { ok: false, error: `Stok ${l.sku || "produk"} tidak cukup (tersedia ${avail}).` };
  }

  const discount = newLines.reduce((s, l) => s + Math.max(0, (l.retail || 0) - (l.price || 0)) * l.qty, 0);
  await supabase.from("sales_orders").update({
    brand_id: brandId, channel_id: input.channelId, settlement: input.settlement || "ar", order_date: input.orderDate || null,
    ext_order_id: input.extOrderId?.trim() || null, discount, commission: input.commission || 0, ppn: input.ppn || 0, notes: input.notes.trim() || null, updated_at: new Date().toISOString(),
  }).eq("id", id);

  const { error: lErr } = await supabase.from("sales_order_lines").insert(
    newLines.map((l) => ({
      company_id: DEMO_COMPANY_ID, brand_id: brandId, order_id: id, variant_id: l.variantId, warehouse_id: l.warehouseId,
      ext_order_id: (l.extOrderId?.trim() || input.extOrderId?.trim()) || null,
      sku: l.sku || null, size: l.size || null, product_name: l.productName || null, qty: l.qty, retail: l.retail || 0, price: l.price || 0, cogm: l.cogm || 0, is_demo: false,
    }))
  );
  if (lErr) return { ok: false, error: lErr.message };
  for (const l of newLines) await moveStock(supabase, l.variantId, l.warehouseId, -l.qty, l.cogm || 0, "sale", brandId, id);

  rv(); return { ok: true };
}

export async function deleteSale(id: string): Promise<Result> {
  const supabase = createClient();
  if (!(await isAdmin(supabase))) return { ok: false, error: "Hanya admin yang boleh menghapus penjualan." };
  const { data: order } = await supabase.from("sales_orders").select("brand_id").eq("id", id).single();
  const { data: lines } = await supabase.from("sales_order_lines").select("variant_id,warehouse_id,qty,cogm").eq("order_id", id).is("deleted_at", null);
  // Kembalikan stok.
  for (const l of lines ?? []) {
    const vid = l.variant_id as string | null; const wh = l.warehouse_id as string | null; const qty = Number(l.qty) || 0;
    if (vid && wh && qty > 0) await moveStock(supabase, vid, wh, qty, Number(l.cogm) || 0, "return", (order?.brand_id as string | null) ?? null, id);
  }
  await supabase.from("sales_order_lines").update({ deleted_at: new Date().toISOString() }).eq("order_id", id);
  const { error } = await supabase.from("sales_orders").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true };
}
