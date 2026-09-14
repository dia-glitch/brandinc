import { applyOverrides, type AccessOverride } from "@/lib/permissions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = { from: (table: string) => any };

// Cache proses (per instance runtime). Matriks bersifat GLOBAL (sama utk semua
// user), jadi aman disimpan di module-scope. TTL kecil supaya perubahan admin
// menyebar ke semua instance dalam <= TTL detik.
let lastLoad = 0;
let inflight: Promise<void> | null = null;
const TTL_MS = 30_000;

/**
 * Muat override matriks dari tabel role_page_access & terapkan ke permissions.
 * TTL-guarded: hanya menembak DB sekali per TTL. Aman di Edge (middleware) &
 * Node (server). Tabel belum ada / error -> diam-diam pakai default (tanpa regresi).
 */
export async function hydrateMatrix(sb: SupabaseLike): Promise<void> {
  if (Date.now() - lastLoad < TTL_MS) return;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const { data } = await sb.from("role_page_access").select("role,page_key,level");
      applyOverrides((data ?? []) as AccessOverride[]);
    } catch {
      // tabel belum dibuat / error transient -> tetap pakai default bawaan
    } finally {
      lastLoad = Date.now(); // set walau error, supaya tidak hammer DB tiap request
      inflight = null;
    }
  })();
  return inflight;
}

/** Paksa reload pada request berikutnya (dipanggil setelah admin menyimpan matriks). */
export function invalidateMatrix(): void {
  lastLoad = 0;
}
