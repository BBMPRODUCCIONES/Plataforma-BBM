import { useLocation, useNavigate } from "react-router-dom";
import { Briefcase, Grid3X3, Wrench, Users, MoreHorizontal, X, Calendar, Settings, LogOut, FileBarChart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

// Main nav items for bottom bar (max 4 + more)
const mainNavItems = [
  { title: "Directivo", url: "/panel-directivo", icon: Briefcase, panel: "directivo" },
  { title: "General", url: "/panel-general", icon: Grid3X3, panel: "general" },
  { title: "Operaciones", url: "/panel-operaciones", icon: Wrench, panel: "operaciones" },
  
  { title: "Proveedores", url: "/proveedores", icon: Users, panel: "proveedores" },
];

// Items in "More" menu
const moreNavItems = [
  { title: "Google Calendar", url: "/calendar", icon: Calendar, panel: "calendar" },
  { title: "Reportes", url: "/panel-reportes", icon: FileBarChart, panel: "reportes", adminOnly: true },
  { title: "Usuarios", url: "/usuarios", icon: Users, panel: "usuarios", adminOnly: true },
  { title: "Clientes", url: "/clientes", icon: Users, panel: "clientes", adminOnly: true },
  { title: "Empleados", url: "/empleados", icon: Users, panel: "empleados", adminOnly: true },
  { title: "Constructor", url: "/constructor", icon: Settings, panel: "constructor", adminOnly: true },
];

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { canAccessPanel, canEditStructure, role } = useUserRole();
  const { signOut } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  const currentPath = location.pathname;

  const handleNavigation = (url: string) => {
    navigate(url);
    setMoreOpen(false);
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/");
    setMoreOpen(false);
  };

  // Filter items based on access
  const visibleMainItems = mainNavItems.filter(item => canAccessPanel(item.panel));
  const visibleMoreItems = moreNavItems.filter(item => {
    if (item.adminOnly && !canEditStructure()) return false;
    return canAccessPanel(item.panel);
  });

  // Check if current route is in "more" section
  const isMoreActive = moreNavItems.some(item => currentPath === item.url);

  return (
    <nav className="mobile-bottom-nav fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border">
      <div className="mobile-bottom-nav-inner flex items-center justify-around px-2">
        {visibleMainItems.slice(0, 4).map((item) => {
          const isActive = currentPath === item.url;
          return (
            <button
              key={item.url}
              onClick={() => handleNavigation(item.url)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 min-w-[56px] h-12 px-2 rounded-md transition-all duration-200 touch-manipulation",
                isActive 
                  ? "text-primary bg-primary/10" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <item.icon className={cn("h-5 w-5 transition-transform", isActive && "scale-110")} />
              <span className={cn(
                "text-[10px] font-medium leading-tight",
                isActive ? "text-primary" : "text-muted-foreground"
              )}>
                {item.title}
              </span>
            </button>
          );
        })}

        {/* More button with sheet */}
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <button
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 min-w-[56px] h-12 px-2 rounded-md transition-all duration-200 touch-manipulation",
                isMoreActive 
                  ? "text-primary bg-primary/10" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <MoreHorizontal className={cn("h-5 w-5 transition-transform", isMoreActive && "scale-110")} />
              <span className={cn(
                "text-[10px] font-medium leading-tight",
                isMoreActive ? "text-primary" : "text-muted-foreground"
              )}>
                Más
              </span>
            </button>
          </SheetTrigger>
          
          <SheetContent 
            side="bottom" 
            className="h-auto max-h-[80vh] overflow-y-auto overscroll-contain rounded-t-2xl pb-safe"
          >
            <SheetHeader className="pb-4">
              <SheetTitle className="text-left flex items-center justify-between">
                <span>Menú</span>
                <div className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-xs font-medium text-primary">
                      {role?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="capitalize">{role}</span>
                </div>
              </SheetTitle>
            </SheetHeader>

            <div className="grid grid-cols-3 gap-3 pb-4">
              {visibleMoreItems.map((item) => {
                const isActive = currentPath === item.url;
                return (
                  <button
                    key={item.url}
                    onClick={() => handleNavigation(item.url)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 p-4 rounded-xl transition-all duration-200 touch-manipulation min-h-[80px]",
                      isActive 
                        ? "bg-primary/10 text-primary ring-2 ring-primary/20" 
                        : "bg-muted/50 text-foreground hover:bg-muted"
                    )}
                  >
                    <item.icon className="h-6 w-6" />
                    <span className="text-xs font-medium text-center leading-tight">{item.title}</span>
                  </button>
                );
              })}
            </div>

            {/* Logout button */}
            <div className="pt-4 border-t border-border">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 w-full p-4 rounded-xl text-destructive hover:bg-destructive/10 transition-colors touch-manipulation"
              >
                <LogOut className="h-5 w-5" />
                <span className="font-medium">Cerrar sesión</span>
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}