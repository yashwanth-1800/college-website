import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Relative assets work on both a Vercel root domain and GitHub Pages subpaths.
  base: "./",
  plugins: [react()],
  build: {
    rollupOptions: {
      external: (id) => id.startsWith("https://www.gstatic.com/"),
    },
  },
});
