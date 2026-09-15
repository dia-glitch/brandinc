"use server";

import { createSale, type SaleLineInput } from "../sales/actions";

export type PosCheckoutLine = SaleLineInput & { brandId: string };
export type PosCheckoutInput = {
  warehouseId: string;
  method: string;       // Tunai / Transfer / QRIS / Kartu Debit / Kartu Kredit
  locationName: string;
  date: string;
  lines: PosCheckoutLine[];
};
export type PosResult = { ok: true; codes: string[] } | { ok: false; error: string };

/** Checkout POS: catat penjualan (lunas cash, tanpa posting kas) & kurangi stok lokasi.
 *  createSale per-brand karena satu sales order = satu brand. */
export async function posCheckout(input: PosCheckoutInput): Promise<PosResult> {
  const lines = (input.lines ?? []).filter((l) => l.variantId && l.qty > 0);
  if (lines.length === 0) return { ok: false, error: "Keranjang kosong." };
  if (!input.warehouseId) return { ok: false, error: "Pilih lokasi dulu." };

  // Group per brand.
  const byBrand = new Map<string, PosCheckoutLine[]>();
  for (const l of lines) {
    const arr = byBrand.get(l.brandId) ?? [];
    arr.push({ ...l, warehouseId: input.warehouseId });
    byBrand.set(l.brandId, arr);
  }

  const codes: string[] = [];
  for (const [brandId, bLines] of byBrand) {
    const res = await createSale({
      brandId,
      channelId: null,
      settlement: "cash", // POS = lunas langsung (bukan piutang)
      orderDate: input.date,
      ppn: 0,
      notes: `POS · ${input.method} · ${input.locationName}`,
      lines: bLines.map((l) => ({ ...l, warehouseId: input.warehouseId, price: l.retail })),
    });
    if (!res.ok) return { ok: false, error: res.error };
    codes.push(res.code);
  }
  return { ok: true, codes };
}
