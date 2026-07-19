import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { CogmTable, type CogmRow } from "./cogm-table";

async function getData(): Promise<{ rows: CogmRow[] }> {
  if (!isSupabaseConfigured()) return { rows: [] };
  const supabase = createClient();
  const [spkRes, spkLineRes, brandRes, miRes, miLineRes, poRes, poLineRes, costRes] = await Promise.all([
    supabase.from("work_orders").select("id,code,brand_id,status").is("deleted_at", null).order("code", { ascending: false }),
    supabase.from("work_order_lines").select("spk_id,product_name").is("deleted_at", null),
    supabase.from("brands").select("id,name").is("deleted_at", null),
    supabase.from("material_issues").select("id,spk_id,status").is("deleted_at", null),
    supabase.from("material_issue_lines").select("issue_id,qty,unit_cost").is("deleted_at", null),
    supabase.from("production_pos").select("id,spk_id,status").is("deleted_at", null),
    supabase.from("production_po_lines").select("po_id,received_qty,unit_cost").is("deleted_at", null),
    supabase.from("spk_costing").select("spk_id,retail_price,ppn_percent,locked").is("deleted_at", null),
  ]);

  const brands = (brandRes.data ?? []);
  const brandName = (id: string | null) => brands.find((b) => b.id === id)?.name ?? "—";
  const productOf = (spkId: string) => (spkLineRes.data ?? []).find((l) => l.spk_id === spkId)?.product_name as string | undefined;

  // Material total per SPK (issue aktif).
  const miById = new Map<string, string>(); // issue_id -> spk_id (aktif saja)
  (miRes.data ?? []).forEach((m) => { if ((m.status as string) !== "cancelled") miById.set(m.id as string, m.spk_id as string); });
  const materialBySpk = new Map<string, number>();
  (miLineRes.data ?? []).forEach((l) => {
    const spk = miById.get(l.issue_id as string);
    if (!spk) return;
    materialBySpk.set(spk, (materialBySpk.get(spk) ?? 0) + (Number(l.qty) || 0) * (Number(l.unit_cost) || 0));
  });

  // WIP total & qty good per SPK (dari PO produksi aktif, pakai received_qty = good final).
  const poById = new Map<string, string>();
  (poRes.data ?? []).forEach((p) => { if ((p.status as string) !== "cancelled") poById.set(p.id as string, p.spk_id as string); });
  const wipBySpk = new Map<string, number>();
  const goodBySpk = new Map<string, number>();
  (poLineRes.data ?? []).forEach((l) => {
    const spk = poById.get(l.po_id as string);
    if (!spk) return;
    const good = Number(l.received_qty) || 0;
    wipBySpk.set(spk, (wipBySpk.get(spk) ?? 0) + good * (Number(l.unit_cost) || 0));
    goodBySpk.set(spk, (goodBySpk.get(spk) ?? 0) + good);
  });

  const costBySpk = new Map<string, { retail: number; ppn: number; locked: boolean }>();
  (costRes.data ?? []).forEach((c) => costBySpk.set(c.spk_id as string, { retail: Number(c.retail_price) || 0, ppn: Number(c.ppn_percent) || 11, locked: Boolean(c.locked) }));

  const rows: CogmRow[] = (spkRes.data ?? [])
    .filter((s) => (s.status as string) !== "cancelled")
    .map((s) => {
      const id = s.id as string;
      const c = costBySpk.get(id);
      return {
        spkId: id,
        spkCode: s.code as string,
        product: productOf(id) ?? "—",
        brand: brandName((s.brand_id as string | null) ?? null),
        totalMaterial: materialBySpk.get(id) ?? 0,
        totalWip: wipBySpk.get(id) ?? 0,
        qtyGood: goodBySpk.get(id) ?? 0,
        retailPrice: c?.retail ?? 0,
        ppnPercent: c?.ppn ?? 11,
        locked: c?.locked ?? false,
      };
    })
    // Tampilkan yang sudah ada aktivitas costing (material / good / retail).
    .filter((r) => r.totalMaterial > 0 || r.qtyGood > 0 || r.retailPrice > 0);

  return { rows };
}

export default async function CogmPage() {
  const { rows } = await getData();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Produksi</p>
        <h1 className="text-2xl font-extrabold">COGM &amp; Harga Jual</h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          Per SPK: (Total Material + Total WIP) ÷ Qty Good = COGM/pcs. Isi retail price (bisa dikunci) → margin dihitung setelah PPN.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="font-bold">Belum ada data COGM</p>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            COGM muncul setelah ada Material Issue &amp; barang Good final (dari Incoming &amp; QC) untuk sebuah SPK.
          </p>
        </div>
      ) : (
        <CogmTable rows={rows} />
      )}
    </div>
  );
}
