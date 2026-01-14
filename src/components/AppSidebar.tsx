import {
  Grid3X3,
  Wrench,
  Users,
  Settings,
  Bot,
  Calendar,
  ChevronRight,
  UserPlus,
  Building2,
  LogOut,
  Loader2,
  FileBarChart,
  Briefcase,
} from "lucide-react";
import bbmLogoSidebar from "@/assets/bbm-logo-sidebar.png";
import { useNavigate } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";

const mainNavItems = [
  { title: "Panel Directivo", url: "/panel-directivo", icon: Briefcase, panel: "directivo" },
  { title: "Panel General", url: "/panel-general", icon: Grid3X3, panel: "general" },
  { title: "Panel Operaciones", url: "/panel-operaciones", icon: Wrench, panel: "operaciones" },
  { title: "Panel de Reportes", url: "/panel-reportes", icon: FileBarChart, panel: "reportes", adminOnly: true },
  { title: "Proveedores", url: "/proveedores", icon: Users, panel: "proveedores" },
];

const adminNavItems = [
  { title: "Gestión de Usuarios", url: "/usuarios", icon: UserPlus, panel: "usuarios" },
  { title: "Gestión de Clientes", url: "/clientes", icon: Building2, panel: "clientes" },
  { title: "Creación de Empleados", url: "/empleados", icon: Users, panel: "empleados" },
  { title: "Constructor de Campos", url: "/constructor", icon: Settings, panel: "constructor" },
  { title: "Agentes IA", url: "/agentes-ia", icon: Bot, panel: "agentes" },
];

function SidebarSkeleton() {
  return (
    <div className="space-y-2 px-3">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-3/4" />
    </div>
  );
}

export function AppSidebar() {
  const { canAccessPanel, canEditStructure, role, roleLoading } = useUserRole();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center bg-black">
            <img 
              src={bbmLogoSidebar} 
              alt="BBM Producciones" 
              className="w-full h-full object-contain p-1"
            />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sidebar-foreground text-sm">BBM</span>
            <span className="text-xs text-muted-foreground">Producciones</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {/* Show skeleton while role is loading */}
        {roleLoading ? (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-2">
              Cargando...
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarSkeleton />
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          <>
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-2">
                Paneles
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {mainNavItems.map((item) => {
                    // Check admin-only items first
                    if (item.adminOnly && !canEditStructure()) return null;
                    
                    const hasAccess = canAccessPanel(item.panel);
                    // Don't render items user doesn't have access to
                    if (!hasAccess) return null;
                    
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to={item.url}
                            className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:bg-sidebar-accent"
                            activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          >
                            <item.icon className="w-4 h-4" />
                            <span className="text-sm">{item.title}</span>
                            <ChevronRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Admin sections - only visible for administrators */}
            {canEditStructure() && (
              <SidebarGroup>
                <SidebarGroupLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-2">
                  Administración
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {adminNavItems.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to={item.url}
                            className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:bg-sidebar-accent"
                            activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          >
                            <item.icon className="w-4 h-4" />
                            <span className="text-sm">{item.title}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}

            {/* Google Calendar - accessible to all roles */}
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-2">
                Herramientas
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to="/calendar"
                        className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:bg-sidebar-accent"
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      >
                        <Calendar className="w-4 h-4" />
                        <span className="text-sm">Google Calendar</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            {roleLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            ) : (
              <span className="text-xs font-medium text-primary">
                {role?.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex flex-col">
            {roleLoading ? (
              <Skeleton className="h-4 w-20" />
            ) : (
              <span className="text-xs font-medium text-sidebar-foreground capitalize">{role}</span>
            )}
            <span className="text-xs text-muted-foreground">Usuario activo</span>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full justify-start text-muted-foreground hover:text-foreground"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Cerrar sesión
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
