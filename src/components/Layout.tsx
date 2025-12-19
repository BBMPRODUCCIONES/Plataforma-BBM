import { ReactNode, useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Toaster } from "@/components/ui/toaster";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { MobileHeader } from "@/components/MobileHeader";
import { useIsMobile } from "@/hooks/use-mobile";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const isMobile = useIsMobile();

  useEffect(() => {
    // Set dark mode by default
    document.documentElement.classList.add("dark");
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
          <header className="app-header h-14 border-b border-border flex items-center px-4 bg-card/90 backdrop-blur-lg shrink-0 z-40 supports-[backdrop-filter]:bg-card/70">
            <SidebarTrigger className="mr-4 touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center" />
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-xs text-muted-foreground truncate">PRODUCCIÓN DE EVENTOS</span>
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
      <Toaster />
    </SidebarProvider>
  );
};

export default Layout;
