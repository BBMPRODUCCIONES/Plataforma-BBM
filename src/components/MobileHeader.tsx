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
  MoreVertical,
  Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
    <header className="mobile-app-header h-12 border-b border-border/50 flex items-center justify-between px-3 bg-card/98 backdrop-blur-xl shrink-0 z-40 supports-[backdrop-filter]:bg-card/90">
      {/* Left side: Back or Icon + Title */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {canGoBack ? (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-9 w-9 shrink-0 -ml-1 touch-manipulation"
            onClick={handleBack}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        ) : (
          <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="w-3.5 h-3.5 text-primary" />
          </div>
        )}
        <span className="font-semibold text-sm text-foreground truncate">
          {config.title}
        </span>
      </div>

      {/* Right side: Primary action + More */}
      <div className="flex items-center gap-1 shrink-0">
        {config.primaryAction && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-3 text-xs font-medium text-primary touch-manipulation gap-1.5"
          >
            {(() => {
              const ActionIcon = config.primaryAction!.icon;
              return <ActionIcon className="h-4 w-4" />;
            })()}
            <span className="hidden xs:inline">{config.primaryAction.label}</span>
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 touch-manipulation">
              <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem className="touch-manipulation min-h-[44px]">
              Refrescar datos
            </DropdownMenuItem>
            <DropdownMenuItem className="touch-manipulation min-h-[44px]">
              Ajustes
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
