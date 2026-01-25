import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "esnext", // specialized for WASM support
  },
  esbuild: {
    target: "esnext",
  },
  optimizeDeps: {
    exclude: ["@dimforge/rapier2d-compat"], // Solve potential WASM loading issues in dev
  },
});
