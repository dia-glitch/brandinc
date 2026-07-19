"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { createSPK } from "./actions";

export type BrandOpt = { id: string; name: string; code: string };
export type SupplierOpt = { id: string; name: string };
export type VariantOpt = { id: string; sku: string; size: string | null; size_id: string | null };
export type ProductOpt = { id: string; name: string; brand_id: string; variants: VariantOpt[] };

const SUPPLIER_TYPES = ["CMT", "FOB", "Full Package", "Cut-Make", "Lainnya"];

export function SPKForm({ brands, products, suppliers }: { brands: BrandOpt[]; products: ProductOpt[]; suppliers: SupplierOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [brandId, setBrandId] = useState("");
  const [productId, setProductId] = useState("");
  const [spkDate, setSpkDate] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [supplierType, setSupplierType] = useState("");
  const [merchandiser, setMerchandiser] = useState("");
  const [dueDelivery, setDueDelivery] = useState("");
  const [totalQty, setTotalQty] = useState("");
  const [buttonAccessories, setButtonAccessories] = useState("");
  const [careLabel, setCareLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [vendorComment, setVendorComment] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [ratios, setRatios] = useState<Record<string, string>>({});
  const [specs, setSpecs] = useState<{ name: string; type: string; values: Record<string, string> }[]>([]);

  const brand = brands.find((b) => b.id === brandId);
  const brandProducts = useMemo(() => products.filter((p) => p.brand_id === brandId), [products, brandId]);
  const product = brandProducts.find((p) => p.id === productId);

  // Hitung qty per ukuran = total / Σratio × ratio, dibulatkan; sisa pembulatan ditaruh di ratio terbesar.
  const computed = useMemo(() => {
    const vs = product?.variants ?? [];
    const rs = vs.map((v) => ({ v, ratio: Number(ratios[v.id]) || 0 }));
    const sum = rs.reduce((s, x) => s + x.ratio, 0);
    const t = Number(totalQty) || 0;
    const qtys = rs.map((x) => (sum > 0 && t > 0 ? Math.round((t * x.ratio) / sum) : 0));
    if (sum > 0 && t > 0) {
      const diff = t - qtys.reduce((a, b) => a + b, 0);
      if (diff !== 0) {
        let idx = 0, maxR = -1;
        rs.forEach((x, i) => { if (x.ratio > maxR) { maxR = x.ratio; idx = i; } });
        qtys[idx] += diff;
      }
    }
    return { rows: rs.map((x, i) => ({ ...x, qty: qtys[i] })), sum };
  }, [product, ratios, totalQty]);

  function openDialog() {
    setOpen(true);
    if (!spkDate) {
      const d = new Date();
      setSpkDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    }
  }
  function reset() {
    setBrandId(""); setProductId(""); setSupplierId(""); setSupplierType(""); setMerchandiser("");
    setDueDelivery(""); setTotalQty(""); setButtonAccessories(""); setCareLabel(""); setNotes("");
    setVendorComment(""); setImageUrl(""); setUploading(false); setRatios({}); setSpecs([]); setError(null);
  }
  function close() { setOpen(false); reset(); }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError(null);
    try {
      const supabase = createClient();
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("spk-images").upload(path, file, { upsert: false });
      if (upErr) { setError("Gagal upload gambar: " + upErr.message); setUploading(false); return; }
      const { data } = supabase.storage.from("spk-images").getPublicUrl(path);
      setImageUrl(data.publicUrl);
    } catch {
      setError("Gagal upload gambar. Pastikan bucket 'spk-images' sudah dibuat di Supabase.");
    }
    setUploading(false);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!brand) { setError("Pilih brand."); return; }
    if (!product) { setError("Pilih produk."); return; }
    if (!(Number(totalQty) > 0)) { setError("Isi total qty produksi."); return; }
    const lines = computed.rows.filter((r) => r.qty > 0).map((r) => ({
      productId: product.id, variantId: r.v.id, sku: r.v.sku,
      size: r.v.size ?? "", productName: product.name, ratio: r.ratio, qty: r.qty,
    }));
    if (lines.length === 0) { setError("Isi ratio minimal satu ukuran."); return; }
    const specOut = specs.filter((s) => s.name.trim()).map((s) => ({
      name: s.name, type: s.type,
      values: Object.fromEntries(
        Object.entries(s.values).filter(([, v]) => v !== "" && !isNaN(Number(v))).map(([k, v]) => [k, Number(v)])
      ),
    }));
    startTransition(async () => {
      const res = await createSPK({
        brandId: brand.id, brandCode: brand.code, spkDate,
        supplierId: supplierId || null, supplierType, merchandiser, dueDelivery,
        buttonAccessories, careLabel, notes, vendorComment, imageUrl, lines, specs: specOut,
      });
      if (!res.ok) { setError(res.error); return; }
      close();
      router.refresh();
    });
  }

  const specSizes = product?.variants.map((v) => v.size ?? v.sku) ?? [];
  function addSpecRow() { setSpecs((p) => [...p, { name: "", type: "", values: {} }]); }
  function setSpecField(i: number, field: "name" | "type", val: string) {
    setSpecs((p) => p.map((s, idx) => (idx === i ? { ...s, [field]: val } : s)));
  }
  function setSpecVal(i: number, size: string, val: string) {
    setSpecs((p) => p.map((s, idx) => (idx === i ? { ...s, values: { ...s.values, [size]: val } } : s)));
  }
  function removeSpec(i: number) { setSpecs((p) => p.filter((_, idx) => idx !== i)); }

  const previewCode = brand ? `SPK-${brand.code.toUpperCase()}-###` : "—";
  const computedTotal = computed.rows.reduce((s, r) => s + r.qty, 0);

  return (
    <>
      <Button size="sm" onClick={openDialog}>
        <Plus className="h-4 w-4" /> Buat SPK
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-eerie/40 p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-surface p-6 shadow-soft">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-extrabold">Buat SPK</h2>
              <button onClick={close} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Brand</label>
                  <select value={brandId} onChange={(e) => { setBrandId(e.target.value); setProductId(""); setRatios({}); }} className={sel}>
                    <option value="">— Pilih —</option>
                    {brands.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Produk</label>
                  <select value={productId} onChange={(e) => { setProductId(e.target.value); setRatios({}); }} className={sel} disabled={!brandId}>
                    <option value="">{brandId ? "— Pilih —" : "pilih brand dulu"}</option>
                    {brandProducts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <label className={lbl}>Supplier / Vendor</label>
                  <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={sel}>
                    <option value="">— Pilih —</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Tipe Supplier</label>
                  <select value={supplierType} onChange={(e) => setSupplierType(e.target.value)} className={sel}>
                    <option value="">—</option>
                    {SUPPLIER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Merchandiser</label>
                  <input value={merchandiser} onChange={(e) => setMerchandiser(e.target.value)} className={inp} placeholder="opsional" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <label className={lbl}>Tanggal SPK</label>
                  <input type="date" value={spkDate} onChange={(e) => setSpkDate(e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Due Delivery</label>
                  <input type="date" value={dueDelivery} onChange={(e) => setDueDelivery(e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Total Qty Produksi</label>
                  <input type="number" value={totalQty} onChange={(e) => setTotalQty(e.target.value)} className={inp} placeholder="mis. 100" />
                </div>
              </div>

              <div className="rounded-xl border border-border bg-muted/40 p-2.5 text-sm">
                <span className="font-semibold text-muted-foreground">Kode SPK:</span> <b className="font-mono">{previewCode}</b>
              </div>

              {/* Foto produk untuk vendor */}
              <div>
                <label className={lbl}>Foto Produk</label>
                {imageUrl ? (
                  <div className="flex items-start gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrl} alt="foto produk" className="h-44 w-44 rounded-2xl border border-border object-cover" />
                    <Button type="button" variant="outline" size="sm" onClick={() => setImageUrl("")}>Hapus / Ganti</Button>
                  </div>
                ) : (
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-bold hover:bg-muted">
                    <ImagePlus className="h-4 w-4" /> {uploading ? "Mengunggah…" : "Upload Gambar"}
                    <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={uploading} />
                  </label>
                )}
              </div>

              {/* Size run: ratio -> qty auto */}
              <div className="rounded-xl border border-border p-3">
                <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                  Size &amp; Qty / Size Run (isi ratio, qty terhitung otomatis)
                </p>
                {!product ? (
                  <p className="py-3 text-center text-sm text-muted-foreground">Pilih produk dulu untuk melihat ukurannya.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-xs font-bold uppercase text-muted-foreground">
                      <th className="py-1.5">Ukuran</th><th className="py-1.5 text-right">Ratio</th><th className="py-1.5 text-right">Qty (auto)</th>
                    </tr></thead>
                    <tbody>
                      {computed.rows.map((r) => (
                        <tr key={r.v.id} className="border-t border-border/60 font-semibold">
                          <td className="py-1.5">{r.v.size ?? r.v.sku}</td>
                          <td className="py-1.5 text-right">
                            <input type="number" value={ratios[r.v.id] ?? ""} onChange={(e) => setRatios((p) => ({ ...p, [r.v.id]: e.target.value }))}
                              className="h-9 w-20 rounded-lg border border-border bg-background px-2 text-right text-sm font-semibold outline-none focus:border-primary/40" placeholder="0" />
                          </td>
                          <td className="py-1.5 text-right tabular-nums">{r.qty}</td>
                        </tr>
                      ))}
                      <tr className="border-t border-border bg-muted/40 font-extrabold">
                        <td className="py-1.5">Total</td>
                        <td className="py-1.5 text-right tabular-nums">{computed.sum}</td>
                        <td className="py-1.5 text-right tabular-nums">{computedTotal}</td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>

              {/* Size Specification (cm) — tabel ukuran jadi */}
              {product && (
                <div className="rounded-xl border border-border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Size Specification (cm)</p>
                    <Button type="button" size="sm" variant="outline" onClick={addSpecRow}><Plus className="h-4 w-4" /> Titik Ukur</Button>
                  </div>
                  {specs.length === 0 ? (
                    <p className="py-2 text-sm text-muted-foreground">Belum ada. Klik &quot;Titik Ukur&quot; untuk menambah baris pengukuran (mis. Lingkar Pinggang).</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="text-left text-xs font-bold uppercase text-muted-foreground">
                          <th className="py-1.5 pr-2">Pengukuran</th>
                          {specSizes.map((s) => <th key={s} className="py-1.5 px-1 text-center">{s}</th>)}
                          <th></th>
                        </tr></thead>
                        <tbody>
                          {specs.map((row, i) => (
                            <tr key={i} className="border-t border-border/60">
                              <td className="py-1 pr-2">
                                <input value={row.name} onChange={(e) => setSpecField(i, "name", e.target.value)}
                                  className="h-9 w-40 rounded-lg border border-border bg-background px-2 text-sm font-semibold outline-none focus:border-primary/40" placeholder="mis. Lingkar Pinggul" />
                              </td>
                              {specSizes.map((sz) => (
                                <td key={sz} className="py-1 px-1">
                                  <input type="number" value={row.values[sz] ?? ""} onChange={(e) => setSpecVal(i, sz, e.target.value)}
                                    className="h-9 w-14 rounded-lg border border-border bg-background px-1 text-center text-sm font-semibold outline-none focus:border-primary/40" placeholder="—" />
                                </td>
                              ))}
                              <td className="py-1 pl-1">
                                <button type="button" onClick={() => removeSpec(i)} className="text-muted-foreground hover:text-danger"><X className="h-4 w-4" /></button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Comment untuk Vendor — multi-baris */}
              <div>
                <label className={lbl}>Comment untuk Vendor</label>
                <textarea value={vendorComment} onChange={(e) => setVendorComment(e.target.value)} rows={4}
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-medium outline-none focus:border-primary/40"
                  placeholder="Catatan/instruksi untuk vendor (bisa beberapa baris)…" />
              </div>

              {/* Detail produksi — kolom khusus */}
              <div className="rounded-xl border border-border p-3 space-y-3">
                <p className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Detail Produksi</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className={lbl}>Button / Accessories</label>
                    <input value={buttonAccessories} onChange={(e) => setButtonAccessories(e.target.value)} className={inp} placeholder="mis. kancing kayu 15mm" />
                  </div>
                  <div>
                    <label className={lbl}>Care Label Material</label>
                    <input value={careLabel} onChange={(e) => setCareLabel(e.target.value)} className={inp} placeholder="mis. Cotton" />
                  </div>
                </div>
                <div>
                  <label className={lbl}>Catatan Lain</label>
                  <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inp} placeholder="catatan tambahan (opsional)" />
                </div>
              </div>

              {error && <p className="text-sm font-semibold text-danger">{error}</p>}

              <div className="flex justify-end gap-2.5 pt-1">
                <Button type="button" variant="ghost" size="sm" onClick={close}>Batal</Button>
                <Button type="submit" size="sm" disabled={pending}>{pending ? "Menyimpan…" : "Simpan SPK"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

const lbl = "mb-1.5 block text-sm font-bold";
const inp = "h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm font-medium outline-none focus:border-primary/40";
const sel = inp + " px-3";
