import { useLocation } from "react-router-dom";
import { Briefcase, Grid3X3, Wrench, Users, Calendar, Settings, Bot, Building2, UserPlus } from "lucide-react";

// Map routes to titles and icons
const routeConfig: Record<string, { title: string; icon: React.ComponentType<{ className?: string }> }> = {
  "/panel-directivo": { title: "Panel Directivo", icon: Briefcase },
  "/panel-general": { title: "Panel General", icon: Grid3X3 },
  "/panel-operaciones": { title: "Operaciones", icon: Wrench },
  "/proveedores": { title: "Proveedores", icon: Users },
  "/historial-cotizaciones": { title: "Historial", icon: Users },
  "/calendar": { title: "Calendario", icon: Calendar },
  "/usuarios": { title: "Usuarios", icon: UserPlus },
  "/clientes": { title: "Clientes", icon: Building2 },
  "/empleados": { title: "Empleados", icon: Users },
  "/constructor": { title: "Constructor", icon: Settings },
  "/agentes-ia": { title: "Agentes IA", icon: Bot },
};

export function MobileHeader() {
  const location = useLocation();
  const currentPath = location.pathname;
  
  const config = routeConfig[currentPath] || { title: "BBM", icon: Briefcase };
  const Icon = config.icon;

  return (
    <header className="mobile-app-header h-14 border-b border-border flex items-center px-4 bg-card/95 backdrop-blur-lg shrink-0 z-40 supports-[backdrop-filter]:bg-card/80">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="font-semibold text-sm text-foreground truncate">{config.title}</span>
          <span className="text-[10px] text-muted-foreground">BBM Producciones</span>
        </div>
      </div>
    </header>
  );
}