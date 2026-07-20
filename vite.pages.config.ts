import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/today-s_outfit/",
  plugins: [react()],
  publicDir: "public",
  build: {
    outDir: "dist-pages",
    emptyOutDir: true,
    rollupOptions: { input: "pages-index.html" },
  },
});
