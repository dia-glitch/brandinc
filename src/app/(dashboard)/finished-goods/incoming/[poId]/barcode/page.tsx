import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSkuCosting } from "@/lib/costing";
import { BarcodeView, type LabelSku, type BarcodeInfo } from "./barcode-view";

export default async function BarcodePage({ params }: { params: { poId: string } }) {
  if (!isSupabaseConfigured()) notFound();
  const supabase = createClient();
  const poId = params.poId;

  const { data: po } = await supabase.from("production_pos").select("id,code,brand_id,spk_id,supplier_id").eq("id", poId).is("deleted_at", null).maybeSingle();
  if (!po) notFound();

  const [poLineRes, spkRes, supRes, rcptRes, costing] = await Promise.all([
    supabase.from("production_po_lines").select("sku,size,product_name,qty,unit_cost").eq("po_id", poId).is("deleted_at", null),
    po.spk_id ? supabase.from("work_orders").select("code").eq("id", po.spk_id as string).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("suppliers").select("id,name").is("deleted_at", null),
    supabase.from("fg_receipts").select("id").eq("po_id", poId).is("deleted_at", null),
    getSkuCosting(supabase),
  ]);

  const poLines = poLineRes.data ?? [];
  const receiptIds = (rcptRes.data ?? []).map((r) => r.id as string);
  const { data: rLineData } = receiptIds.length
    ? await supabase.from("fg_receipt_lines").select("sku,qty_good").in("receipt_id", receiptIds).is("deleted_at", null)
    : { data: [] as Array<{ sku: string; qty_good: number }> };
  const receivedBySku = new Map<string, number>();
  (rLineData ?? []).forEach((l) => receivedBySku.set(l.sku as string, (receivedBySku.get(l.sku as string) ?? 0) + (Number(l.qty_good) || 0)));

  const skus: LabelSku[] = poLines.map((l) => {
    const sku = (l.sku as string) ?? "";
    return {
      sku,
      size: (l.size as string | null) ?? "",
      qtyPo: Number(l.qty) || 0,
      received: receivedBySku.get(sku) ?? 0,
      retail: costing.get(sku)?.retail ?? 0,
    };
  });

  const defaultPrice = skus.map((s) => s.retail).find((r) => r > 0) ?? 0;

  const info: BarcodeInfo = {
    poId,
    poCode: po.code as string,
    spkCode: ((spkRes.data as { code?: string } | null)?.code as string) ?? "—",
    product: (poLines[0]?.product_name as string) ?? "—",
    supplier: (supRes.data ?? []).find((s) => s.id === po.supplier_id)?.name ?? "—",
    defaultPrice,
  };

  return <BarcodeView info={info} skus={skus} />;
}
