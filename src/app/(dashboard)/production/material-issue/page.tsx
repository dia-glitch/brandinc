import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getRole } from "@/lib/roles";
import { canAct } from "@/lib/permissions";
import { IssueForm, type SpkOpt, type WarehouseOpt, type MaterialOpt } from "./issue-form";
import { IssueList, type IssueRow } from "./issue-list";

async function getData() {
  if (!isSupabaseConfigured()) return { spks: [] as SpkOpt[], warehouses: [] as WarehouseOpt[], materials: [] as MaterialOpt[], rows: [] as IssueRow[] };
  const supabase = createClient();
  const [spkRes, brandRes, matRes, balRes, whRes, issRes, issLineRes] = await Promise.all([
    supabase.from("work_orders").select("id,code,brand_id,status").is("deleted_at", null).order("code", { ascending: false }),
    supabase.from("brands").select("id,name").is("deleted_at", null),
    supabase.from("materials").select("id,name,code,unit,brand_id").is("deleted_at", null).eq("is_active", true).order("name"),
    supabase.from("material_stock_balances").select("material_id,warehouse_id,qty_on_hand,moving_avg_cost").is("deleted_at", null).eq("stock_status", "available"),
    supabase.from("warehouses").select("id,name,kind").is("deleted_at", null).order("name"),
    supabase.from("material_issues").select("id,code,spk_id,warehouse_id,issue_date,status,notes").is("deleted_at", null).order("code", { ascending: false }),
    supabase.from("material_issue_lines").select("id,issue_id,material_name,unit,qty,unit_cost").is("deleted_at", null),
  ]);

  const brands = (brandRes.data ?? []).map((b) => ({ id: b.id as string, name: b.name as string }));
  const brandName = (id: string | null) => brands.find((b) => b.id === id)?.name ?? "—";
  // Gudang bahan baku (kind material) diprioritaskan, plus umum.
  const whAll = (whRes.data ?? []).map((w) => ({ id: w.id as string, name: w.name as string, kind: (w.kind as string) ?? "warehouse" }));
  const warehouses: WarehouseOpt[] = whAll.filter((w) => w.kind === "material" || w.kind === "warehouse").map((w) => ({ id: w.id, name: w.name }));
  const whName = (id: string | null) => whAll.find((w) => w.id === id)?.name ?? "—";

  // Saldo per material di gudang bahan pertama (asumsi 1 gudang RM). Ambil saldo terbesar bila banyak.
  const balByMat = new Map<string, { qty: number; avg: number }>();
  for (const b of balRes.data ?? []) {
    const id = b.material_id as string;
    const cur = balByMat.get(id) ?? { qty: 0, avg: 0 };
    cur.qty += Number(b.qty_on_hand) || 0;
    cur.avg = Number(b.moving_avg_cost) || cur.avg;
    balByMat.set(id, cur);
  }

  const materials: MaterialOpt[] = (matRes.data ?? []).map((m) => {
    const bal = balByMat.get(m.id as string);
    return { id: m.id as string, name: m.name as string, code: (m.code as string | null) ?? null, unit: (m.unit as string | null) ?? null, brandId: (m.brand_id as string | null) ?? null, avail: bal?.qty ?? 0, avg: bal?.avg ?? 0 };
  });

  const spks: SpkOpt[] = (spkRes.data ?? [])
    .filter((s) => (s.status as string) !== "cancelled")
    .map((s) => ({ id: s.id as string, code: s.code as string, brandId: (s.brand_id as string) ?? "", brandName: brandName((s.brand_id as string | null) ?? null) }));
  const spkCode = (id: string | null) => spks.find((s) => s.id === id)?.code ?? "—";
  const spkBrand = (id: string | null) => spks.find((s) => s.id === id)?.brandName ?? "—";

  const issLines = issLineRes.data ?? [];
  const rows: IssueRow[] = (issRes.data ?? []).map((r) => ({
    id: r.id as string,
    code: r.code as string,
    spk_code: spkCode((r.spk_id as string | null) ?? null),
    brand_name: spkBrand((r.spk_id as string | null) ?? null),
    warehouse_name: whName((r.warehouse_id as string | null) ?? null),
    issue_date: (r.issue_date as string | null) ?? null,
    status: (r.status as string) ?? "issued",
    notes: (r.notes as string | null) ?? null,
    lines: issLines.filter((l) => l.issue_id === r.id).map((l) => ({
      id: l.id as string, material_name: (l.material_name as string | null) ?? null, unit: (l.unit as string | null) ?? null,
      qty: (l.qty as string | number) ?? 0, unit_cost: (l.unit_cost as string | number) ?? 0,
    })),
  }));

  return { spks, warehouses, materials, rows };
}

export default async function MaterialIssuePage() {
  const { spks, warehouses, materials, rows } = await getData();

  let canEdit = true;
  if (isSupabaseConfigured()) canEdit = canAct(await getRole(createClient()), "prod_material_issue");

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Produksi</p>
          <h1 className="text-2xl font-extrabold">Material Issue</h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            {rows.length} pengeluaran. Keluarkan bahan dari gudang ke SPK — nilai keluar (avg cost) jadi komponen COGM.
          </p>
        </div>
        {canEdit && <IssueForm spks={spks} warehouses={warehouses} materials={materials} />}
      </div>

      {rows.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="font-bold">Belum ada material issue</p>
          <p className="mt-1 text-sm font-medium text-muted-foreground">Klik &quot;Keluarkan Bahan&quot;: pilih SPK → tambah bahan &amp; qty. Stok bahan berkurang otomatis.</p>
        </div>
      ) : (
        <IssueList rows={rows} canEdit={canEdit} />
      )}
    </div>
  );
}
