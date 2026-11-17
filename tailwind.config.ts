import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        page: "#0A0A0B",
        fg: "#F4F4F5",
        muted: "#A1A1AA",
        card: "#131316",
        chip: "#18181B",
        line: "#27272A",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-archivo)", "Impact", "sans-serif"],
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(90deg, #14B8A6 0%, #2563EB 100%)",
      },
      boxShadow: {
        glow: "0 12px 40px -12px rgba(20, 184, 166, 0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
