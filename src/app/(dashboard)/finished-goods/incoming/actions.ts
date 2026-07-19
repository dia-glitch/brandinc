"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEMO_COMPANY_ID } from "@/lib/supabase/config";
import { getRole } from "@/lib/roles";
import { canAct } from "@/lib/permissions";

type Result = { ok: true; id: string; code: string } | { ok: false; error: string };
type SimpleResult = { ok: true } | { ok: false; error: string };

function rv() {
  revalidatePath("/finished-goods");
  revalidatePath("/finished-goods/incoming");
  revalidatePath("/production/po");
}

/* =========================================================================
   ALUR BERTAHAP (PIC berbeda tiap tahap):
   1) INBOUND  — barang datang, catat qty incoming. status = 'inbound'
   2) QC       — tim QC isi Good/Repair/Damage → stok diposting. status = 'repair' (bila ada repair) / 'done'
   3) REPAIR   — barang repair diretur ke vendor; saat balik → 'Terima Repair' buat batch inbound baru
   ========================================================================= */

async function getBrandWarehouse(
  supabase: ReturnType<typeof createClient>,
  brandId: string, kind: "finished" | "damage", brandName: string
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("warehouses").select("id").eq("kind", kind).eq("brand_id", brandId).is("deleted_at", null).limit(1).maybeSingle();
  if (existing?.id) return existing.id as string;
  const label = kind === "damage" ? "Damage" : "Gudang";
  const { data: created } = await supabase
    .from("warehouses")
    .insert({ company_id: DEMO_COMPANY_ID, brand_id: brandId, code: `${kind === "damage" ? "DMG" : "WH"}-${brandName.slice(0, 6).toUpperCase()}`, name: `${label} ${brandName}`, kind, is_demo: false })
    .select("id").single();
  return (created?.id as string) ?? null;
}

async function nextIncomingNo(supabase: ReturnType<typeof createClient>, poId: string): Promise<number> {
  const { count } = await supabase.from("fg_receipts").select("id", { count: "exact", head: true }).eq("po_id", poId);
  return (count ?? 0) + 1;
}

async function addStock(
  supabase: ReturnType<typeof createClient>,
  variantId: string, warehouseId: string, stockStatus: string, qty: number, unitCost: number,
  brandId: string, sourceDocId: string
): Promise<string | null> {
  const { error: mvErr } = await supabase.from("inventory_movements").insert({
    company_id: DEMO_COMPANY_ID, brand_id: brandId,
    variant_id: variantId, warehouse_id: warehouseId,
    movement_type: "production_in", stock_status: stockStatus,
    qty, unit_cost: unitCost, source_doc_type: "fg_receipt", source_doc_id: sourceDocId, is_demo: false,
  });
  if (mvErr) return mvErr.message;

  const { data: bal } = await supabase
    .from("stock_balances").select("qty_on_hand,moving_avg_cost")
    .eq("variant_id", variantId).eq("warehouse_id", warehouseId).eq("stock_status", stockStatus).maybeSingle();
  const oldQty = Number(bal?.qty_on_hand) || 0;
  const oldAvg = Number(bal?.moving_avg_cost) || 0;
  const newQty = oldQty + qty;
  const newAvg = newQty > 0 ? (oldQty * oldAvg + qty * unitCost) / newQty : 0;

  const { error: balErr } = await supabase.from("stock_balances").upsert(
    {
      company_id: DEMO_COMPANY_ID, brand_id: brandId,
      variant_id: variantId, warehouse_id: warehouseId, stock_status: stockStatus,
      qty_on_hand: newQty, moving_avg_cost: newAvg, is_demo: false,
    },
    { onConflict: "variant_id,warehouse_id,stock_status" }
  );
  return balErr ? balErr.message : null;
}

/* ---------------- TAHAP 1: INBOUND ---------------- */

export type InboundLineInput = {
  variantId: string | null;
  sku: string;
  size: string;
  productName: string;
  qtyIncoming: number;
  unitCost: number;
};
export type InboundInput = {
  poId: string;
  poCode: string;
  spkId: string | null;
  brandId: string;
  supplierId: string | null;
  receiptDate: string;
  notes: string;
  lines: InboundLineInput[];
};

export async function createInbound(input: InboundInput): Promise<Result> {
  const supabase = createClient();
  if (!canAct(await getRole(supabase), "fg_incoming_qc")) return { ok: false, error: "Anda tidak punya akses untuk aksi ini." };
  if (!input.brandId) return { ok: false, error: "Brand tidak diketahui dari PO." };
  const lines = input.lines.filter((l) => l.qtyIncoming > 0);
  if (lines.length === 0) return { ok: false, error: "Isi qty incoming minimal satu baris." };

  const no = await nextIncomingNo(supabase, input.poId);
  const code = `GRN-${input.poCode.trim().toUpperCase()}-${no}`;

  const { data: rcpt, error: rErr } = await supabase.from("fg_receipts").insert({
    company_id: DEMO_COMPANY_ID, brand_id: input.brandId,
    code, po_id: input.poId, spk_id: input.spkId, supplier_id: input.supplierId,
    incoming_no: no, receipt_date: input.receiptDate || null,
    notes: input.notes.trim() || null, status: "inbound", is_demo: false,
  }).select("id").single();
  if (rErr || !rcpt) return { ok: false, error: rErr?.message ?? "Gagal menyimpan inbound." };

  const lineRows = lines.map((l) => ({
    company_id: DEMO_COMPANY_ID, brand_id: input.brandId,
    receipt_id: rcpt.id, variant_id: l.variantId, sku: l.sku || null, size: l.size || null, product_name: l.productName || null,
    qty_incoming: l.qtyIncoming, qty_good: 0, qty_repair: 0, qty_damage: 0, unit_cost: l.unitCost || 0, is_demo: false,
  }));
  const { error: lErr } = await supabase.from("fg_receipt_lines").insert(lineRows);
  if (lErr) { await supabase.from("fg_receipts").delete().eq("id", rcpt.id); return { ok: false, error: lErr.message }; }

  rv();
  return { ok: true, id: rcpt.id as string, code };
}

/* ---------------- TAHAP 2: QC ---------------- */

export type QCLineInput = {
  lineId: string;
  variantId: string | null;
  sku: string;
  qtyIncoming: number;
  qtyGood: number;
  qtyRepair: number;
  qtyDamage: number;
  unitCost: number;
};

export async function submitQC(
  receiptId: string, goodWarehouseId: string, damageWarehouseId: string | null, lines: QCLineInput[]
): Promise<SimpleResult> {
  const supabase = createClient();
  if (!canAct(await getRole(supabase), "fg_incoming_qc")) return { ok: false, error: "Anda tidak punya akses untuk aksi ini." };
  for (const l of lines) {
    const sum = l.qtyGood + l.qtyRepair + l.qtyDamage;
    // Semua pcs harus dipertanggungjawabkan: Good + Repair + Damage = Incoming.
    if (sum !== l.qtyIncoming) return { ok: false, error: `${l.sku}: Good+Repair+Damage (${sum}) harus sama dengan Incoming (${l.qtyIncoming}). Sisa yang belum lolos QC masukkan ke Repair.` };
  }

  const { data: rcpt } = await supabase.from("fg_receipts").select("id,brand_id,po_id,status").eq("id", receiptId).single();
  if (!rcpt) return { ok: false, error: "Dokumen tidak ditemukan." };
  if (rcpt.status !== "inbound") return { ok: false, error: "QC hanya bisa untuk dokumen berstatus Inbound." };

  const { data: brand } = await supabase.from("brands").select("name").eq("id", rcpt.brand_id).maybeSingle();
  const brandName = (brand?.name as string | undefined) ?? "Brand";

  const goodWh = goodWarehouseId || (await getBrandWarehouse(supabase, rcpt.brand_id as string, "finished", brandName));
  if (!goodWh) return { ok: false, error: "Gudang jadi tidak ditemukan. Buat di Master Data → Gudang." };
  const hasDamage = lines.some((l) => l.qtyDamage > 0);
  let damageWh = damageWarehouseId || "";
  if (hasDamage && !damageWh) {
    damageWh = (await getBrandWarehouse(supabase, rcpt.brand_id as string, "damage", brandName)) ?? "";
    if (!damageWh) return { ok: false, error: "Gudang damage tidak ditemukan. Buat di Master Data → Gudang." };
  }

  // Update baris + posting stok
  for (const l of lines) {
    await supabase.from("fg_receipt_lines")
      .update({ qty_good: l.qtyGood, qty_repair: l.qtyRepair, qty_damage: l.qtyDamage, updated_at: new Date().toISOString() })
      .eq("id", l.lineId);
    if (l.variantId && l.qtyGood > 0) {
      const e = await addStock(supabase, l.variantId, goodWh, "available", l.qtyGood, l.unitCost || 0, rcpt.brand_id as string, receiptId);
      if (e) return { ok: false, error: e };
    }
    if (l.variantId && l.qtyDamage > 0 && damageWh) {
      const e = await addStock(supabase, l.variantId, damageWh, "damaged", l.qtyDamage, l.unitCost || 0, rcpt.brand_id as string, receiptId);
      if (e) return { ok: false, error: e };
    }
  }

  // Akumulasi good ke baris PO
  for (const l of lines) {
    if (l.qtyGood <= 0 || !l.sku) continue;
    const { data: pol } = await supabase.from("production_po_lines").select("id,received_qty").eq("po_id", rcpt.po_id).eq("sku", l.sku).maybeSingle();
    if (pol?.id) {
      await supabase.from("production_po_lines")
        .update({ received_qty: (Number(pol.received_qty) || 0) + l.qtyGood, updated_at: new Date().toISOString() })
        .eq("id", pol.id);
    }
  }

  const hasRepair = lines.some((l) => l.qtyRepair > 0);
  const { error } = await supabase.from("fg_receipts").update({
    good_warehouse_id: goodWh, damage_warehouse_id: damageWh || null,
    status: hasRepair ? "repair" : "done", updated_at: new Date().toISOString(),
  }).eq("id", receiptId);
  if (error) return { ok: false, error: error.message };

  rv();
  return { ok: true };
}

/* ---------------- INVOICE PER GRN (dari Good batch, tanpa nunggu repair) ---------------- */

/**
 * Terbitkan invoice jasa untuk SATU GRN, berdasarkan Good batch tsb.
 * Nomor mengikuti kode PO Produksi → INV-{Kode PO}. Bila 1 PO punya >1 GRN
 * yang ditagih (mis. batch repair), diberi sufiks -2, -3, dst.
 */
export async function createGrnInvoice(receiptId: string): Promise<{ ok: true; invoiceNo: string } | { ok: false; error: string }> {
  const supabase = createClient();
  if (!canAct(await getRole(supabase), "fg_incoming_qc")) return { ok: false, error: "Anda tidak punya akses untuk aksi ini." };
  const { data: r } = await supabase.from("fg_receipts").select("id,po_id,brand_id,status,invoice_no").eq("id", receiptId).single();
  if (!r) return { ok: false, error: "GRN tidak ditemukan." };
  if (r.status === "inbound") return { ok: false, error: "QC batch ini belum diproses." };
  if (r.invoice_no) return { ok: true, invoiceNo: r.invoice_no as string };

  const { data: lines } = await supabase.from("fg_receipt_lines").select("qty_good").eq("receipt_id", receiptId).is("deleted_at", null);
  const good = (lines ?? []).reduce((s, l) => s + (Number(l.qty_good) || 0), 0);
  if (good <= 0) return { ok: false, error: "Tidak ada Good pada batch ini." };

  const { data: po } = await supabase.from("production_pos").select("code").eq("id", r.po_id).maybeSingle();
  const poCode = ((po?.code as string | undefined) ?? "PO").trim().toUpperCase();
  // Berapa GRN dari PO ini yang sudah punya invoice → tentukan sufiks.
  const { count } = await supabase.from("fg_receipts").select("id", { count: "exact", head: true }).eq("po_id", r.po_id).not("invoice_no", "is", null);
  const n = count ?? 0;
  const invoiceNo = n === 0 ? `INV-${poCode}` : `INV-${poCode}-${n + 1}`;
  const today = new Date().toISOString().slice(0, 10);

  const { error } = await supabase.from("fg_receipts")
    .update({ invoice_no: invoiceNo, invoice_date: today, updated_at: new Date().toISOString() }).eq("id", receiptId);
  if (error) return { ok: false, error: error.message };
  rv();
  return { ok: true, invoiceNo };
}

/* ---------------- TAHAP 3: TERIMA REPAIR (buat batch inbound baru) ---------------- */

export type RepairReturnLine = { sku: string; qtyBalik: number };

export async function receiveRepair(receiptId: string, balik: RepairReturnLine[]): Promise<Result> {
  const supabase = createClient();
  if (!canAct(await getRole(supabase), "fg_incoming_qc")) return { ok: false, error: "Anda tidak punya akses untuk aksi ini." };
  const { data: src } = await supabase
    .from("fg_receipts").select("id,po_id,spk_id,brand_id,supplier_id,status").eq("id", receiptId).single();
  if (!src) return { ok: false, error: "Dokumen tidak ditemukan." };
  if (src.status !== "repair") return { ok: false, error: "Hanya dokumen berstatus Repair yang bisa diterima repairnya." };

  const { data: srcLines } = await supabase
    .from("fg_receipt_lines").select("variant_id,sku,size,product_name,qty_repair,unit_cost").eq("receipt_id", receiptId).is("deleted_at", null);
  const repairLines = (srcLines ?? []).filter((l) => (Number(l.qty_repair) || 0) > 0);
  if (repairLines.length === 0) return { ok: false, error: "Tidak ada qty repair pada dokumen ini." };

  const balikBySku = new Map<string, number>();
  for (const b of balik) balikBySku.set(b.sku, b.qtyBalik);

  // Baris batch balik = qty yang benar-benar kembali (≤ qty repair). Sisanya = Not Returned.
  const returnRows = repairLines
    .map((l) => {
      const repairQty = Number(l.qty_repair) || 0;
      const back = Math.min(balikBySku.get(l.sku as string) ?? repairQty, repairQty);
      return { l, back };
    })
    .filter((x) => x.back > 0);
  if (returnRows.length === 0) return { ok: false, error: "Isi qty balik minimal satu SKU." };

  const { data: po } = await supabase.from("production_pos").select("code").eq("id", src.po_id).maybeSingle();
  const poCode = ((po?.code as string | undefined) ?? "PO").toUpperCase();
  const no = await nextIncomingNo(supabase, src.po_id as string);
  const code = `GRN-${poCode}-${no}`;

  const { data: rcpt, error: rErr } = await supabase.from("fg_receipts").insert({
    company_id: DEMO_COMPANY_ID, brand_id: src.brand_id,
    code, po_id: src.po_id, spk_id: src.spk_id, supplier_id: src.supplier_id,
    incoming_no: no, notes: `Repair balik dari ${code}`, status: "inbound", is_demo: false,
  }).select("id").single();
  if (rErr || !rcpt) return { ok: false, error: rErr?.message ?? "Gagal membuat batch repair." };

  const lineRows = returnRows.map(({ l, back }) => ({
    company_id: DEMO_COMPANY_ID, brand_id: src.brand_id,
    receipt_id: rcpt.id, variant_id: l.variant_id, sku: l.sku, size: l.size, product_name: l.product_name,
    qty_incoming: back, qty_good: 0, qty_repair: 0, qty_damage: 0, unit_cost: Number(l.unit_cost) || 0, is_demo: false,
  }));
  await supabase.from("fg_receipt_lines").insert(lineRows);

  // Dokumen sumber selesai (repairnya sudah ditarik ke batch balik).
  await supabase.from("fg_receipts").update({ status: "done", updated_at: new Date().toISOString() }).eq("id", receiptId);

  rv();
  return { ok: true, id: rcpt.id as string, code };
}
