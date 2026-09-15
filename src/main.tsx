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

// Service worker: se actualiza solo y sin preguntar.
//
// Ya no hay aviso de "nueva version". Antes lo habia, y era peor el remedio
// que la enfermedad: al pulsarlo se recargaba sobre un index.html guardado que
// apuntaba a archivos ya borrados del servidor, y la app quedaba en ERR_FAILED.
// Ahora las navegaciones van siempre a la red, el worker nuevo toma el control
// de inmediato y el usuario ve la version nueva en la siguiente carga.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      // Buscar version nueva cada 30 minutos.
      setInterval(() => registration.update(), 30 * 60 * 1000);
    }).catch(() => {
      // Si falla el registro, la app funciona igual: solo se pierde el cache.
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
