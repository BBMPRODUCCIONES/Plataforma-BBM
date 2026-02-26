import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, X } from "lucide-react";

export function PWAUpdateBanner() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    // Don't show banner in development mode - service worker updates constantly
    if (import.meta.env.DEV) return;
    if (!('serviceWorker' in navigator)) return;

    const handleUpdate = (registration: ServiceWorkerRegistration) => {
      const newWorker = registration.installing || registration.waiting;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setWaitingWorker(newWorker);
            setShowUpdate(true);
          }
        });
      }
    };

    // Check for waiting service worker on load
    navigator.serviceWorker.ready.then((registration) => {
      if (registration.waiting) {
        setWaitingWorker(registration.waiting);
        setShowUpdate(true);
      }
      
      registration.addEventListener('updatefound', () => handleUpdate(registration));
    });

    // Also check current registration
    navigator.serviceWorker.getRegistration().then((registration) => {
      if (registration?.waiting) {
        setWaitingWorker(registration.waiting);
        setShowUpdate(true);
      }
    });
  }, []);

  const handleUpdate = useCallback(() => {
    // Immediately hide the banner to prevent multiple clicks
    setShowUpdate(false);

    const forceReload = () => {
      if ('caches' in window) {
        caches.keys()
          .then((names: string[]) => Promise.all(names.map((n: string) => caches.delete(n))))
          .finally(() => { window.location.reload(); });
      } else {
        window.location.reload();
      }
    };

    if (waitingWorker) {
      // Listen for the new service worker to take control
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      }, { once: true });

      waitingWorker.postMessage({ type: 'SKIP_WAITING' });

      // Fallback: force reload after 1s if controllerchange doesn't fire
      setTimeout(forceReload, 1000);
    } else {
      // No waiting worker — unregister, clear caches, and reload
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg) {
          reg.unregister().then(forceReload).catch(forceReload);
        } else {
          forceReload();
        }
      }).catch(forceReload);
    }
  }, [waitingWorker]);

  const handleDismiss = useCallback(() => {
    setShowUpdate(false);
  }, []);

  if (!showUpdate) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 right-4 z-50 flex items-center gap-3 p-3 bg-primary text-primary-foreground rounded-lg shadow-lg animate-in slide-in-from-bottom-4">
      <RefreshCw className="h-4 w-4" />
      <span className="text-sm font-medium">Nueva versión disponible</span>
      <Button 
        size="sm" 
        variant="secondary" 
        onClick={handleUpdate}
        className="h-7 text-xs"
      >
        Actualizar
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={handleDismiss}
        className="h-7 w-7 p-0 hover:bg-primary-foreground/10"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
