import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { PanelHeader } from "@/components/PanelHeader";
import { MatrixTable } from "@/components/MatrixTable";
import { StatusSelect } from "@/components/StatusSelect";
import { GanttChart } from "@/components/GanttChart";
import { DashboardStats } from "@/components/DashboardStats";
import { CalendarFilter } from "@/components/CalendarFilter";
import { NewProjectDialog } from "@/components/NewProjectDialog";
import { AttachmentButton } from "@/components/AttachmentManager";
import { PurchaseOrderUpload } from "@/components/PurchaseOrderUpload";
import { AvanzadaSelect } from "@/components/AvanzadaSelect";
import { DateTimeRangeEditor } from "@/components/DateTimeRangeEditor";
import { EditableCell, CellType } from "@/components/EditableCell";
import { ClienteAutocomplete } from "@/components/ClienteAutocomplete";
import { ColumnManagerDialog, ColumnConfig } from "@/components/ColumnManagerDialog";
import { usePersistedColumns } from "@/hooks/usePersistedColumns";
import { useUserRole } from "@/hooks/useUserRole";
import { useProjects } from "@/contexts/ProjectsContext";
import { Project, ProjectStatus, CalendarViewMode } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, ExternalLink, Settings, Loader2 } from "lucide-react";
import { format, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";

const PanelDirectivo = () => {
  const navigate = useNavigate();
  const { canEditStructure, role } = useUserRole();
  const { projects, loading, updateProject: contextUpdateProject, updateProjectMultiple, addProject } = useProjects();
  const isAdmin = role?.toLowerCase() === "administrador";
  const [searchTerm, setSearchTerm] = useState("");
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [columnManagerOpen, setColumnManagerOpen] = useState(false);
  const [highlightedProjectId, setHighlightedProjectId] = useState<string | null>(null);
  
  // Column management state - persisted to localStorage
  const defaultColumns: ColumnConfig[] = [
    { key: "centroCostos", header: "Centro de Costos", type: "text" as CellType, width: "130px", visible: true, isCustom: false, order: 0 },
    { key: "numFactura", header: "#Factura", type: "text" as CellType, width: "100px", visible: true, isCustom: false, order: 1 },
    { key: "cliente", header: "Cliente", type: "text" as CellType, width: "200px", visible: true, isCustom: false, order: 2 },
    { key: "evento", header: "Evento", type: "text" as CellType, width: "200px", visible: true, isCustom: false, order: 3 },
    { key: "avanzada", header: "Avanzada", type: "select" as CellType, width: "130px", visible: true, isCustom: false, order: 4, options: ["No se hizo", "Se hizo", "No es necesario"] },
    { key: "fechaMontaje", header: "Fecha de Montaje", type: "date" as CellType, width: "160px", visible: true, isCustom: false, order: 5 },
    { key: "fechaEjecucion", header: "Fecha de Ejecución", type: "date" as CellType, width: "160px", visible: true, isCustom: false, order: 6 },
    { key: "estado", header: "Estado", type: "select" as CellType, width: "140px", visible: true, isCustom: false, order: 7 },
    { key: "ingresoBruto", header: "Ingreso Bruto", type: "number" as CellType, width: "120px", visible: true, isCustom: false, order: 8 },
    { key: "ingresoTotal", header: "Ingreso Total", type: "number" as CellType, width: "120px", visible: true, isCustom: false, order: 9 },
    { key: "cotizaciones", header: "Cotización", type: "file" as CellType, width: "120px", visible: true, isCustom: false, order: 10 },
    { key: "notas", header: "Notas", type: "text" as CellType, width: "200px", visible: true, isCustom: false, order: 11 },
    { key: "panelGeneral", header: "Ver en Panel", type: "text" as CellType, width: "100px", visible: true, isCustom: false, order: 12 },
  ];
  const [managedColumns, setManagedColumns] = usePersistedColumns("panel-directivo-columns", defaultColumns);
  
  // Calendar filter state
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date } | undefined>();
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "todos">("todos");

  const updateProject = (projectId: string, field: string, value: any) => {
    contextUpdateProject(projectId, field, value);
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

  const handleProjectCreate = async (newProject: Partial<Project>) => {
    await addProject(newProject);
  };

  const handleGanttProjectClick = (projectId: string) => {
    setHighlightedProjectId(projectId);
    const tabTrigger = document.querySelector('[value="tabla"]') as HTMLElement;
    if (tabTrigger) tabTrigger.click();
  };

  // Define base columns with their configurations
  const baseColumnDefs: ColumnConfig[] = useMemo(() => [
    { key: "centroCostos", header: "Centro de Costos", type: "text" as CellType, width: "120px", visible: true, isCustom: false, order: 0 },
    { key: "numFactura", header: "#Factura", type: "text" as CellType, width: "100px", visible: true, isCustom: false, order: 1 },
    { key: "cliente", header: "Cliente", type: "text" as CellType, width: "180px", visible: true, isCustom: false, order: 2 },
    { key: "evento", header: "Evento", type: "text" as CellType, width: "200px", visible: true, isCustom: false, order: 3 },
    { key: "avanzada", header: "Avanzada", type: "select" as CellType, width: "130px", visible: true, isCustom: false, order: 4 },
    { key: "fechaMontaje", header: "Fecha Montaje", type: "date" as CellType, width: "140px", visible: true, isCustom: false, order: 5 },
    { key: "fechaEjecucion", header: "Fecha Ejecución", type: "date" as CellType, width: "140px", visible: true, isCustom: false, order: 6 },
    { key: "estado", header: "Estado", type: "select" as CellType, width: "130px", visible: true, isCustom: false, order: 7 },
    { key: "ingresoBruto", header: "Ingreso Bruto", type: "number" as CellType, width: "110px", visible: true, isCustom: false, order: 8 },
    { key: "ingresoTotal", header: "Ingreso Total", type: "number" as CellType, width: "110px", visible: true, isCustom: false, order: 9 },
    { key: "cotizaciones", header: "Cotización", type: "file" as CellType, width: "120px", visible: true, isCustom: false, order: 10 },
    { key: "notas", header: "Notas", type: "text" as CellType, width: "150px", visible: true, isCustom: false, order: 11 },
  ], []);

  // Get all columns (base + managed) - direct calculation for immediate updates
  const allColumnConfigs = managedColumns.length > 0 ? managedColumns : baseColumnDefs;

  // Handle columns change from manager - force new array reference
  const handleColumnsChange = (newColumns: ColumnConfig[]) => {
    console.log('[PanelDirectivo] Received column changes:', newColumns.length, newColumns);
    const copiedColumns = newColumns.map(col => ({ ...col }));
    setManagedColumns(copiedColumns);
  };

  // Initialize managed columns if empty
  const initializeColumns = () => {
    if (managedColumns.length === 0) {
      setManagedColumns(baseColumnDefs);
    }
    setColumnManagerOpen(true);
  };

  // Build render functions for columns
  const getColumnRender = (colConfig: ColumnConfig) => {
    // Special render functions for specific columns
    switch (colConfig.key) {
      case "centroCostos":
        return (p: Project) => (
          <EditableCell
            value={p.centroCostos}
            type="text"
            onChange={(value) => updateProject(p.id, "centroCostos", value)}
            className="font-mono"
          />
        );
      case "numFactura":
        return (p: Project) => (
          <EditableCell
            value={p.numFactura}
            type="text"
            onChange={(value) => updateProject(p.id, "numFactura", value)}
            className="font-mono"
          />
        );
      case "cliente":
        return (p: Project) => (
          <ClienteAutocomplete
            value={p.cliente}
            onChange={(value) => updateProject(p.id, "cliente", value)}
          />
        );
      case "evento":
        return (p: Project) => (
          <EditableCell
            value={p.evento}
            type="text"
            onChange={(value) => updateProject(p.id, "evento", value)}
          />
        );
      case "avanzada":
        return (p: Project) => (
          <AvanzadaSelect
            value={p.avanzada}
            onChange={(value) => updateProject(p.id, "avanzada", value)}
          />
        );
      case "fechaMontaje":
        return (p: Project) => (
          <DateTimeRangeEditor
            type="montaje"
            value={{
              fechaInicio: p.fechaMontajeInicio,
              fechaFin: p.fechaMontajeFin,
              horaInicio: p.horaMontajeInicio,
              horaFin: p.horaMontajeFin,
            }}
            onChange={(value) => {
              updateProjectMultiple(p.id, {
                fechaMontajeInicio: value.fechaInicio,
                fechaMontajeFin: value.fechaFin,
                horaMontajeInicio: value.horaInicio,
                horaMontajeFin: value.horaFin,
              });
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
        );
      case "fechaEjecucion":
        return (p: Project) => (
          <DateTimeRangeEditor
            type="ejecucion"
            value={{
              fechaInicio: p.fechaEjecucionInicio,
              fechaFin: p.fechaEjecucionFin,
              horaInicio: p.horaEjecucionInicio,
              horaFin: p.horaEjecucionFin,
            }}
            onChange={(value) => {
              updateProjectMultiple(p.id, {
                fechaEjecucionInicio: value.fechaInicio,
                fechaEjecucionFin: value.fechaFin,
                horaEjecucionInicio: value.horaInicio,
                horaEjecucionFin: value.horaFin,
              });
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
        );
      case "administrativoResponsable":
        return (p: Project) => (
          <EditableCell
            value={p.administrativoResponsable}
            type="text"
            onChange={(value) => updateProject(p.id, "administrativoResponsable", value)}
          />
        );
      case "ingresoTotal":
        return (p: Project) => (
          <EditableCell
            value={p.ingresoTotal}
            type="number"
            onChange={(value) => updateProject(p.id, "ingresoTotal", value)}
            className="text-primary"
          />
        );
      case "ingresoBruto":
        return (p: Project) => (
          <EditableCell
            value={p.ingresoBruto}
            type="number"
            onChange={(value) => updateProject(p.id, "ingresoBruto", value)}
          />
        );
      case "cotizaciones":
        return (p: Project) => (
          <PurchaseOrderUpload
            attachments={p.cotizaciones || []}
            onAttachmentsChange={(attachments) => updateProject(p.id, "cotizaciones", attachments)}
            currentIngresoBruto={p.ingresoBruto}
            currentIngresoTotal={p.ingresoTotal}
            projectId={p.id}
            onDataExtracted={(ingresoBruto, ingresoTotal, inventarioItems) => {
              // Merge new inventory items with existing ones (don't replace)
              const existingInventario = p.inventario || [];
              const mergedInventario = inventarioItems && inventarioItems.length > 0
                ? [...existingInventario, ...inventarioItems]
                : existingInventario;
              
              updateProjectMultiple(p.id, {
                ingresoBruto: ingresoBruto ?? undefined,
                ingresoTotal: ingresoTotal ?? undefined,
                inventario: mergedInventario.length > 0 ? mergedInventario : undefined,
              });
            }}
          />
        );
      case "ordenCompra":
        return (p: Project) => (
          <PurchaseOrderUpload
            attachments={p.ordenesCompra || []}
            onAttachmentsChange={(attachments) => updateProject(p.id, "ordenesCompra", attachments)}
            currentIngresoBruto={p.ingresoBruto}
            currentIngresoTotal={p.ingresoTotal}
            projectId={p.id}
            onDataExtracted={(ingresoBruto, ingresoTotal, inventarioItems) => {
              // Merge new inventory items with existing ones (don't replace)
              const existingInventario = p.inventario || [];
              const mergedInventario = inventarioItems && inventarioItems.length > 0
                ? [...existingInventario, ...inventarioItems]
                : existingInventario;
              
              updateProjectMultiple(p.id, {
                ingresoBruto: ingresoBruto ?? undefined,
                ingresoTotal: ingresoTotal ?? undefined,
                inventario: mergedInventario.length > 0 ? mergedInventario : undefined,
              });
            }}
          />
        );
      case "estado":
        return (p: Project) => (
          <StatusSelect
            value={p.estado}
            onChange={(value) => updateProject(p.id, "estado", value)}
          />
        );
      default:
        // Custom columns use EditableCell
        return (p: Project) => (
          <EditableCell
            value={(p as any)[colConfig.key]}
            type={colConfig.type}
            options={colConfig.options}
            onChange={(value) => updateProject(p.id, colConfig.key, value)}
          />
        );
    }
  };

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

  // Build final columns array - direct calculation for immediate updates
  const columns = (() => {
    const visibleColumns = allColumnConfigs
      .filter(col => col.visible)
      .sort((a, b) => a.order - b.order)
      .map(col => ({
        key: col.key,
        header: col.header,
        width: col.width,
        render: getColumnRender(col),
      }));
    
    return [...visibleColumns, panelColumn];
  })();

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

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
              {isAdmin && (
                <Button variant="outline" size="sm" onClick={initializeColumns}>
                  <Settings className="h-4 w-4 mr-2" />
                  Gestionar Columnas
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
                key={`table-${allColumnConfigs.map(c => `${c.key}-${c.visible}-${c.order}`).join('_')}`}
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

        <ColumnManagerDialog
          open={columnManagerOpen}
          onOpenChange={setColumnManagerOpen}
          columns={managedColumns.length > 0 ? managedColumns : baseColumnDefs}
          onColumnsChange={handleColumnsChange}
          panelName="Panel Directivo"
        />
      </div>
    </Layout>
  );
};

export default PanelDirectivo;
