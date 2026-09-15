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
      // autoUpdate: el service worker nuevo toma el control de inmediato.
      // Con "prompt" + skipWaiting:false el worker viejo se quedaba mandando y
      // seguia sirviendo un index.html que apuntaba a archivos ya borrados del
      // servidor, y el celular respondia ERR_FAILED en vez de abrir la app.
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
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // Sin navigateFallback a proposito.
        //
        // Con el fallback, el service worker respondia toda navegacion con el
        // index.html que tenia guardado. Tras cada despliegue ese index apuntaba
        // a archivos con hash que Cloudflare ya no sirve, y el resultado era
        // ERR_FAILED: la app dejaba de abrir hasta limpiar el navegador a mano.
        //
        // El planner no sirve sin conexion de todos modos: todo sale de Supabase.
        // Asi que las navegaciones van siempre a la red y el problema desaparece
        // de raiz, no se mitiga. Cloudflare Pages ya devuelve index.html para
        // cualquier ruta desconocida, asi que el enrutado sigue funcionando.
        navigateFallback: null,
        navigateFallbackDenylist: [/^\/api/, /^\/auth/, /supabase/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60
              },
              cacheableResponse: {
                statuses: [0, 200]
              },
              networkTimeoutSeconds: 5
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
