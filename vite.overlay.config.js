import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  plugins: [tailwindcss()],
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    outDir: "dist",
    emptyOutDir: false,
    minify: true,
    lib: {
      entry: "src/main.jsx",
      name: "SideflowOverlay",
      formats: ["iife"],
      fileName: () => "overlay.js",
      cssFileName: "overlay",
    },
  },
});
