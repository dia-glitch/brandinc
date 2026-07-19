"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Ban, RotateCcw, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { addVariant, cancelProduct, restoreProduct } from "./actions";

export type Variant = { id: string; sku: string; size: string | null; size_id: string | null };
export type ProductRow = {
  id: string;
  style_code: string;
  name: string;
  brand_id: string;
  brand_name: string;
  category_name: string;
  color_id: string | null;
  color: string | null;
  status: string; // active | cancelled
  variants: Variant[];
};
type SizeOpt = { id: string; name: string };

export function ProductList({ products, sizes, canEdit = true }: { products: ProductRow[]; sizes: SizeOpt[]; canEdit?: boolean }) {
  return (
    <div className="card overflow-hidden p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <th className="w-8 py-2.5 pl-4"></th>
            <th className="py-2.5 pr-3">Kode</th>
            <th className="py-2.5 pr-3">Produk</th>
            <th className="py-2.5 pr-3">SKU</th>
            <th className="hidden py-2.5 pr-3 md:table-cell">Brand</th>
            <th className="hidden py-2.5 pr-3 md:table-cell">Kategori</th>
            {canEdit && <th className="py-2.5 pr-4 text-right">Aksi</th>}
          </tr>
        </thead>
        {products.map((p) => <ProductRowItem key={p.id} product={p} sizes={sizes} canEdit={canEdit} />)}
      </table>
    </div>
  );
}

function ProductRowItem({ product, sizes, canEdit = true }: { product: ProductRow; sizes: SizeOpt[]; canEdit?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [addSizeId, setAddSizeId] = useState("");

  const cancelled = product.status === "cancelled";
  const usedSizeIds = new Set(product.variants.map((v) => v.size_id));
  const availableSizes = sizes.filter((s) => !usedSizeIds.has(s.id));

  function addSize() {
    const sz = sizes.find((s) => s.id === addSizeId);
    if (!sz) return;
    startTransition(async () => {
      await addVariant(product.id, product.style_code, product.brand_id, product.color_id, product.color, { id: sz.id, name: sz.name }, 0);
      setAddSizeId("");
      router.refresh();
    });
  }
  function doCancel() { startTransition(async () => { await cancelProduct(product.id); setConfirmCancel(false); router.refresh(); }); }
  function doRestore() { startTransition(async () => { await restoreProduct(product.id); router.refresh(); }); }

  return (
    <tbody className="border-b border-border last:border-b-0">
      <tr className={cn("font-semibold hover:bg-muted/40", cancelled && "opacity-60")}>
        <td className="py-2.5 pl-4">
          <button onClick={() => setOpen((v) => !v)} className="grid place-items-center text-muted-foreground">
            <ChevronRight className={cn("h-4 w-4 transition-transform", open && "rotate-90")} />
          </button>
        </td>
        <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">{product.style_code}</td>
        <td className="cursor-pointer py-2.5 pr-3" onClick={() => setOpen((v) => !v)}>
          <span className={cn(cancelled && "line-through")}>{product.name}</span>
          {cancelled && <Badge tone="danger" className="ml-2">Dibatalkan</Badge>}
        </td>
        <td className="py-2.5 pr-3"><Badge tone="neutral">{product.variants.length}</Badge></td>
        <td className="hidden py-2.5 pr-3 font-medium text-muted-foreground md:table-cell">{product.brand_name}</td>
        <td className="hidden py-2.5 pr-3 font-medium text-muted-foreground md:table-cell">{product.category_name}</td>
        {canEdit && (
        <td className="py-2.5 pr-4 text-right">
          {cancelled ? (
            <button onClick={doRestore} disabled={pending} title="Pulihkan" className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground">
              <RotateCcw className="h-4 w-4" /> Pulihkan
            </button>
          ) : confirmCancel ? (
            <span className="inline-flex items-center gap-1.5">
              <button onClick={() => setConfirmCancel(false)} className="text-xs font-bold text-muted-foreground hover:text-foreground">Batal</button>
              <button onClick={doCancel} disabled={pending} className="rounded-lg bg-danger px-2.5 py-1 text-xs font-bold text-white">Batalkan Produk</button>
            </span>
          ) : (
            <button onClick={() => setConfirmCancel(true)} title="Batalkan produk" className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-danger">
              <Ban className="h-4 w-4" /> Batalkan
            </button>
          )}
        </td>
        )}
      </tr>

      {open && (
        <tr>
          <td colSpan={7} className="bg-muted/20 px-4 pb-4 pt-1">
            <div className="ml-8 rounded-xl border border-border bg-surface">
              {product.variants.map((v) => (
                <div key={v.id} className="flex items-center gap-3 border-b border-border/60 px-3 py-2 last:border-b-0">
                  <span className="font-mono text-xs font-bold">{v.sku}</span>
                  <span className="text-xs font-semibold text-muted-foreground">{v.size ?? "—"}</span>
                </div>
              ))}
              {canEdit && !cancelled && availableSizes.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-2">
                  <select value={addSizeId} onChange={(e) => setAddSizeId(e.target.value)}
                    className="h-9 rounded-lg border border-border bg-background px-2.5 text-xs font-semibold outline-none focus:border-primary/40">
                    <option value="">+ Tambah ukuran…</option>
                    {availableSizes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <Button size="sm" variant="outline" disabled={!addSizeId || pending} onClick={addSize}>
                    <Plus className="h-4 w-4" /> Tambah
                  </Button>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </tbody>
  );
}
