import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * The server pins hashed filenames forever and revalidates everything else
 * (dashboard-server/static.ts `HASHED`: `-[8+ chars].ext`). The output names
 * below are spelled out rather than left to Vite's default, because a default
 * that drifts would silently turn immutable caching into stale caching.
 */
export default defineConfig({
  plugins: [react()],
  build: {
    // P-UI-1: the matrix chunk is split out of the initial bundle (React.lazy
    // in App.tsx), so the first paint downloads only NowStrip + StageRail.
    target: "es2022",
    sourcemap: false,
    rollupOptions: {
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
