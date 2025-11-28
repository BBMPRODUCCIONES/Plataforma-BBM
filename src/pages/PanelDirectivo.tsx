import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { PanelHeader } from "@/components/PanelHeader";
import { MatrixTable } from "@/components/MatrixTable";
import { StatusBadge } from "@/components/StatusBadge";
import { GanttChart } from "@/components/GanttChart";
import { DashboardStats } from "@/components/DashboardStats";
import { mockProjects } from "@/data/mockData";
import { Project } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, FileText, Plus, ExternalLink } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

const PanelDirectivo = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredProjects = mockProjects.filter(
    (p) =>
      p.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.evento.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.centroCostos.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns = [
    {
      key: "centroCostos",
      header: "Centro de Costos",
      width: "120px",
      render: (p: Project) => (
        <span className="font-mono text-xs">{p.centroCostos}</span>
      ),
    },
    {
      key: "numFactura",
      header: "#Factura",
      width: "100px",
      render: (p: Project) => (
        <span className="font-mono text-xs">{p.numFactura}</span>
      ),
    },
    {
      key: "cliente",
      header: "Cliente",
      width: "180px",
      render: (p: Project) => (
        <span className="font-medium text-xs">{p.cliente}</span>
      ),
    },
    {
      key: "evento",
      header: "Evento",
      width: "200px",
      render: (p: Project) => <span className="text-xs">{p.evento}</span>,
    },
    {
      key: "fechaMontaje",
      header: "Fecha Montaje",
      width: "140px",
      render: (p: Project) => (
        <div className="text-xs">
          <div>{format(parseISO(p.fechaMontajeInicio), "dd MMM", { locale: es })}</div>
          <div className="text-muted-foreground">
            - {format(parseISO(p.fechaMontajeFin), "dd MMM", { locale: es })}
          </div>
        </div>
      ),
    },
    {
      key: "fechaEjecucion",
      header: "Fecha Ejecución",
      width: "140px",
      render: (p: Project) => (
        <div className="text-xs">
          <div>{format(parseISO(p.fechaEjecucionInicio), "dd MMM", { locale: es })}</div>
          <div className="text-muted-foreground">
            - {format(parseISO(p.fechaEjecucionFin), "dd MMM", { locale: es })}
          </div>
        </div>
      ),
    },
    {
      key: "administrativoResponsable",
      header: "Responsable",
      width: "140px",
      render: (p: Project) => (
        <span className="text-xs">{p.administrativoResponsable || "-"}</span>
      ),
    },
    {
      key: "ingresos",
      header: "Ingresos",
      width: "100px",
      render: (p: Project) => (
        <span className="font-mono text-xs text-primary">
          ${(p.ingresos || 0).toLocaleString()}
        </span>
      ),
    },
    {
      key: "cotizaciones",
      header: "Cotizaciones",
      width: "100px",
      render: (p: Project) => (
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
          <FileText className="h-3 w-3 mr-1" />
          {p.cotizaciones?.length || 0}
        </Button>
      ),
    },
    {
      key: "estado",
      header: "Estado",
      width: "100px",
      render: (p: Project) => <StatusBadge status={p.estado} />,
    },
    {
      key: "acciones",
      header: "Acciones",
      width: "140px",
      render: (p: Project) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/panel-general?proyecto=${p.id}`);
            }}
          >
            General
            <ExternalLink className="h-3 w-3 ml-1" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/panel-operaciones?proyecto=${p.id}`);
            }}
          >
            Ops
            <ExternalLink className="h-3 w-3 ml-1" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <PanelHeader
          title="Panel Directivo"
          description="Gestión ejecutiva de proyectos y control de ingresos"
          panelLinks={[
            { label: "General", to: "/panel-general" },
            { label: "Operaciones", to: "/panel-operaciones" },
            { label: "Proveedores", to: "/proveedores" },
          ]}
          actions={
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Proyecto
            </Button>
          }
        />

        <Tabs defaultValue="tabla" className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="tabla">Tabla</TabsTrigger>
              <TabsTrigger value="gantt">Gantt</TabsTrigger>
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            </TabsList>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar proyecto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>

          <TabsContent value="tabla" className="mt-4">
            <div className="panel-card">
              <MatrixTable
                data={filteredProjects}
                columns={columns}
                onRowClick={(p) => navigate(`/proyecto/${p.id}`)}
              />
            </div>
          </TabsContent>

          <TabsContent value="gantt" className="mt-4">
            <GanttChart
              projects={filteredProjects}
              startDate={new Date(2024, 2, 1)}
              monthsToShow={3}
            />
          </TabsContent>

          <TabsContent value="dashboard" className="mt-4">
            <DashboardStats projects={filteredProjects} />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default PanelDirectivo;
