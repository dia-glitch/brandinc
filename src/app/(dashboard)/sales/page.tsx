import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getAccounts } from "@/lib/finance";
import { getSkuCosting } from "@/lib/costing";
import { isAdmin } from "@/lib/roles";
import { SalesView, type SaleRow, type StockOpt, type BrandOpt, type ChannelOpt, type AccountOpt } from "./sales-view";

async function getData() {
  if (!isSupabaseConfigured()) return { rows: [] as SaleRow[], stock: [] as StockOpt[], brands: [] as BrandOpt[], channels: [] as ChannelOpt[], accounts: [] as AccountOpt[], admin: false };
  const supabase = createClient();
  const [soRes, soLineRes, balRes, varRes, prodRes, whRes, brandRes, chanRes, payRes, accs, cogm, srRes, srLineRes] = await Promise.all([
    supabase.from("sales_orders").select("id,code,brand_id,channel_id,settlement,ext_order_id,customer,order_date,discount,commission,ppn,notes").is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("sales_order_lines").select("order_id,ext_order_id,variant_id,warehouse_id,sku,size,product_name,qty,retail,price,cogm").is("deleted_at", null),
    supabase.from("stock_balances").select("variant_id,warehouse_id,qty_on_hand").eq("stock_status", "available").is("deleted_at", null),
    supabase.from("product_variants").select("id,sku,size,product_id,retail_price").is("deleted_at", null),
    supabase.from("products").select("id,name,brand_id,retail_price").is("deleted_at", null),
    supabase.from("warehouses").select("id,name,kind").is("deleted_at", null),
    supabase.from("brands").select("id,name").is("deleted_at", null).order("name"),
    supabase.from("sales_channels").select("id,name,grup,warehouse_id,is_active").is("deleted_at", null).order("name"),
    supabase.from("payments").select("ref_key,amount").in("ref_type", ["sales_receipt", "ar_receipt"]).eq("direction", "in").is("deleted_at", null),
    getAccounts(supabase),
    getSkuCosting(supabase),
    supabase.from("sales_returns").select("id,order_id").is("deleted_at", null),
    supabase.from("sales_return_lines").select("return_id,qty,price").is("deleted_at", null),
  ]);

  const brands = (brandRes.data ?? []).map((b) => ({ id: b.id as string, name: b.name as string }));
  const brandName = (id: string | null) => brands.find((b) => b.id === id)?.name ?? "—";
  const chanName = (id: string | null) => (chanRes.data ?? []).find((c) => c.id === id)?.name ?? "—";
  const variants = varRes.data ?? [];
  const products = prodRes.data ?? [];
  const whName = (id: string | null) => (whRes.data ?? []).find((w) => w.id === id)?.name ?? "—";

  const paidByCode = new Map<string, number>();
  (payRes.data ?? []).forEach((p) => { const k = (p.ref_key as string) ?? ""; if (k) paidByCode.set(k, (paidByCode.get(k) ?? 0) + (Number(p.amount) || 0)); });
  // Nilai retur per order → kurangi tagihan (total) penjualan.
  const srValByOrder = new Map<string, number>();
  const srLineByRet = srLineRes.data ?? [];
  for (const r of srRes.data ?? []) {
    const oid = (r.order_id as string | null) ?? ""; if (!oid) continue;
    const v = srLineByRet.filter((l) => l.return_id === r.id).reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
    srValByOrder.set(oid, (srValByOrder.get(oid) ?? 0) + v);
  }

  const soLines = soLineRes.data ?? [];
  const rows: SaleRow[] = (soRes.data ?? []).map((o) => {
    const lines = soLines.filter((l) => l.order_id === o.id);
    const gross = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.retail) || Number(l.price) || 0), 0);
    const net = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
    const discount = Math.max(0, gross - net);
    const cogs = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.cogm) || 0), 0);
    const commission = Number(o.commission) || 0;
    const returned = srValByOrder.get(o.id as string) ?? 0;
    const total = Math.max(0, net + (Number(o.ppn) || 0) - commission - returned); // AR = net setelah komisi & retur
    const paid = paidByCode.get(o.code as string) ?? 0;
    return {
      id: o.id as string, code: o.code as string, brand: brandName((o.brand_id as string | null) ?? null), brandId: (o.brand_id as string | null) ?? null,
      channel: chanName((o.channel_id as string | null) ?? null), channelId: (o.channel_id as string | null) ?? null, settlement: (o.settlement as string) ?? "ar",
      extOrderId: (o.ext_order_id as string | null) ?? "", customer: (o.customer as string | null) ?? "", date: (o.order_date as string | null) ?? null,
      subtotal: gross, discount, commission, ppn: Number(o.ppn) || 0, total, cogs, paid,
      status: paid <= 0 ? "unpaid" : paid >= total ? "paid" : "partial",
      lines: lines.map((l) => ({ variantId: (l.variant_id as string | null) ?? "", warehouseId: (l.warehouse_id as string | null) ?? "", extOrderId: (l.ext_order_id as string | null) ?? "", sku: (l.sku as string | null) ?? "", size: (l.size as string | null) ?? "", productName: (l.product_name as string | null) ?? "", qty: Number(l.qty) || 0, retail: Number(l.retail) || 0, price: Number(l.price) || 0, cogm: Number(l.cogm) || 0 })),
    };
  });

  // Stok barang jadi tersedia untuk dijual.
  const stock: StockOpt[] = [];
  for (const b of balRes.data ?? []) {
    const qty = Number(b.qty_on_hand) || 0;
    if (qty <= 0) continue;
    const v = variants.find((x) => x.id === b.variant_id);
    if (!v) continue;
    const prod = products.find((p) => p.id === v.product_id);
    const sc = cogm.get((v.sku as string) ?? "");
    const retail = (sc?.retail && sc.retail > 0 ? sc.retail : 0) || Number(v.retail_price) || Number(prod?.retail_price) || 0;
    stock.push({
      variantId: v.id as string, warehouseId: b.warehouse_id as string, warehouse: whName((b.warehouse_id as string | null) ?? null),
      sku: (v.sku as string) ?? "", size: (v.size as string | null) ?? "", productName: (prod?.name as string | undefined) ?? (v.sku as string),
      brandId: (prod?.brand_id as string | null) ?? null, avail: qty,
      retail, cogm: sc?.cogm ?? 0,
    });
  }

  const channels: ChannelOpt[] = (chanRes.data ?? []).filter((c) => c.is_active !== false).map((c) => ({ id: c.id as string, name: c.name as string, grup: (c.grup as string) ?? "online", warehouseId: (c.warehouse_id as string | null) ?? null }));
  const admin = await isAdmin(supabase);
  return { rows, stock, brands, channels, accounts: accs.map((a) => ({ id: a.id, name: a.name, balance: a.balance })), admin };
}

export default async function SalesPage() {
  const { rows, stock, brands, channels, accounts, admin } = await getData();
  return (
    <div className="mx-auto max-w-7xl">
      <SalesView rows={rows} stock={stock} brands={brands} channels={channels} accounts={accounts} isAdmin={admin} />
    </div>
  );
}
