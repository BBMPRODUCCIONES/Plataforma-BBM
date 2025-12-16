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
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/contexts/ProjectsContext";
import { useDateRange } from "@/contexts/DateRangeContext";
import { Project, ProjectStatus, CalendarViewMode } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, ExternalLink, Settings, Loader2, Trash2, RotateCcw } from "lucide-react";
import { format, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const PanelDirectivo = () => {
  const navigate = useNavigate();
  const { canEditStructure, role } = useUserRole();
  const { user } = useAuth();
  const { projects, loading, updateProject: contextUpdateProject, updateProjectMultiple, addProject, softDeleteProject, restoreProject } = useProjects();
  const { globalDateRange, setGlobalDateRange, globalViewMode, setGlobalViewMode, globalSelectedDate, setGlobalSelectedDate } = useDateRange();
  const isAdmin = role?.toLowerCase() === "administrador";
  const [searchTerm, setSearchTerm] = useState("");
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [columnManagerOpen, setColumnManagerOpen] = useState(false);
  const [highlightedProjectId, setHighlightedProjectId] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  
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
  
  // Calendar filter state - using global context
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "todos">("todos");
  
  // Computed dateRange from global context
  const dateRange = globalDateRange?.from && globalDateRange?.to 
    ? { start: globalDateRange.from, end: globalDateRange.to } 
    : undefined;

  const updateProject = (projectId: string, field: string, value: any) => {
    contextUpdateProject(projectId, field, value);
  };

  const getDateRange = () => {
    if (globalViewMode === "custom" && dateRange) {
      return dateRange;
    }
    switch (globalViewMode) {
      case "day":
        return { start: startOfDay(globalSelectedDate), end: endOfDay(globalSelectedDate) };
      case "week":
        return { start: startOfWeek(globalSelectedDate, { weekStartsOn: 1 }), end: endOfWeek(globalSelectedDate, { weekStartsOn: 1 }) };
      case "month":
        return { start: startOfMonth(globalSelectedDate), end: endOfMonth(globalSelectedDate) };
      case "quarter":
        return { start: startOfQuarter(globalSelectedDate), end: endOfQuarter(globalSelectedDate) };
      case "year":
        return { start: startOfYear(globalSelectedDate), end: endOfYear(globalSelectedDate) };
      default:
        return { start: startOfMonth(globalSelectedDate), end: endOfMonth(globalSelectedDate) };
    }
  };

  const filteredProjects = projects.filter((p) => {
    // Filter deleted unless showDeleted is enabled
    const matchesDeleted = showDeleted || !p.isDeleted;
    
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

    return matchesDeleted && matchesSearch && matchesStatus && matchesDate;
  });

  const handleSoftDelete = async (project: Project) => {
    if (!user) return;
    await softDeleteProject(project.id, user.email || "", user.id);
  };

  const handleRestore = async (project: Project) => {
    await restoreProject(project.id);
  };

  const getRowClassName = (project: Project) => {
    if (project.isDeleted) {
      return "bg-red-500/10 border-l-4 border-l-red-500";
    }
    return "";
  };

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
    header: "Acciones",
    width: "220px",
    render: (p: Project) => (
      <div className="flex gap-1 items-center">
        {p.isDeleted && (
          <Badge variant="destructive" className="text-[10px] px-1 py-0 mr-1">
            ELIMINADO
          </Badge>
        )}
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
        {isAdmin && !p.isDeleted && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={(e) => e.stopPropagation()}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar evento?</AlertDialogTitle>
                <AlertDialogDescription>
                  El evento "{p.evento}" será marcado como eliminado. Podrás restaurarlo más tarde si es necesario.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => handleSoftDelete(p)}
                >
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        {isAdmin && p.isDeleted && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-green-600 hover:text-green-600 hover:bg-green-500/10"
            onClick={(e) => {
              e.stopPropagation();
              handleRestore(p);
            }}
            title="Restaurar evento"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        )}
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
          viewMode={globalViewMode}
          selectedDate={globalSelectedDate}
          dateRange={dateRange}
          statusFilter={statusFilter}
          onViewModeChange={setGlobalViewMode}
          onDateChange={setGlobalSelectedDate}
          onDateRangeChange={(range) => range ? setGlobalDateRange({ from: range.start, to: range.end }) : setGlobalDateRange(undefined)}
          onStatusChange={setStatusFilter}
        />

        <Tabs defaultValue="tabla" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <TabsList>
                <TabsTrigger value="tabla">Tabla</TabsTrigger>
                <TabsTrigger value="gantt">Gantt</TabsTrigger>
                <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              </TabsList>
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <Switch
                    id="show-deleted"
                    checked={showDeleted}
                    onCheckedChange={setShowDeleted}
                  />
                  <Label htmlFor="show-deleted" className="text-sm text-muted-foreground cursor-pointer">
                    Mostrar eliminados
                  </Label>
                </div>
              )}
            </div>
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
                getRowClassName={getRowClassName}
              />
            </div>
          </TabsContent>

          <TabsContent value="gantt" className="mt-4">
            <GanttChart
              projects={filteredProjects}
              startDate={globalSelectedDate}
              monthsToShow={globalViewMode === "year" ? 12 : globalViewMode === "quarter" ? 3 : globalViewMode === "month" ? 3 : 1}
              viewMode={globalViewMode}
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
