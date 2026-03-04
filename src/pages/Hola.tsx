import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { MobileHeader } from "@/components/MobileHeader";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Hola() {
  const isMobile = useIsMobile();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        {!isMobile && <AppSidebar />}
        <div className="flex-1 flex flex-col">
          {isMobile ? (
            <MobileHeader />
          ) : (
            <header className="h-12 flex items-center border-b border-border px-4">
              <SidebarTrigger />
              <h1 className="ml-4 text-lg font-semibold text-foreground">Hola</h1>
            </header>
          )}
          <main className="flex-1 p-6">
            {/* Panel vacío */}
          </main>
          {isMobile && <MobileBottomNav />}
        </div>
      </div>
    </SidebarProvider>
  );
}
