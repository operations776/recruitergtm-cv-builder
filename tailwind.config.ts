import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          purple: "#7C3AED",
          dark: "#5B21B6",
          tint: "#F5F3FF",
          ink: "#1A1A1A",
          slate: "#4B5563",
          muted: "#9CA3AF",
          line: "#E5E7EB",
        },
      },
      fontFamily: {
        sans: ["Helvetica Neue", "Helvetica", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
