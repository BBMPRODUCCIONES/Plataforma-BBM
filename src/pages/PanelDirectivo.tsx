import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { PanelHeader } from "@/components/PanelHeader";
import { MatrixTable } from "@/components/MatrixTable";
import { StatusBadge } from "@/components/StatusBadge";
import { GanttChart } from "@/components/GanttChart";
import { DashboardStats } from "@/components/DashboardStats";
import { CalendarFilter } from "@/components/CalendarFilter";
import { NewProjectDialog } from "@/components/NewProjectDialog";
import { FileUploadButton } from "@/components/FileUpload";
import { mockProjects } from "@/data/mockData";
import { Project, ProjectStatus, CalendarViewMode, Attachment } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, ExternalLink } from "lucide-react";
import { format, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";

const PanelDirectivo = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [projects, setProjects] = useState<Project[]>(mockProjects);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [highlightedProjectId, setHighlightedProjectId] = useState<string | null>(null);
  
  // Calendar filter state
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "todos">("todos");

  const getDateRange = () => {
    switch (viewMode) {
      case "day":
        return { start: startOfDay(selectedDate), end: endOfDay(selectedDate) };
      case "week":
        return { start: startOfWeek(selectedDate, { weekStartsOn: 1 }), end: endOfWeek(selectedDate, { weekStartsOn: 1 }) };
      case "month":
        return { start: startOfMonth(selectedDate), end: endOfMonth(selectedDate) };
    }
  };

  const filteredProjects = projects.filter((p) => {
    // Search filter
    const matchesSearch =
      p.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.evento.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.centroCostos.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Status filter
    const matchesStatus = statusFilter === "todos" || p.estado === statusFilter;
    
    // Date filter
    const range = getDateRange();
    const projectStart = parseISO(p.fechaMontajeInicio);
    const projectEnd = parseISO(p.fechaEjecucionFin);
    const matchesDate = 
      isWithinInterval(projectStart, range) ||
      isWithinInterval(projectEnd, range) ||
      (projectStart <= range.start && projectEnd >= range.end);

    return matchesSearch && matchesStatus && matchesDate;
  });

  const handleProjectCreate = (newProject: Partial<Project>) => {
    setProjects([...projects, newProject as Project]);
  };

  const handleGanttProjectClick = (projectId: string) => {
    setHighlightedProjectId(projectId);
    // Switch to table view and scroll to project
    const tabTrigger = document.querySelector('[value="tabla"]') as HTMLElement;
    if (tabTrigger) tabTrigger.click();
  };

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
      key: "avanzada",
      header: "Avanzada",
      width: "100px",
      render: (p: Project) => (
        <span className="text-xs">
          {p.avanzada === "SE_HIZO" ? "Se hizo" : p.avanzada === "NO_SE_HIZO" ? "No se hizo" : p.avanzada === "NO_NECESARIA" ? "No necesaria" : "-"}
        </span>
      ),
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
          {p.horaMontajeInicio && (
            <div className="text-[10px] text-muted-foreground">
              {p.horaMontajeInicio} - {p.horaMontajeFin}
            </div>
          )}
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
          {p.horaEjecucionInicio && (
            <div className="text-[10px] text-muted-foreground">
              {p.horaEjecucionInicio} - {p.horaEjecucionFin}
            </div>
          )}
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
      key: "ingresoTotal",
      header: "Ingreso Total",
      width: "100px",
      render: (p: Project) => (
        <span className="font-mono text-xs text-primary">
          ${(p.ingresoTotal || 0).toLocaleString()}
        </span>
      ),
    },
    {
      key: "ingresoBruto",
      header: "Ingreso Bruto",
      width: "100px",
      render: (p: Project) => (
        <span className="font-mono text-xs">
          ${(p.ingresoBruto || 0).toLocaleString()}
        </span>
      ),
    },
    {
      key: "cotizaciones",
      header: "Cotización",
      width: "100px",
      render: (p: Project) => (
        <FileUploadButton
          attachments={p.cotizaciones || []}
          onAttachmentsChange={(attachments) => {
            setProjects(projects.map(proj => 
              proj.id === p.id ? { ...proj, cotizaciones: attachments } : proj
            ));
          }}
          multiple
        />
      ),
    },
    {
      key: "ordenCompra",
      header: "Orden Compra",
      width: "100px",
      render: (p: Project) => (
        <FileUploadButton
          attachments={p.ordenesCompra || []}
          onAttachmentsChange={(attachments) => {
            setProjects(projects.map(proj => 
              proj.id === p.id ? { ...proj, ordenesCompra: attachments } : proj
            ));
          }}
          multiple
        />
      ),
    },
    {
      key: "estado",
      header: "Estado",
      width: "110px",
      render: (p: Project) => <StatusBadge status={p.estado} />,
    },
    {
      key: "acciones",
      header: "Paneles",
      width: "180px",
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
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/proveedores`);
            }}
          >
            Prov
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
            <Button size="sm" onClick={() => setNewProjectOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Proyecto
            </Button>
          }
        />

        {/* Calendar Filter */}
        <CalendarFilter
          viewMode={viewMode}
          selectedDate={selectedDate}
          statusFilter={statusFilter}
          onViewModeChange={setViewMode}
          onDateChange={setSelectedDate}
          onStatusChange={setStatusFilter}
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
                highlightedId={highlightedProjectId}
              />
            </div>
          </TabsContent>

          <TabsContent value="gantt" className="mt-4">
            <GanttChart
              projects={filteredProjects}
              startDate={startOfMonth(selectedDate)}
              monthsToShow={3}
              onProjectClick={handleGanttProjectClick}
            />
          </TabsContent>

          <TabsContent value="dashboard" className="mt-4">
            <DashboardStats projects={filteredProjects} />
          </TabsContent>
        </Tabs>

        <NewProjectDialog
          open={newProjectOpen}
          onOpenChange={setNewProjectOpen}
          onProjectCreate={handleProjectCreate}
        />
      </div>
    </Layout>
  );
};

export default PanelDirectivo;
