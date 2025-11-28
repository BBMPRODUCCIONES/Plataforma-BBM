import {
  LayoutDashboard,
  Briefcase,
  Grid3X3,
  Wrench,
  Users,
  Settings,
  Bot,
  Calendar,
  ChevronRight,
  UserPlus,
  Building2,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useUserRole } from "@/hooks/useUserRole";
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
import { cn } from "@/lib/utils";

const mainNavItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, panel: "dashboard" },
  { title: "Panel Directivo", url: "/panel-directivo", icon: Briefcase, panel: "directivo" },
  { title: "Panel General", url: "/panel-general", icon: Grid3X3, panel: "general" },
  { title: "Panel Operaciones", url: "/panel-operaciones", icon: Wrench, panel: "operaciones" },
  { title: "Proveedores", url: "/proveedores", icon: Users, panel: "proveedores" },
];

const adminNavItems = [
  { title: "Gestión de Usuarios", url: "/usuarios", icon: UserPlus, panel: "usuarios" },
  { title: "Gestión de Clientes", url: "/clientes", icon: Building2, panel: "clientes" },
  { title: "Constructor de Campos", url: "/constructor", icon: Settings, panel: "constructor" },
  { title: "Agentes IA", url: "/agentes-ia", icon: Bot, panel: "agentes" },
  { title: "Google Calendar", url: "/calendar", icon: Calendar, panel: "calendar" },
];

export function AppSidebar() {
  const { canAccessPanel, canEditStructure, role } = useUserRole();

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sidebar-foreground text-sm">Producción</span>
            <span className="text-xs text-muted-foreground">Eventos</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-2">
            Paneles
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => {
                const hasAccess = item.panel === "dashboard" || canAccessPanel(item.panel);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      className={cn(!hasAccess && "opacity-40 pointer-events-none")}
                    >
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
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-xs font-medium text-primary">
              {role?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium text-sidebar-foreground capitalize">{role}</span>
            <span className="text-xs text-muted-foreground">Usuario activo</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
