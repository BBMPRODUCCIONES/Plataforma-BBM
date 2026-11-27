import { ReactNode, useEffect } from "react";
import { Link } from "react-router-dom";
import { Clock } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Toaster } from "@/components/ui/toaster";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { MobileHeader } from "@/components/MobileHeader";
import { NotificationPrompt } from "@/components/NotificationPrompt";
import { AvisoFacturasPendientes } from "@/components/AvisoFacturasPendientes";
import { AvisoCostosPendientes } from "@/components/AvisoCostosPendientes";
import { AvisoCostosCerrados } from "@/components/AvisoCostosCerrados";
import { MisTareas } from "@/components/MisTareas";
import { AvisoPendientesAlEntrar } from "@/components/MisPendientesDirectivo";
import { useIsMobile } from "@/hooks/use-mobile";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const isMobile = useIsMobile();

  useEffect(() => {
    // Tema claro (pastel)
    document.documentElement.classList.remove("dark");
  }, []);

  // Mobile layout: Header + Content + Bottom Nav (no sidebar)
  if (isMobile) {
    return (
      <div className="app-root flex flex-col w-full bg-background">
        <MobileHeader />
        <div className="content-scroll-area flex-1 overflow-y-auto overflow-x-hidden min-w-0 pb-16">
          <div className="pb-safe">
            {children}
          </div>
        </div>
        <MobileBottomNav />
        <NotificationPrompt />
        <AvisoPendientesAlEntrar />
        <Toaster />
      </div>
    );
  }

  // Desktop layout: Sidebar + Header + Content (unchanged)
  return (
    <SidebarProvider>
      <div className="app-root flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 flex flex-col h-[100dvh] overflow-hidden relative z-0 min-w-0">
          {/* Fixed header with blur */}
          <header className="app-header h-14 border-b border-border flex items-center justify-between px-4 bg-card/90 backdrop-blur-lg shrink-0 z-40 supports-[backdrop-filter]:bg-card/70">
            <div className="flex items-center">
              <SidebarTrigger className="mr-4 touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center" />
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-xs text-muted-foreground truncate">PRODUCCIÓN DE EVENTOS</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Acceso directo a marcar llegada y salida */}
              <Link
                to="/asistencia"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
              >
                <Clock className="h-3.5 w-3.5" />
                Marcar llegada / salida
              </Link>
              <MisTareas />
              <AvisoCostosCerrados />
              <AvisoCostosPendientes />
              <AvisoFacturasPendientes />
            </div>
          </header>
          {/* Content area with controlled internal scroll */}
          <div className="content-scroll-area flex-1 overflow-y-auto overflow-x-hidden min-w-0">
            <div className="p-4 md:p-6">
              {children}
            </div>
          </div>
        </main>
      </div>
      <NotificationPrompt />
      <AvisoPendientesAlEntrar />
      <Toaster />
    </SidebarProvider>
  );
};

export default Layout;
