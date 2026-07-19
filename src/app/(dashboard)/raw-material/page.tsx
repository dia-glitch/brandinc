import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getRole } from "@/lib/roles";
import { canAct } from "@/lib/permissions";
import { StockView, type StockRow, type Opt } from "./stock-view";

async function getData(): Promise<{ rows: StockRow[]; categories: Opt[]; brands: Opt[] }> {
  if (!isSupabaseConfigured()) return { rows: [], categories: [], brands: [] };
  const supabase = createClient();
  const [balRes, matRes, catRes, brandRes] = await Promise.all([
    supabase.from("material_stock_balances").select("material_id,qty_on_hand,moving_avg_cost").is("deleted_at", null),
    supabase.from("materials").select("id,name,code,unit,category_id,brand_id").is("deleted_at", null),
    supabase.from("material_categories").select("id,name,code").is("deleted_at", null).order("name"),
    supabase.from("brands").select("id,name").is("deleted_at", null).order("name"),
  ]);

  const materials = matRes.data ?? [];
  const categories = (catRes.data ?? []).map((c) => ({ id: c.id as string, name: c.name as string, code: (c.code as string | null) ?? null }));
  const brands = (brandRes.data ?? []).map((b) => ({ id: b.id as string, name: b.name as string }));
  const matInfo = (id: string) => materials.find((m) => m.id === id);
  const catInfo = (id: string | null) => categories.find((c) => c.id === id);
  const brandName = (id: string | null) => brands.find((b) => b.id === id)?.name ?? "Tanpa Brand";

  // Agregasi per material (jaga-jaga bila ada >1 saldo per material).
  const agg = new Map<string, { qty: number; value: number }>();
  for (const b of balRes.data ?? []) {
    const id = b.material_id as string;
    const qty = Number(b.qty_on_hand) || 0;
    const val = qty * (Number(b.moving_avg_cost) || 0);
    const cur = agg.get(id) ?? { qty: 0, value: 0 };
    cur.qty += qty; cur.value += val;
    agg.set(id, cur);
  }

  const rows: StockRow[] = Array.from(agg.entries()).map(([materialId, a]) => {
    const info = matInfo(materialId);
    const cat = catInfo((info?.category_id as string | null) ?? null);
    return {
      materialName: (info?.name as string | undefined) ?? "(material dihapus)",
      code: (info?.code as string | null) ?? null,
      unit: (info?.unit as string | null) ?? null,
      categoryId: (info?.category_id as string | null) ?? null,
      categoryName: cat?.name ?? "—",
      categoryCode: cat?.code ?? null,
      brandId: (info?.brand_id as string | null) ?? null,
      brandName: brandName((info?.brand_id as string | null) ?? null),
      qty: a.qty,
      avg: a.qty > 0 ? a.value / a.qty : 0,
      value: a.value,
    };
  }).sort((x, y) => x.materialName.localeCompare(y.materialName));

  return { rows, categories, brands };
}

export default async function RawMaterialPage() {
  const { rows, categories, brands } = await getData();
  let canEdit = true;
  if (isSupabaseConfigured()) canEdit = canAct(await getRole(createClient()), "rm_stock");

  return (
    <div className="mx-auto max-w-7xl">
      <StockView rows={rows} categories={categories} brands={brands} canEdit={canEdit} />
    </div>
  );
}
