"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEMO_COMPANY_ID } from "@/lib/supabase/config";
import { getRole } from "@/lib/roles";
import { canAct } from "@/lib/permissions";

type Result = { ok: true; id: string; code: string } | { ok: false; error: string };
type SimpleResult = { ok: true } | { ok: false; error: string };

function rv() {
  revalidatePath("/production/po");
  revalidatePath("/production/spk");
}

export type ProdPOLineInput = {
  spkLineId: string | null;
  sku: string;
  size: string;
  productName: string;
  qtySpk: number;
  qty: number;       // qty PO (manual)
  unitCost: number;  // ongkos WIP / pcs
};

export type ProdPOInput = {
  spkId: string;
  spkCode: string;
  brandId: string;
  supplierId: string | null;
  poDate: string;
  dueDelivery: string;
  notes: string;
  ppnPercent: number;
  lines: ProdPOLineInput[];
};

/** Kode PO Produksi = PO-{Kode SPK}. Bila sudah ada, tambahkan sufiks urut. */
async function nextProdPoCode(supabase: ReturnType<typeof createClient>, spkId: string, spkCode: string): Promise<string> {
  const base = `PO-${spkCode.trim().toUpperCase()}`;
  const { count } = await supabase
    .from("production_pos")
    .select("id", { count: "exact", head: true })
    .eq("spk_id", spkId);
  const n = count ?? 0;
  return n === 0 ? base : `${base}-${n + 1}`;
}

export async function createProductionPO(input: ProdPOInput): Promise<Result> {
  const supabase = createClient();
  if (!canAct(await getRole(supabase), "prod_po")) return { ok: false, error: "Anda tidak punya akses untuk aksi ini." };
  if (!input.spkId) return { ok: false, error: "Pilih SPK dulu." };
  const lines = input.lines.filter((l) => l.qty > 0);
  if (lines.length === 0) return { ok: false, error: "Isi qty PO minimal satu baris (> 0)." };

  const code = await nextProdPoCode(supabase, input.spkId, input.spkCode);
  const subtotal = lines.reduce((s, l) => s + l.qty * (l.unitCost || 0), 0);
  const ppnPercent = input.ppnPercent > 0 ? input.ppnPercent : 0;
  const ppnAmount = subtotal * (ppnPercent / 100);

  const { data: po, error: poErr } = await supabase
    .from("production_pos")
    .insert({
      company_id: DEMO_COMPANY_ID,
      brand_id: input.brandId,
      code,
      spk_id: input.spkId,
      supplier_id: input.supplierId,
      po_date: input.poDate || null,
      due_delivery: input.dueDelivery || null,
      notes: input.notes.trim() || null,
      ppn_percent: ppnPercent,
      ppn_amount: ppnAmount,
      status: "open",
      is_demo: false,
    })
    .select("id")
    .single();
  if (poErr || !po) return { ok: false, error: poErr?.message ?? "Gagal membuat PO Produksi." };

  const rows = lines.map((l) => ({
    company_id: DEMO_COMPANY_ID,
    brand_id: input.brandId,
    po_id: po.id,
    spk_line_id: l.spkLineId,
    sku: l.sku || null,
    size: l.size || null,
    product_name: l.productName || null,
    qty_spk: l.qtySpk || 0,
    qty: l.qty,
    unit_cost: l.unitCost || 0,
    received_qty: 0,
    is_demo: false,
  }));
  const { error: lineErr } = await supabase.from("production_po_lines").insert(rows);
  if (lineErr) {
    await supabase.from("production_pos").delete().eq("id", po.id);
    return { ok: false, error: lineErr.message };
  }

  rv();
  return { ok: true, id: po.id as string, code };
}

/** No urut Invoice Produksi berikutnya per brand → INV-J-{BrandCode}-{0001}. */
async function nextInvoiceNo(supabase: ReturnType<typeof createClient>, brandId: string): Promise<number> {
  const { count } = await supabase
    .from("production_pos")
    .select("id", { count: "exact", head: true })
    .eq("brand_id", brandId)
    .not("invoice_no", "is", null);
  return (count ?? 0) + 1;
}

/**
 * Buat Invoice Produksi (tagihan jasa vendor) dari PO.
 * Nilai dihitung dari QTY FINAL GOOD (received_qty) × ongkos WIP + PPN.
 * Hanya membuat nomor + tanggal; detail nilai dihitung saat dicetak agar selalu ikut good final.
 */
export async function createProductionInvoice(poId: string): Promise<{ ok: true; invoiceNo: string } | { ok: false; error: string }> {
  const supabase = createClient();
  if (!canAct(await getRole(supabase), "prod_po")) return { ok: false, error: "Anda tidak punya akses untuk aksi ini." };
  const { data: po } = await supabase.from("production_pos").select("id,brand_id,invoice_no").eq("id", poId).single();
  if (!po) return { ok: false, error: "PO tidak ditemukan." };
  if (po.invoice_no) return { ok: true, invoiceNo: po.invoice_no as string };

  const { data: lines } = await supabase.from("production_po_lines").select("received_qty").eq("po_id", poId).is("deleted_at", null);
  const totalGood = (lines ?? []).reduce((s, l) => s + (Number(l.received_qty) || 0), 0);
  if (totalGood <= 0) return { ok: false, error: "Belum ada barang Good final. Selesaikan Incoming & QC dulu." };

  const { data: brand } = await supabase.from("brands").select("code").eq("id", po.brand_id).maybeSingle();
  const brandCode = ((brand?.code as string | undefined) ?? "XX").trim().toUpperCase();
  const seq = await nextInvoiceNo(supabase, po.brand_id as string);
  const invoiceNo = `INV-J-${brandCode}-${String(seq).padStart(4, "0")}`;
  const today = new Date().toISOString().slice(0, 10);

  const { error } = await supabase
    .from("production_pos")
    .update({ invoice_no: invoiceNo, invoice_date: today, updated_at: new Date().toISOString() })
    .eq("id", poId);
  if (error) return { ok: false, error: error.message };
  rv();
  return { ok: true, invoiceNo };
}

export async function cancelProductionPO(id: string): Promise<SimpleResult> {
  const supabase = createClient();
  if (!canAct(await getRole(supabase), "prod_po")) return { ok: false, error: "Anda tidak punya akses untuk aksi ini." };
  const { error } = await supabase
    .from("production_pos")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  rv();
  return { ok: true };
}

export async function restoreProductionPO(id: string): Promise<SimpleResult> {
  const supabase = createClient();
  if (!canAct(await getRole(supabase), "prod_po")) return { ok: false, error: "Anda tidak punya akses untuk aksi ini." };
  const { error } = await supabase
    .from("production_pos")
    .update({ status: "open", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  rv();
  return { ok: true };
}
