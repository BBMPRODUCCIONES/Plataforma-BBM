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
import { PurchaseOrderUpload } from "@/components/PurchaseOrderUpload";
import { AvanzadaSelect } from "@/components/AvanzadaSelect";
import { DateTimeRangeEditor } from "@/components/DateTimeRangeEditor";
import { EditableCell, CellType } from "@/components/EditableCell";
import { AddColumnDialog } from "@/components/AddColumnDialog";
import { useUserRole } from "@/hooks/useUserRole";
import { mockProjects } from "@/data/mockData";
import { Project, ProjectStatus, CalendarViewMode } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, ExternalLink, Columns } from "lucide-react";
import { format, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";

interface CustomColumn {
  key: string;
  header: string;
  type: CellType;
  width: string;
  options?: string[];
}

const PanelDirectivo = () => {
  const navigate = useNavigate();
  const { canEditStructure } = useUserRole();
  const [searchTerm, setSearchTerm] = useState("");
  const [projects, setProjects] = useState<Project[]>(mockProjects);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [highlightedProjectId, setHighlightedProjectId] = useState<string | null>(null);
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);
  
  // Calendar filter state
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date } | undefined>();
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "todos">("todos");

  const updateProject = (projectId: string, field: string, value: any) => {
    setProjects(projects.map(proj =>
      proj.id === projectId ? { ...proj, [field]: value } : proj
    ));
  };

  const getDateRange = () => {
    if (viewMode === "custom" && dateRange) {
      return dateRange;
    }
    switch (viewMode) {
      case "day":
        return { start: startOfDay(selectedDate), end: endOfDay(selectedDate) };
      case "week":
        return { start: startOfWeek(selectedDate, { weekStartsOn: 1 }), end: endOfWeek(selectedDate, { weekStartsOn: 1 }) };
      case "month":
        return { start: startOfMonth(selectedDate), end: endOfMonth(selectedDate) };
      case "quarter":
        return { start: startOfQuarter(selectedDate), end: endOfQuarter(selectedDate) };
      case "year":
        return { start: startOfYear(selectedDate), end: endOfYear(selectedDate) };
      default:
        return { start: startOfMonth(selectedDate), end: endOfMonth(selectedDate) };
    }
  };

  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.evento.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.centroCostos.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "todos" || p.estado === statusFilter;
    
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
    const tabTrigger = document.querySelector('[value="tabla"]') as HTMLElement;
    if (tabTrigger) tabTrigger.click();
  };

  const handleAddColumn = (column: CustomColumn) => {
    setCustomColumns([...customColumns, column]);
  };

  const baseColumns = [
    {
      key: "centroCostos",
      header: "Centro de Costos",
      width: "120px",
      render: (p: Project) => (
        <EditableCell
          value={p.centroCostos}
          type="text"
          onChange={(value) => updateProject(p.id, "centroCostos", value)}
          className="font-mono"
        />
      ),
    },
    {
      key: "numFactura",
      header: "#Factura",
      width: "100px",
      render: (p: Project) => (
        <EditableCell
          value={p.numFactura}
          type="text"
          onChange={(value) => updateProject(p.id, "numFactura", value)}
          className="font-mono"
        />
      ),
    },
    {
      key: "cliente",
      header: "Cliente",
      width: "180px",
      render: (p: Project) => (
        <EditableCell
          value={p.cliente}
          type="text"
          onChange={(value) => updateProject(p.id, "cliente", value)}
          className="font-medium"
        />
      ),
    },
    {
      key: "evento",
      header: "Evento",
      width: "200px",
      render: (p: Project) => (
        <EditableCell
          value={p.evento}
          type="text"
          onChange={(value) => updateProject(p.id, "evento", value)}
        />
      ),
    },
    {
      key: "avanzada",
      header: "Avanzada",
      width: "130px",
      render: (p: Project) => (
        <AvanzadaSelect
          value={p.avanzada}
          onChange={(value) => updateProject(p.id, "avanzada", value)}
        />
      ),
    },
    {
      key: "fechaMontaje",
      header: "Fecha Montaje",
      width: "140px",
      render: (p: Project) => (
        <DateTimeRangeEditor
          type="montaje"
          value={{
            fechaInicio: p.fechaMontajeInicio,
            fechaFin: p.fechaMontajeFin,
            horaInicio: p.horaMontajeInicio,
            horaFin: p.horaMontajeFin,
          }}
          onChange={(value) => {
            setProjects(projects.map(proj =>
              proj.id === p.id
                ? {
                    ...proj,
                    fechaMontajeInicio: value.fechaInicio,
                    fechaMontajeFin: value.fechaFin,
                    horaMontajeInicio: value.horaInicio,
                    horaMontajeFin: value.horaFin,
                  }
                : proj
            ));
          }}
          displayValue={
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
          }
        />
      ),
    },
    {
      key: "fechaEjecucion",
      header: "Fecha Ejecución",
      width: "140px",
      render: (p: Project) => (
        <DateTimeRangeEditor
          type="ejecucion"
          value={{
            fechaInicio: p.fechaEjecucionInicio,
            fechaFin: p.fechaEjecucionFin,
            horaInicio: p.horaEjecucionInicio,
            horaFin: p.horaEjecucionFin,
          }}
          onChange={(value) => {
            setProjects(projects.map(proj =>
              proj.id === p.id
                ? {
                    ...proj,
                    fechaEjecucionInicio: value.fechaInicio,
                    fechaEjecucionFin: value.fechaFin,
                    horaEjecucionInicio: value.horaInicio,
                    horaEjecucionFin: value.horaFin,
                  }
                : proj
            ));
          }}
          displayValue={
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
          }
        />
      ),
    },
    {
      key: "administrativoResponsable",
      header: "Responsable",
      width: "140px",
      render: (p: Project) => (
        <EditableCell
          value={p.administrativoResponsable}
          type="text"
          onChange={(value) => updateProject(p.id, "administrativoResponsable", value)}
        />
      ),
    },
    {
      key: "ingresoTotal",
      header: "Ingreso Total",
      width: "110px",
      render: (p: Project) => (
        <EditableCell
          value={p.ingresoTotal}
          type="number"
          onChange={(value) => updateProject(p.id, "ingresoTotal", value)}
          className="text-primary"
        />
      ),
    },
    {
      key: "ingresoBruto",
      header: "Ingreso Bruto",
      width: "110px",
      render: (p: Project) => (
        <EditableCell
          value={p.ingresoBruto}
          type="number"
          onChange={(value) => updateProject(p.id, "ingresoBruto", value)}
        />
      ),
    },
    {
      key: "cotizaciones",
      header: "Cotización",
      width: "100px",
      render: (p: Project) => (
        <FileUploadButton
          attachments={p.cotizaciones || []}
          onAttachmentsChange={(attachments) => updateProject(p.id, "cotizaciones", attachments)}
          multiple
        />
      ),
    },
    {
      key: "ordenCompra",
      header: "Orden Compra",
      width: "120px",
      render: (p: Project) => (
        <PurchaseOrderUpload
          attachments={p.ordenesCompra || []}
          onAttachmentsChange={(attachments) => updateProject(p.id, "ordenesCompra", attachments)}
          currentIngresoBruto={p.ingresoBruto}
          currentIngresoTotal={p.ingresoTotal}
          onDataExtracted={(ingresoBruto, ingresoTotal) => {
            setProjects(prevProjects => prevProjects.map(proj =>
              proj.id === p.id
                ? {
                    ...proj,
                    ingresoBruto: ingresoBruto ?? proj.ingresoBruto,
                    ingresoTotal: ingresoTotal ?? proj.ingresoTotal,
                  }
                : proj
            ));
          }}
        />
      ),
    },
    {
      key: "estado",
      header: "Estado",
      width: "110px",
      render: (p: Project) => <StatusBadge status={p.estado} />,
    },
  ];

  // Add custom columns dynamically
  const dynamicCustomColumns = customColumns.map((col) => ({
    key: col.key,
    header: col.header,
    width: col.width,
    render: (p: Project) => (
      <EditableCell
        value={(p as any)[col.key]}
        type={col.type}
        options={col.options}
        onChange={(value) => updateProject(p.id, col.key, value)}
      />
    ),
  }));

  const panelColumn = {
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
  };

  const columns = [...baseColumns, ...dynamicCustomColumns, panelColumn];

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
            <div className="flex gap-2">
              {canEditStructure() && (
                <Button variant="outline" size="sm" onClick={() => setAddColumnOpen(true)}>
                  <Columns className="h-4 w-4 mr-2" />
                  Agregar Columna
                </Button>
              )}
              <Button size="sm" onClick={() => setNewProjectOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Proyecto
              </Button>
            </div>
          }
        />

        {/* Calendar Filter */}
        <CalendarFilter
          viewMode={viewMode}
          selectedDate={selectedDate}
          dateRange={dateRange}
          statusFilter={statusFilter}
          onViewModeChange={setViewMode}
          onDateChange={setSelectedDate}
          onDateRangeChange={setDateRange}
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
                onRowClick={(p) => setHighlightedProjectId(p.id)}
                highlightedId={highlightedProjectId}
              />
            </div>
          </TabsContent>

          <TabsContent value="gantt" className="mt-4">
            <GanttChart
              projects={filteredProjects}
              startDate={selectedDate}
              monthsToShow={viewMode === "year" ? 12 : viewMode === "quarter" ? 3 : viewMode === "month" ? 3 : 1}
              viewMode={viewMode}
              customDateRange={dateRange}
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

        <AddColumnDialog
          open={addColumnOpen}
          onOpenChange={setAddColumnOpen}
          onAddColumn={handleAddColumn}
        />
      </div>
    </Layout>
  );
};

export default PanelDirectivo;
