import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register service worker with immediate update handling for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      // Check for updates immediately
      registration.update();
      
      // Listen for new service worker
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New content available, force refresh
              console.log('[PWA] New content available, refreshing...');
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        }
      });
    }).catch((error) => {
      console.log('[PWA] Service worker registration failed:', error);
    });
    
    // Refresh when new service worker takes control
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
