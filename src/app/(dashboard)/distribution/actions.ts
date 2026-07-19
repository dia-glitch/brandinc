"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEMO_COMPANY_ID } from "@/lib/supabase/config";
import { getRole } from "@/lib/roles";
import { canAct } from "@/lib/permissions";

type Result = { ok: true } | { ok: false; error: string };
type CreateResult = { ok: true; code: string } | { ok: false; error: string };
function rv() { revalidatePath("/distribution"); revalidatePath("/inventory"); revalidatePath("/inventory/stock"); }

async function canSubmit(supabase: ReturnType<typeof createClient>) { return canAct(await getRole(supabase), "dist_submit"); }
async function canProcess(supabase: ReturnType<typeof createClient>) { return canAct(await getRole(supabase), "dist_process"); }
const NO_SUBMIT = "Hanya MD Sales/Admin yang boleh membuat request transfer.";
const NO_PROCESS = "Hanya tim Outbound/Admin yang boleh memproses transfer.";
function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

async function nextCode(supabase: ReturnType<typeof createClient>): Promise<string> {
  const { count } = await supabase.from("stock_transfers").select("id", { count: "exact", head: true });
  return `TF-${String((count ?? 0) + 1).padStart(4, "0")}`;
}

/** Ubah saldo stok available + ledger. qtyDelta negatif = keluar. */
async function move(supabase: ReturnType<typeof createClient>, variantId: string, warehouseId: string, qtyDelta: number, unitCost: number, movementType: string, brandId: string | null, transferId: string) {
  await supabase.from("inventory_movements").insert({
    company_id: DEMO_COMPANY_ID, brand_id: brandId, variant_id: variantId, warehouse_id: warehouseId,
    movement_type: movementType, stock_status: "available", qty: qtyDelta, unit_cost: unitCost || 0,
    source_doc_type: "stock_transfer", source_doc_id: transferId, is_demo: false,
  });
  const { data: bal } = await supabase.from("stock_balances")
    .select("qty_on_hand,moving_avg_cost").eq("variant_id", variantId).eq("warehouse_id", warehouseId).eq("stock_status", "available").maybeSingle();
  const oldQty = Number(bal?.qty_on_hand) || 0;
  const oldAvg = Number(bal?.moving_avg_cost) || 0;
  const newQty = oldQty + qtyDelta;
  const newAvg = qtyDelta > 0 && newQty > 0 ? (oldQty * oldAvg + qtyDelta * (unitCost || 0)) / newQty : (oldAvg || unitCost || 0);
  await supabase.from("stock_balances").upsert({
    company_id: DEMO_COMPANY_ID, brand_id: brandId, variant_id: variantId, warehouse_id: warehouseId, stock_status: "available",
    qty_on_hand: newQty, moving_avg_cost: newAvg, is_demo: false,
  }, { onConflict: "variant_id,warehouse_id,stock_status" });
}

/** Validasi ketersediaan stok di gudang asal untuk seluruh baris transfer. */
async function checkStock(supabase: ReturnType<typeof createClient>, fromWarehouseId: string, lines: { variantId: string; sku: string; qty: number }[]): Promise<string | null> {
  for (const l of lines) {
    const { data: bal } = await supabase.from("stock_balances").select("qty_on_hand").eq("variant_id", l.variantId).eq("warehouse_id", fromWarehouseId).eq("stock_status", "available").maybeSingle();
    const avail = Number(bal?.qty_on_hand) || 0;
    if (l.qty > avail + 0.0001) return `Stok ${l.sku || "produk"} di gudang asal tidak cukup (tersedia ${avail}, diminta ${l.qty}).`;
  }
  return null;
}

export type TransferLineInput = { variantId: string; sku: string; size: string; productName: string; qty: number; unitCost: number };
export type TransferInput = { brandId: string | null; fromWarehouseId: string; toWarehouseId: string; transferDate: string; notes: string; requestedBy?: string; lines: TransferLineInput[] };

/** TAHAP 1 — MD Sales membuat REQUEST transfer. Belum ada perpindahan stok. */
export async function createRequest(input: TransferInput): Promise<CreateResult> {
  const supabase = createClient();
  if (!(await canSubmit(supabase))) return { ok: false, error: NO_SUBMIT };
  if (!input.fromWarehouseId || !input.toWarehouseId) return { ok: false, error: "Pilih gudang asal & tujuan." };
  if (input.fromWarehouseId === input.toWarehouseId) return { ok: false, error: "Gudang asal & tujuan tidak boleh sama." };
  const lines = (input.lines ?? []).filter((l) => l.variantId && l.qty > 0);
  if (lines.length === 0) return { ok: false, error: "Tambah minimal satu produk (qty > 0)." };

  const code = await nextCode(supabase);
  const { data: tf, error: tErr } = await supabase.from("stock_transfers").insert({
    company_id: DEMO_COMPANY_ID, brand_id: input.brandId, code, from_warehouse_id: input.fromWarehouseId, to_warehouse_id: input.toWarehouseId,
    transfer_date: input.transferDate || null, notes: input.notes.trim() || null, requested_by: input.requestedBy?.trim() || null,
    status: "requested", is_demo: false,
  }).select("id").single();
  if (tErr || !tf) return { ok: false, error: tErr?.message ?? "Gagal simpan." };
  const transferId = tf.id as string;

  const { error: lErr } = await supabase.from("stock_transfer_lines").insert(
    lines.map((l) => ({
      company_id: DEMO_COMPANY_ID, brand_id: input.brandId, transfer_id: transferId, variant_id: l.variantId,
      sku: l.sku || null, size: l.size || null, product_name: l.productName || null, qty: l.qty, unit_cost: l.unitCost || 0, is_demo: false,
    }))
  );
  if (lErr) return { ok: false, error: lErr.message };
  rv(); return { ok: true, code };
}

export type PackLineInput = { lineId: string; qtyPacked: number; reason: string };

/** TAHAP 2 — Outbound picking/packing: isi qty REAL yg dikirim per baris + alasan bila beda → status packed. Belum pindah stok. */
export async function packTransfer(id: string, input: { packedBy?: string; lines: PackLineInput[] }): Promise<Result> {
  const supabase = createClient();
  if (!(await canProcess(supabase))) return { ok: false, error: NO_PROCESS };
  const { data: tf } = await supabase.from("stock_transfers").select("id,status,from_warehouse_id").eq("id", id).is("deleted_at", null).single();
  if (!tf) return { ok: false, error: "Transfer tidak ditemukan." };
  if (tf.status !== "requested") return { ok: false, error: "Hanya request yang bisa diproses." };

  const { data: lines } = await supabase.from("stock_transfer_lines").select("id,variant_id,sku,qty").eq("transfer_id", id).is("deleted_at", null);
  const byId = new Map((input.lines ?? []).map((l) => [l.lineId, l]));
  let totalPacked = 0;

  for (const l of lines ?? []) {
    const lineId = l.id as string;
    const pin = byId.get(lineId);
    const requested = Number(l.qty) || 0;
    const packed = pin ? Math.max(0, Number(pin.qtyPacked) || 0) : requested;
    // Validasi tidak melebihi stok sistem gudang asal (agar tidak minus saat transfer).
    const { data: bal } = await supabase.from("stock_balances").select("qty_on_hand").eq("variant_id", l.variant_id as string).eq("warehouse_id", tf.from_warehouse_id as string).eq("stock_status", "available").maybeSingle();
    const avail = Number(bal?.qty_on_hand) || 0;
    if (packed > avail + 0.0001) return { ok: false, error: `Qty kirim ${l.sku || "produk"} (${packed}) melebihi stok sistem gudang asal (${avail}).` };
    const differs = Math.abs(packed - requested) > 0.0001;
    const reason = (pin?.reason ?? "").trim();
    if (differs && !reason) return { ok: false, error: `Isi alasan selisih untuk ${l.sku || "produk"} (diminta ${requested}, dikirim ${packed}).` };
    totalPacked += packed;
    await supabase.from("stock_transfer_lines").update({ qty_packed: packed, anomaly_note: differs ? reason : null }).eq("id", lineId);
  }
  if (totalPacked <= 0) return { ok: false, error: "Minimal satu produk harus dikirim (qty > 0)." };

  const { error } = await supabase.from("stock_transfers").update({ status: "packed", packed_at: today(), packed_by: input.packedBy?.trim() || null }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true };
}

/** Batalkan status packed → kembali ke requested (mis. salah pack). */
export async function unpackTransfer(id: string): Promise<Result> {
  const supabase = createClient();
  if (!(await canProcess(supabase))) return { ok: false, error: NO_PROCESS };
  const { data: tf } = await supabase.from("stock_transfers").select("status").eq("id", id).single();
  if (!tf || tf.status !== "packed") return { ok: false, error: "Hanya status packed yang bisa dibatalkan." };
  const { error } = await supabase.from("stock_transfers").update({ status: "requested", packed_at: null, packed_by: null }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true };
}

/** TAHAP 4 — Transfer lokasi: stok benar-benar berpindah antar gudang → status completed. */
export async function completeTransfer(id: string): Promise<Result> {
  const supabase = createClient();
  if (!(await canProcess(supabase))) return { ok: false, error: NO_PROCESS };
  const { data: tf } = await supabase.from("stock_transfers").select("id,status,brand_id,from_warehouse_id,to_warehouse_id").eq("id", id).is("deleted_at", null).single();
  if (!tf) return { ok: false, error: "Transfer tidak ditemukan." };
  if (tf.status !== "packed") return { ok: false, error: "Selesaikan hanya setelah diproses (packed) & surat jalan siap." };
  const { data: lines } = await supabase.from("stock_transfer_lines").select("variant_id,sku,qty,qty_packed,unit_cost").eq("transfer_id", id).is("deleted_at", null);
  // Yang dipindah = qty REAL (packed), bukan qty diminta.
  const ll = (lines ?? []).map((l) => ({ variantId: l.variant_id as string, sku: (l.sku as string) ?? "", qty: l.qty_packed != null ? Number(l.qty_packed) || 0 : Number(l.qty) || 0, unitCost: Number(l.unit_cost) || 0 }));
  const err = await checkStock(supabase, tf.from_warehouse_id as string, ll);
  if (err) return { ok: false, error: err };
  for (const l of ll) {
    if (!l.variantId || l.qty <= 0) continue;
    await move(supabase, l.variantId, tf.from_warehouse_id as string, -l.qty, l.unitCost, "transfer_out", (tf.brand_id as string | null) ?? null, id);
    await move(supabase, l.variantId, tf.to_warehouse_id as string, l.qty, l.unitCost, "transfer_in", (tf.brand_id as string | null) ?? null, id);
  }
  const { error } = await supabase.from("stock_transfers").update({ status: "completed", completed_at: today(), transfer_date: today() }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true };
}

export async function deleteTransfer(id: string): Promise<Result> {
  const supabase = createClient();
  if (!(await canSubmit(supabase)) && !(await canProcess(supabase))) return { ok: false, error: "Anda tidak punya akses menghapus transfer." };
  const { data: tf } = await supabase.from("stock_transfers").select("status,brand_id,from_warehouse_id,to_warehouse_id").eq("id", id).single();
  // Hanya transfer yang sudah completed yang perlu dibalik stoknya.
  if (tf && (tf.status === "completed" || tf.status === "done")) {
    const { data: lines } = await supabase.from("stock_transfer_lines").select("variant_id,qty,qty_packed,unit_cost").eq("transfer_id", id).is("deleted_at", null);
    for (const l of lines ?? []) {
      const vid = l.variant_id as string | null; const qty = l.qty_packed != null ? Number(l.qty_packed) || 0 : Number(l.qty) || 0; const cost = Number(l.unit_cost) || 0;
      if (!vid || qty <= 0) continue;
      await move(supabase, vid, tf.to_warehouse_id as string, -qty, cost, "transfer_out", (tf.brand_id as string | null) ?? null, id);
      await move(supabase, vid, tf.from_warehouse_id as string, qty, cost, "transfer_in", (tf.brand_id as string | null) ?? null, id);
    }
  }
  await supabase.from("stock_transfer_lines").update({ deleted_at: new Date().toISOString() }).eq("transfer_id", id);
  const { error } = await supabase.from("stock_transfers").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  rv(); return { ok: true };
}
