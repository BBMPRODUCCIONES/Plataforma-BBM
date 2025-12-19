import { ReactNode, useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Toaster } from "@/components/ui/toaster";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  useEffect(() => {
    // Set dark mode by default
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 flex flex-col h-screen overflow-hidden relative z-0 min-w-0">
          <header className="h-14 border-b border-border flex items-center px-4 bg-card/50 backdrop-blur-sm shrink-0 z-40">
            <SidebarTrigger className="mr-4 touch-manipulation" />
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-xs text-muted-foreground truncate">PRODUCCIÓN DE EVENTOS</span>
            </div>
          </header>
          <div className="flex-1 p-4 md:p-6 overflow-x-auto overflow-y-auto min-w-0">
            {children}
          </div>
        </main>
      </div>
      <Toaster />
    </SidebarProvider>
  );
};

export default Layout;
