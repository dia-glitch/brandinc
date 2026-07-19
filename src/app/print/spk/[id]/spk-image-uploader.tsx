"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { setSpkImage } from "@/app/(dashboard)/production/spk/actions";

export function SpkImageUploader({ spkId, hasImage }: { spkId: string; hasImage: boolean }) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setErr(null);
    try {
      const supabase = createClient();
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: up } = await supabase.storage.from("spk-images").upload(path, file);
      if (up) { setErr("Gagal upload: " + up.message); setUploading(false); return; }
      const { data } = supabase.storage.from("spk-images").getPublicUrl(path);
      await setSpkImage(spkId, data.publicUrl);
      router.refresh();
    } catch {
      setErr("Gagal upload. Pastikan bucket 'spk-images' sudah dibuat.");
    }
    setUploading(false);
  }

  return (
    <div className="print:hidden">
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-bold hover:bg-muted">
        <ImagePlus className="h-4 w-4" /> {uploading ? "Mengunggah…" : hasImage ? "Ganti Foto" : "Upload Foto Produk"}
        <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={uploading} />
      </label>
      {err && <span className="ml-2 text-xs font-semibold text-danger">{err}</span>}
    </div>
  );
}
