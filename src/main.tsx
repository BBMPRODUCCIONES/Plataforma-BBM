import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

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
