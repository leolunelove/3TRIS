import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: process.env.GITHUB_PAGES_BASE || "/3TRIS/",
  resolve: { tsconfigPaths: true },
  plugins: [tailwindcss(), react()],
  build: { outDir: "dist-pages" },
});
