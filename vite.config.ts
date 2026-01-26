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
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.png", "robots.txt", "pwa-192x192.png", "pwa-512x512.png", "pwa-192x192-demo.png", "pwa-512x512-demo.png", "manifest-demo.json"],
      manifest: {
        name: "BBM Producciones",
        short_name: "BBM",
        description: "Plataforma de gestión integral de eventos",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // Force immediate activation of new service worker
        skipWaiting: true,
        clientsClaim: true,
        // Clean old caches
        cleanupOutdatedCaches: true,
        // Disable precaching for faster updates
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 // 1 hour instead of 24
              },
              cacheableResponse: {
                statuses: [0, 200]
              },
              networkTimeoutSeconds: 5 // Faster fallback
            }
          },
          {
            // Cache static assets but revalidate frequently
            urlPattern: /\.(js|css|png|jpg|jpeg|svg|gif|woff2?)$/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "static-assets",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 2 // 2 hours
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: true
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
