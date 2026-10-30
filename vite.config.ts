import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: [
        "aarogya-logo-transparent.png",
        "favicon-transparent-32.png",
        "apple-touch-icon-transparent.png",
        "app-icon-transparent-192.png",
        "app-icon-transparent-512.png",
      ],
      manifest: {
        name: "Aarogya Drishti",
        short_name: "Aarogya",
        description:
          "Community oral screening and teleconsultation clinical decision support system",
        theme_color: "#123f39",
        background_color: "#f5f7f5",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/app-icon-transparent-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/app-icon-transparent-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,mp3,wav}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api(?:\/|$)/],
        runtimeCaching: [],
      },
    }),
  ],
  server: {
    host: "127.0.0.1",
    port: 5174,
    strictPort: true,
    proxy: { "/api": "http://127.0.0.1:8787" },
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
    proxy: { "/api": "http://127.0.0.1:8787" },
  },
});
