"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEMO_COMPANY_ID } from "@/lib/supabase/config";
import { getRole } from "@/lib/roles";
import { canAct } from "@/lib/permissions";

type Result = { ok: true; id: string; code: string } | { ok: false; error: string };
type SimpleResult = { ok: true } | { ok: false; error: string };

function rv() {
  revalidatePath("/purchasing");
  revalidatePath("/raw-material");
}

export type POLineInput = {
  materialId: string;
  materialName: string;
  unit: string;
  qty: number;
  unitPrice: number;
};

export type POInput = {
  brandId: string;
  brandCode: string;
  supplierId: string | null;
  poDate: string;
  expectedDate: string;
  notes: string;
  ppnPercent: number;   // 11 bila supplier PKP, 0 bila tidak
  lines: POLineInput[];
};

/** No urut PO berikutnya per brand → PO-{BrandCode}-{001}. */
async function nextPoNo(supabase: ReturnType<typeof createClient>, brandId: string): Promise<number> {
  const { data } = await supabase
    .from("purchase_orders")
    .select("po_no")
    .eq("brand_id", brandId)
    .order("po_no", { ascending: false })
    .limit(1);
  return ((data?.[0]?.po_no as number | undefined) ?? 0) + 1;
}

export async function createPO(input: POInput): Promise<Result> {
  const supabase = createClient();
  if (!canAct(await getRole(supabase), "rm_po")) return { ok: false, error: "Anda tidak punya akses untuk aksi ini." };
  if (!input.brandId) return { ok: false, error: "Pilih brand." };
  const lines = input.lines.filter((l) => l.materialId && l.qty > 0);
  if (lines.length === 0) return { ok: false, error: "Tambah minimal satu baris material (qty > 0)." };

  const no = await nextPoNo(supabase, input.brandId);
  const code = `PO-${input.brandCode.trim().toUpperCase()}-${String(no).padStart(3, "0")}`;

  const subtotal = lines.reduce((s, l) => s + l.qty * (l.unitPrice || 0), 0);
  const ppnPercent = input.ppnPercent > 0 ? input.ppnPercent : 0;
  const ppnAmount = subtotal * (ppnPercent / 100);

  const { data: po, error: poErr } = await supabase
    .from("purchase_orders")
    .insert({
      company_id: DEMO_COMPANY_ID,
      brand_id: input.brandId,
      code,
      po_no: no,
      po_date: input.poDate || null,
      expected_date: input.expectedDate || null,
      supplier_id: input.supplierId,
      notes: input.notes.trim() || null,
      ppn_percent: ppnPercent,
      ppn_amount: ppnAmount,
      status: "open",
      is_demo: false,
    })
    .select("id")
    .single();
  if (poErr || !po) return { ok: false, error: poErr?.message ?? "Gagal membuat PO." };

  const rows = lines.map((l) => ({
    company_id: DEMO_COMPANY_ID,
    brand_id: input.brandId,
    po_id: po.id,
    material_id: l.materialId,
    material_name: l.materialName,
    unit: l.unit || null,
    qty: l.qty,
    unit_price: l.unitPrice || 0,
    received_qty: 0,
    is_demo: false,
  }));
  const { error: lineErr } = await supabase.from("purchase_order_lines").insert(rows);
  if (lineErr) {
    await supabase.from("purchase_orders").delete().eq("id", po.id);
    return { ok: false, error: lineErr.message };
  }

  rv();
  return { ok: true, id: po.id as string, code };
}

export async function cancelPO(id: string): Promise<SimpleResult> {
  const supabase = createClient();
  if (!canAct(await getRole(supabase), "rm_po")) return { ok: false, error: "Anda tidak punya akses untuk aksi ini." };
  const { error } = await supabase
    .from("purchase_orders")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  rv();
  return { ok: true };
}

export async function restorePO(id: string): Promise<SimpleResult> {
  const supabase = createClient();
  if (!canAct(await getRole(supabase), "rm_po")) return { ok: false, error: "Anda tidak punya akses untuk aksi ini." };
  const { error } = await supabase
    .from("purchase_orders")
    .update({ status: "open", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  rv();
  return { ok: true };
}

/**
 * Buat Invoice Reference dari PO yang SUDAH diterima.
 * Nomor mengikuti kode PO → INV-{Kode PO}. Nilai mengikuti penerimaan (received_qty).
 */
export async function createInvoiceRef(poId: string): Promise<{ ok: true; invoiceNo: string } | { ok: false; error: string }> {
  const supabase = createClient();
  if (!canAct(await getRole(supabase), "rm_po")) return { ok: false, error: "Anda tidak punya akses untuk aksi ini." };
  const { data: po } = await supabase
    .from("purchase_orders")
    .select("id,code,brand_id,status,invoice_no")
    .eq("id", poId)
    .single();
  if (!po) return { ok: false, error: "PO tidak ditemukan." };
  if (po.status !== "received") return { ok: false, error: "Invoice hanya bisa dibuat setelah bahan diterima." };
  if (po.invoice_no) return { ok: true, invoiceNo: po.invoice_no as string };

  const invoiceNo = `INV-${(po.code as string).trim().toUpperCase()}`;
  const today = new Date().toISOString().slice(0, 10);

  const { error } = await supabase
    .from("purchase_orders")
    .update({ invoice_no: invoiceNo, invoice_date: today, updated_at: new Date().toISOString() })
    .eq("id", poId);
  if (error) return { ok: false, error: error.message };
  rv();
  return { ok: true, invoiceNo };
}

export type ReceiveLineInput = {
  lineId: string;
  materialId: string;
  qty: number;
  unitPrice: number;
};

/**
 * Cari (atau buat) Gudang Bahan Baku khusus RM.
 * Bahan baku SELALU masuk ke gudang ini — terpisah dari gudang finished goods
 * agar stok & nilai tidak tercampur.
 */
async function getMaterialWarehouseId(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  const { data: existing } = await supabase
    .from("warehouses")
    .select("id")
    .eq("kind", "material")
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data: created, error } = await supabase
    .from("warehouses")
    .insert({
      company_id: DEMO_COMPANY_ID, brand_id: null,
      code: "WH-RM", name: "Gudang Bahan Baku", kind: "material", is_demo: false,
    })
    .select("id")
    .single();
  if (error || !created) return null;
  return created.id as string;
}

/**
 * Terima bahan dari PO ke Gudang Bahan Baku (otomatis, tanpa pilih lokasi).
 * Untuk tiap baris: catat material_movements (receipt) + update saldo moving average:
 *   avg_baru = (qty_lama*avg_lama + qty_masuk*harga_masuk) / (qty_lama+qty_masuk)
 * Lalu simpan received_qty di baris PO & set status PO = received.
 */
export async function receivePO(poId: string, lines: ReceiveLineInput[]): Promise<SimpleResult> {
  const supabase = createClient();
  if (!canAct(await getRole(supabase), "rm_po")) return { ok: false, error: "Anda tidak punya akses untuk aksi ini." };
  const warehouseId = await getMaterialWarehouseId(supabase);
  if (!warehouseId) return { ok: false, error: "Gagal menyiapkan Gudang Bahan Baku." };
  const toReceive = lines.filter((l) => l.qty > 0);
  if (toReceive.length === 0) return { ok: false, error: "Isi qty terima minimal satu baris." };

  for (const l of toReceive) {
    const { error: mvErr } = await supabase.from("material_movements").insert({
      company_id: DEMO_COMPANY_ID, brand_id: null,
      material_id: l.materialId,
      warehouse_id: warehouseId,
      movement_type: "receipt",
      stock_status: "available",
      qty: l.qty,
      unit_cost: l.unitPrice || 0,
      source_doc_type: "purchase_order",
      source_doc_id: poId,
      is_demo: false,
    });
    if (mvErr) return { ok: false, error: mvErr.message };

    const { data: bal } = await supabase
      .from("material_stock_balances")
      .select("qty_on_hand,moving_avg_cost")
      .eq("material_id", l.materialId)
      .eq("warehouse_id", warehouseId)
      .eq("stock_status", "available")
      .maybeSingle();

    const oldQty = Number(bal?.qty_on_hand) || 0;
    const oldAvg = Number(bal?.moving_avg_cost) || 0;
    const newQty = oldQty + l.qty;
    const newAvg = newQty > 0 ? (oldQty * oldAvg + l.qty * (l.unitPrice || 0)) / newQty : 0;

    const { error: balErr } = await supabase
      .from("material_stock_balances")
      .upsert(
        {
          company_id: DEMO_COMPANY_ID, brand_id: null,
          material_id: l.materialId,
          warehouse_id: warehouseId,
          stock_status: "available",
          qty_on_hand: newQty,
          moving_avg_cost: newAvg,
          is_demo: false,
        },
        { onConflict: "material_id,warehouse_id,stock_status" }
      );
    if (balErr) return { ok: false, error: balErr.message };

    const { error: lnErr } = await supabase
      .from("purchase_order_lines")
      .update({ received_qty: l.qty, updated_at: new Date().toISOString() })
      .eq("id", l.lineId);
    if (lnErr) return { ok: false, error: lnErr.message };
  }

  const { error: poErr } = await supabase
    .from("purchase_orders")
    .update({ status: "received", updated_at: new Date().toISOString() })
    .eq("id", poId);
  if (poErr) return { ok: false, error: poErr.message };

  rv();
  return { ok: true };
}
