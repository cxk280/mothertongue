import type { Config } from "tailwindcss";

// Colors are the exact tokens from the approved Figma mocks (MT Tokens collection).
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        mt: {
          base: "#0A0E14",
          surface: "#131A24",
          elevated: "#1C2632",
          input: "#222E3B",
          subtle: "#27323F",
          strong: "#3A4753",
          primary: "#E9EEF3",
          secondary: "#94A2B1",
          muted: "#64727F",
          green: "#2AE5A0",
          greenDeep: "#12B583",
          greenDim: "#0F3A30",
          greenBrd: "#1E6E54",
          amber: "#F5A524",
          red: "#FF6B6B",
          redDim: "#3A1D22",
          redBrd: "#7A3A3E",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      keyframes: {
        "wave-pulse": {
          "0%, 100%": { transform: "scaleY(0.4)" },
          "50%": { transform: "scaleY(1)" },
        },
        "soft-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
      },
      animation: {
        "soft-pulse": "soft-pulse 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
