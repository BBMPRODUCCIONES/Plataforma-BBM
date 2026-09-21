import { useLocation, useNavigate } from "react-router-dom";
import { 
  Briefcase, 
  Grid3X3, 
  Wrench, 
  Users, 
  Calendar, 
  Settings, 
  Bot, 
  Building2, 
  UserPlus,
  ChevronLeft,
  Plus,
  FileBarChart,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// Route config type
interface RouteConfigItem {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  showBack?: boolean;
  primaryAction?: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    action?: string;
  };
}

// Map routes to titles, icons, and primary actions
const routeConfig: Record<string, RouteConfigItem> = {
  "/": { title: "Dashboard", icon: Grid3X3 },
  "/panel-directivo": { title: "Directivo", icon: Briefcase },
  "/panel-general": { title: "General", icon: Grid3X3 },
  "/panel-operaciones": { title: "Operaciones", icon: Wrench },
  "/proveedores": { title: "Proveedores", icon: Users, primaryAction: { icon: Plus, label: "Nuevo" } },
  "/historial-cotizaciones": { title: "Historial", icon: Users, showBack: true },
  "/calendar": { title: "Calendario", icon: Calendar },
  "/panel-reportes": { title: "Reportes", icon: FileBarChart },
  "/panel-ventas": { title: "Ventas", icon: TrendingUp },
  "/usuarios": { title: "Usuarios", icon: UserPlus, primaryAction: { icon: Plus, label: "Invitar" } },
  "/clientes": { title: "Clientes", icon: Building2, primaryAction: { icon: Plus, label: "Nuevo" } },
  "/empleados": { title: "Empleados", icon: Users, primaryAction: { icon: Plus, label: "Nuevo" } },
  "/constructor": { title: "Constructor", icon: Settings },
  "/agentes-ia": { title: "Agentes IA", icon: Bot },
};

// Routes that can navigate back
const backRoutes: Record<string, string> = {
  "/historial-cotizaciones": "/proveedores",
};

export function MobileHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  
  const defaultConfig: RouteConfigItem = { title: "BBM", icon: Briefcase };
  const config: RouteConfigItem = routeConfig[currentPath] ?? defaultConfig;
  const Icon = config.icon;
  const canGoBack = config.showBack === true || Boolean(backRoutes[currentPath]);

  const handleBack = () => {
    const backRoute = backRoutes[currentPath];
    if (backRoute) {
      navigate(backRoute);
    } else {
      navigate(-1);
    }
  };

  return (
    <header className="mobile-app-header h-10 border-b border-border/40 flex items-center justify-between px-3 bg-card/98 backdrop-blur-xl shrink-0 z-40 supports-[backdrop-filter]:bg-card/90">
      {/* Left side: Back or Icon + Title */}
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        {canGoBack ? (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 shrink-0 -ml-1 touch-manipulation"
            onClick={handleBack}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        ) : (
          <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="w-3 h-3 text-primary" />
          </div>
        )}
        <span className="font-semibold text-xs text-foreground truncate">
          {config.title}
        </span>
      </div>

      {/* La campana de notificaciones se quito por pedido: el contador vivia
          en 50 y ya nadie lo miraba. El aviso sigue llegando al celular por
          notificacion del sistema; lo que desaparece es este boton. */}
    </header>
  );
}
