/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Font Urbanist dimuat via <link> di layout. Matikan auto-optimizer agar build
  // tidak bergantung pada fetch ke fonts.googleapis.com saat build (robust di CI/sandbox).
  optimizeFonts: false,
  // Supabase Storage domain untuk <Image>; sesuaikan dengan project ref Anda.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  // Cache navigasi sisi-klien (Router Cache). Halaman yang baru dibuka disimpan
  // sebentar di browser → pindah/balik antar-tab jadi instan tanpa nembak server.
  // dynamic: halaman dinamis (ada auth/DB) di-cache 30 dtk; static: 3 menit.
  // Mutasi (server action + revalidatePath) tetap membatalkan cache, jadi data baru langsung tampil.
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

export default nextConfig;
