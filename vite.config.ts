import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "pwa-icon-192.png", "pwa-icon-512.png"],
      workbox: {
        navigateFallbackDenylist: [/^\/~oauth/],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        // Reloads open windows when a new version activates (see public/sw-update.js)
        importScripts: ["sw-update.js"],
      },
      manifest: {
        name: "Bunnies FC",
        short_name: "Bunnies",
        description: "Bunnies FC 공식 풋살 앱",
        theme_color: "#08080d",
        background_color: "#08080d",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          {
            src: "/pwa-icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/pwa-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ].filter(Boolean),
  build: {
    target: "es2020",
    rollupOptions: {
      output: {
        // Stable vendor chunks: app deploys don't invalidate the (large, rarely changing) libraries.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          // Leaf libraries only depend on the shared vendor chunk, never the other way round,
          // so there is no circular chunk import (which breaks React's init order).
          if (/[\\/]three[\\/]/.test(id)) return "three";
          if (/[\\/](recharts|d3-[a-z-]+|victory-vendor)[\\/]/.test(id)) return "charts";
          if (/[\\/]@supabase[\\/]/.test(id)) return "supabase";
          if (/html2canvas/.test(id)) return; // loaded on demand
          return "vendor";
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
