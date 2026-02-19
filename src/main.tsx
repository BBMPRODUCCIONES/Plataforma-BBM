import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Auto-recovery: detect stale SW cache serving incompatible JS/CSS
let isRecovering = false;
const recoverFromStaleCache = () => {
  if (isRecovering) return;
  isRecovering = true;
  console.warn('[PWA] Detected stale cache — clearing and reloading…');
  if ('caches' in window) {
    caches.keys()
      .then((names: string[]) => Promise.all(names.map((n: string) => caches.delete(n))))
      .then(() => { window.location.reload(); })
      .catch(() => { window.location.reload(); });
  } else {
    location.reload();
  }
};

window.addEventListener('error', (e) => {
  if (
    e.message?.includes('Failed to fetch dynamically imported module') ||
    e.message?.includes('ChunkLoadError') ||
    e.message?.includes('Loading chunk') ||
    e.message?.includes('Loading CSS chunk')
  ) {
    recoverFromStaleCache();
  }
});

window.addEventListener('unhandledrejection', (e) => {
  const msg = e.reason?.message || String(e.reason);
  if (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('ChunkLoadError')
  ) {
    recoverFromStaleCache();
  }
});

// Register service worker - user controls when to update (no automatic refresh)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      // Check for updates every 30 minutes (less aggressive)
      setInterval(() => registration.update(), 30 * 60 * 1000);
      
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Just log - user will be notified via PWAUpdateBanner
              console.log('[PWA] Nueva versión disponible - el usuario puede actualizar cuando desee');
            }
          });
        }
      });
    }).catch(() => {
      // Service worker registration failed silently
    });
    // NO controllerchange listener - prevents forced page reloads
  });
}

createRoot(document.getElementById("root")!).render(<App />);
