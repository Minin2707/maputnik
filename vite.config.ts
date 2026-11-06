import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import istanbul from "vite-plugin-istanbul";

export default defineConfig(({ mode, command }) => ({
  server: {
    port: 8888,
  },
  build: {
    sourcemap: false,
    license: { fileName: "THIRD_PARTY_LICENSES.md" },
    rolldownOptions: {
      checks: { invalidAnnotation: false },
    },
  },
  plugins: [
    react(),
    command === "serve" && istanbul({
      requireEnv: false,
      nycrcPath: "./.nycrc.json",
    }),
  ],
  optimizeDeps: {
    exclude: ["maplibre-gl/dist/maplibre-gl-worker.mjs"],
  },
  base: mode === "desktop" ? "/" : "/maputnik/",
  define: {
    global: "globalThis"
  },
}));
