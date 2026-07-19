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
};

export default nextConfig;
