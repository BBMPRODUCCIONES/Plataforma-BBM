import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { mockProjects } from "@/data/mockData";
import { DashboardStats } from "@/components/DashboardStats";
import { GanttChart } from "@/components/GanttChart";
import { PanelHeader } from "@/components/PanelHeader";
import Layout from "@/components/Layout";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LayoutDashboard, Users, Settings, Briefcase } from "lucide-react";

const Dashboard = () => {
  const navigate = useNavigate();
  const { role, loading, canAccessPanel } = useUserRole();

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground">Cargando...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!role) {
    return (
      <Layout>
        <Card className="max-w-2xl mx-auto mt-8">
          <CardHeader>
            <CardTitle>Sin Acceso</CardTitle>
            <CardDescription>
              Tu cuenta no tiene un rol asignado. Contacta con un administrador para que te asigne permisos.
            </CardDescription>
          </CardHeader>
        </Card>
      </Layout>
    );
  }

  const panels = [
    {
      key: "directivo",
      title: "Panel Directivo",
      description: "Gestión ejecutiva: ingresos, cotizaciones, órdenes de compra",
      icon: Briefcase,
      url: "/panel-directivo",
    },
    {
      key: "general",
      title: "Panel General",
      description: "Vista general de proyectos y variables SSOT",
      icon: LayoutDashboard,
      url: "/panel-general",
    },
    {
      key: "operaciones",
      title: "Panel Operaciones",
      description: "Operaciones, personal, inventario y detalles logísticos",
      icon: Settings,
      url: "/panel-operaciones",
    },
    {
      key: "proveedores",
      title: "Proveedores",
      description: "Gestión de proveedores y cotizaciones",
      icon: Users,
      url: "/proveedores",
    },
  ];

  return (
    <Layout>
      <div className="space-y-8">
        <PanelHeader
          title="Dashboard"
          description={`Bienvenido, rol: ${role}`}
        />

        {/* Quick Access Panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {panels.map((panel) => {
            const hasAccess = canAccessPanel(panel.key);
            return (
              <Card
                key={panel.key}
                className={`cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-primary/50 ${
                  !hasAccess ? "opacity-40 pointer-events-none" : ""
                }`}
                onClick={() => hasAccess && navigate(panel.url)}
              >
                <CardHeader className="pb-3">
                  <panel.icon className="h-8 w-8 text-primary mb-2" />
                  <CardTitle className="text-base">{panel.title}</CardTitle>
                  <CardDescription className="text-xs">{panel.description}</CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>

        {/* Dashboard Stats */}
        <DashboardStats projects={mockProjects} />

        {/* Gantt Chart */}
        <GanttChart projects={mockProjects} startDate={new Date(2024, 2, 1)} monthsToShow={2} />
      </div>
    </Layout>
  );
};

export default Dashboard;
