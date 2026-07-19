import type { Config } from "tailwindcss";

/**
 * Design tokens ERP Fashion — tema "Minimalist" (referensi klien).
 * Palet: Alice Blue, Honeydew, Vanila, Eerie Black, Ghost White. Font: Urbanist.
 * Warna diekspos sebagai CSS variable (lihat globals.css) agar dark mode mudah.
 */
const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // brand palette (nilai mentah)
        alice: "#D8DFE9",
        honeydew: "#CFDECA",
        vanila: "#EFF0A3",
        eerie: "#212121",
        ghost: "#F6F5FA",
        // token semantik (via CSS var, ganti otomatis di dark mode)
        background: "hsl(var(--background))",
        surface: "hsl(var(--surface))",
        foreground: "hsl(var(--foreground))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        border: "hsl(var(--border))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        accent: "hsl(var(--accent))",
        "accent-foreground": "hsl(var(--accent-foreground))",
        success: "#2f8f4e",
        danger: "#c0563f",
      },
      fontFamily: {
        sans: ["var(--font-urbanist)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "16px",
        "2xl": "22px",
        "3xl": "28px",
      },
      boxShadow: {
        soft: "0 20px 50px rgba(33,33,33,0.08)",
        card: "0 8px 24px rgba(33,33,33,0.05)",
      },
    },
  },
  plugins: [],
};

export default config;
