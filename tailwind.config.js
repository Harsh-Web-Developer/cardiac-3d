/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: "#f8fafc",
        "surface-low": "#f1f5f9",
        "surface-card": "#ffffff",
        "surface-border": "#e2e8f0",
        "surface-bright": "#f8fafc",
        "clinical-cyan": "#0284c7",
        "clinical-teal": "#006194",
        "clinical-emerald": "#059669",
        "clinical-amber": "#d97706",
        "clinical-rose": "#dc2626",
        "text-primary": "#0f172a",
        "text-muted": "#334155",
        "text-dim": "#64748b"
      },
      fontFamily: {
        mono: ["JetBrains Mono", "monospace"],
        sans: ["Inter", "Space Grotesk", "sans-serif"]
      }
    },
  },
  plugins: [],
}
