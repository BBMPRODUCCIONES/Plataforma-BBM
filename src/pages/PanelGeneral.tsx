import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { logger } from "@/lib/logger";
import Layout from "@/components/Layout";
import { PanelHeader } from "@/components/PanelHeader";
import { MatrixTable } from "@/components/MatrixTable";
import { StatusSelect } from "@/components/StatusSelect";
import { GanttChart } from "@/components/GanttChart";
import { CalendarFilter } from "@/components/CalendarFilter";
import { AttachmentButton } from "@/components/AttachmentManager";
import { PurchaseOrderUpload } from "@/components/PurchaseOrderUpload";
import { AvanzadaSelect } from "@/components/AvanzadaSelect";
import { DateTimeRangeEditor } from "@/components/DateTimeRangeEditor";
import { EditableCell, CellType } from "@/components/EditableCell";
import { ClienteAutocomplete } from "@/components/ClienteAutocomplete";
import { ColumnManagerDialog, ColumnConfig } from "@/components/ColumnManagerDialog";
import { EventLink } from "@/components/EventLink";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useGlobalColumns } from "@/hooks/useGlobalColumns";
import { useUserRole } from "@/hooks/useUserRole";
import { useProjects } from "@/contexts/ProjectsContext";
import { useDateRange } from "@/contexts/DateRangeContext";
import { Project, ProjectStatus, CalendarViewMode } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, ExternalLink, Settings, Loader2, Eye, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { format, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";


const PanelGeneral = () => {
  const navigate = useNavigate();
  const { canEditStructure, role, canEditGeneral } = useUserRole();
  const { user } = useAuth();
  const { projects, loading, updateProject: contextUpdateProject, updateProjectMultiple } = useProjects();
  const { globalDateRange, setGlobalDateRange, globalViewMode, setGlobalViewMode, globalSelectedDate, setGlobalSelectedDate } = useDateRange();
  const isAdmin = role?.toLowerCase() === "administrador";
  const generalReadOnly = !canEditGeneral();
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightedProjectId, setHighlightedProjectId] = useState<string | null>(null);
  const [columnManagerOpen, setColumnManagerOpen] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [notaExpandida, setNotaExpandida] = useState<{ evento: string; nota: string } | null>(null);
  const [montajeSort, setMontajeSort] = useState<"asc" | "desc" | null>(null);
  // Initialize with base columns - persisted to localStorage
  const defaultColumns: ColumnConfig[] = [
    { key: "centroCostos", header: "CC", type: "text" as CellType, width: "70px", visible: true, isCustom: false, order: 0 },
    { key: "numFactura", header: "#Factura", type: "text" as CellType, width: "75px", visible: true, isCustom: false, order: 1 },
    { key: "cliente", header: "Cliente", type: "text" as CellType, width: "130px", visible: true, isCustom: false, order: 2 },
    { key: "evento", header: "Evento", type: "text" as CellType, width: "150px", visible: true, isCustom: false, order: 3 },
    { key: "avanzada", header: "Avanzada", type: "select" as CellType, width: "110px", visible: true, isCustom: false, order: 4, options: ["No se hizo", "Se hizo", "No es necesario"] },
    { key: "fechaMontaje", header: "Montaje", type: "date" as CellType, width: "90px", visible: true, isCustom: false, order: 5 },
    { key: "fechaEjecucion", header: "Ejecución", type: "date" as CellType, width: "90px", visible: true, isCustom: false, order: 6 },
    { key: "fechaDesmontaje", header: "Desmontaje", type: "date" as CellType, width: "95px", visible: true, isCustom: false, order: 7 },
    { key: "estado", header: "Estado", type: "select" as CellType, width: "110px", visible: true, isCustom: false, order: 8 },
    { key: "jefeOperaciones", header: "Jefe Ops", type: "text" as CellType, width: "95px", visible: true, isCustom: false, order: 9 },
    { key: "aCargoDe", header: "A Cargo", type: "text" as CellType, width: "85px", visible: true, isCustom: false, order: 10 },
    { key: "productor", header: "Productor", type: "text" as CellType, width: "90px", visible: true, isCustom: false, order: 11 },
    { key: "ubicacion", header: "Ubicación", type: "text" as CellType, width: "130px", visible: true, isCustom: false, order: 12 },
    { key: "notas", header: "Notas", type: "text" as CellType, width: "120px", visible: true, isCustom: false, order: 13 },
    { key: "panelDirectivo", header: "Panel", type: "text" as CellType, width: "65px", visible: true, isCustom: false, order: 14 },
  ];
  const { columns: managedColumns, setColumns: setManagedColumns, loading: columnsLoading, isAdmin: canModifyStructure } = useGlobalColumns("panel-general", defaultColumns);
  
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

  const filteredProjects = useMemo(() => {
    let result = projects.filter((p) => {
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

    if (montajeSort) {
      result = [...result].sort((a, b) => {
        const dateA = a.fechaMontajeInicio || "";
        const dateB = b.fechaMontajeInicio || "";
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        const cmp = dateA.localeCompare(dateB);
        return montajeSort === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [projects, showDeleted, searchTerm, statusFilter, montajeSort, globalViewMode, globalSelectedDate, globalDateRange]);


  const getRowClassName = (project: Project) => {
    if (project.isDeleted) {
      return "row-deleted";
    }
    return "";
  };

  const handleGanttProjectClick = (projectId: string) => {
    setHighlightedProjectId(projectId);
    const tabTrigger = document.querySelector('[value="matriz"]') as HTMLElement;
    if (tabTrigger) tabTrigger.click();
  };

  // Define base columns
  const baseColumnDefs: ColumnConfig[] = useMemo(() => [
    { key: "centroCostos", header: "CC", type: "text" as CellType, width: "70px", visible: true, isCustom: false, order: 0 },
    { key: "numFactura", header: "#Factura", type: "text" as CellType, width: "75px", visible: true, isCustom: false, order: 1 },
    { key: "cliente", header: "Cliente", type: "text" as CellType, width: "130px", visible: true, isCustom: false, order: 2 },
    { key: "avanzada", header: "Avanzada", type: "select" as CellType, width: "110px", visible: true, isCustom: false, order: 3 },
    { key: "fechaMontaje", header: "Montaje", type: "date" as CellType, width: "90px", visible: true, isCustom: false, order: 4 },
    { key: "fechaEjecucion", header: "Ejecución", type: "date" as CellType, width: "90px", visible: true, isCustom: false, order: 5 },
    { key: "fechaDesmontaje", header: "Desmontaje", type: "date" as CellType, width: "95px", visible: true, isCustom: false, order: 6 },
    { key: "estado", header: "Estado", type: "select" as CellType, width: "110px", visible: true, isCustom: false, order: 7 },
    { key: "ordenCompra", header: "OC + OCR", type: "file" as CellType, width: "90px", visible: true, isCustom: false, order: 8 },
  ], []);

  // Get all columns - direct calculation for immediate updates
  const allColumnConfigs = managedColumns.length > 0 ? managedColumns : baseColumnDefs;

  // Handle columns change - force new array reference
  const handleColumnsChange = (newColumns: ColumnConfig[]) => {
    logger.debug('[PanelGeneral] Received column changes:', newColumns.length, newColumns);
    const copiedColumns = newColumns.map(col => ({ ...col }));
    setManagedColumns(copiedColumns);
  };

  const initializeColumns = () => {
    if (managedColumns.length === 0) {
      setManagedColumns(baseColumnDefs);
    }
    setColumnManagerOpen(true);
  };

  const getColumnRender = (colConfig: ColumnConfig) => {
    switch (colConfig.key) {
      case "centroCostos":
        return (p: Project) => generalReadOnly ? (
          <span className="text-sm font-mono">{p.centroCostos || "-"}</span>
        ) : (
          <EditableCell
            value={p.centroCostos}
            type="text"
            onChange={(value) => updateProject(p.id, "centroCostos", value)}
            className="font-mono bg-muted px-2 py-1 rounded"
            placeholder="Ej: 3-00814"
          />
        );
      case "numFactura":
        return (p: Project) => generalReadOnly ? (
          <span className="text-sm font-mono">{p.numFactura || "Sin factura"}</span>
        ) : (
          <EditableCell
            value={p.numFactura}
            type="text"
            onChange={(value) => updateProject(p.id, "numFactura", value)}
            className="font-mono"
            placeholder="Nº factura"
          />
        );
      case "cliente":
        return (p: Project) => generalReadOnly ? (
          <span className="text-sm truncate">{p.cliente || "Sin cliente"}</span>
        ) : (
          <ClienteAutocomplete
            value={p.cliente}
            onChange={(value) => updateProject(p.id, "cliente", value)}
          />
        );
      case "evento":
        return (p: Project) => (
          <EventLink
            eventId={p.id}
            eventName={p.evento}
            isDeleted={p.isDeleted}
            className="font-medium"
            source="general"
          />
        );
      case "avanzada":
        return (p: Project) => generalReadOnly ? (
          <span className="text-xs">{p.avanzada || "Sin asignar"}</span>
        ) : (
          <AvanzadaSelect
            value={p.avanzada}
            onChange={(value) => updateProject(p.id, "avanzada", value)}
          />
        );
      case "fechaMontaje":
        return (p: Project) => generalReadOnly ? (
          <div className="text-xs space-y-0.5">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm bg-gantt-montaje" />
              {format(parseISO(p.fechaMontajeInicio), "dd/MM", { locale: es })}
            </div>
            <div className="text-muted-foreground pl-3">
              → {format(parseISO(p.fechaMontajeFin), "dd/MM", { locale: es })}
            </div>
          </div>
        ) : (
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
              <div className="text-xs space-y-0.5">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-sm bg-gantt-montaje" />
                  {format(parseISO(p.fechaMontajeInicio), "dd/MM", { locale: es })}
                </div>
                <div className="text-muted-foreground pl-3">
                  → {format(parseISO(p.fechaMontajeFin), "dd/MM", { locale: es })}
                </div>
              </div>
            }
          />
        );
      case "fechaEjecucion":
        return (p: Project) => generalReadOnly ? (
          <div className="text-xs space-y-0.5">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm bg-gantt-ejecucion" />
              {format(parseISO(p.fechaEjecucionInicio), "dd/MM", { locale: es })}
            </div>
            <div className="text-muted-foreground pl-3">
              → {format(parseISO(p.fechaEjecucionFin), "dd/MM", { locale: es })}
            </div>
          </div>
        ) : (
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
              <div className="text-xs space-y-0.5">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-sm bg-gantt-ejecucion" />
                  {format(parseISO(p.fechaEjecucionInicio), "dd/MM", { locale: es })}
                </div>
                <div className="text-muted-foreground pl-3">
                  → {format(parseISO(p.fechaEjecucionFin), "dd/MM", { locale: es })}
                </div>
              </div>
            }
          />
        );
      case "fechaDesmontaje":
        return (p: Project) => generalReadOnly ? (
          p.fechaDesmontajeInicio && p.fechaDesmontajeFin ? (
            <div className="text-xs space-y-0.5">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm bg-gantt-desmontaje" />
                {format(parseISO(p.fechaDesmontajeInicio), "dd/MM", { locale: es })}
              </div>
              <div className="text-muted-foreground pl-3">
                → {format(parseISO(p.fechaDesmontajeFin), "dd/MM", { locale: es })}
              </div>
            </div>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )
        ) : (
          <DateTimeRangeEditor
            type="desmontaje"
            value={{
              fechaInicio: p.fechaDesmontajeInicio || "",
              fechaFin: p.fechaDesmontajeFin || "",
              horaInicio: p.horaDesmontajeInicio || "",
              horaFin: p.horaDesmontajeFin || "",
            }}
            onChange={(value) => {
              updateProjectMultiple(p.id, {
                fechaDesmontajeInicio: value.fechaInicio,
                fechaDesmontajeFin: value.fechaFin,
                horaDesmontajeInicio: value.horaInicio,
                horaDesmontajeFin: value.horaFin,
              });
            }}
            displayValue={
              p.fechaDesmontajeInicio && p.fechaDesmontajeFin ? (
                <div className="text-xs space-y-0.5">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm bg-gantt-desmontaje" />
                    {format(parseISO(p.fechaDesmontajeInicio), "dd/MM", { locale: es })}
                  </div>
                  <div className="text-muted-foreground pl-3">
                    → {format(parseISO(p.fechaDesmontajeFin), "dd/MM", { locale: es })}
                  </div>
                </div>
              ) : (
                <span className="text-muted-foreground text-xs hover:text-primary cursor-pointer">+ Agregar</span>
              )
            }
          />
        );
      case "estado":
        return (p: Project) => generalReadOnly ? (
          <Badge variant="outline" className="text-[10px]">{p.estado.replace(/_/g, ' ')}</Badge>
        ) : (
          <StatusSelect
            value={p.estado}
            onChange={(value) => updateProject(p.id, "estado", value)}
          />
        );
      case "ordenCompra":
        return (p: Project) => generalReadOnly ? (
          <span className="text-xs text-muted-foreground">{((p as any).ordenesCompra || []).length || "—"}</span>
        ) : (
          <div className="flex items-center gap-1">
            <AttachmentButton
              attachments={(p as any).ordenesCompra || []}
              onAttachmentsChange={(attachments) => updateProject(p.id, "ordenesCompra", attachments)}
              multiple={false}
              projectId={p.id}
              fieldName="ordenesCompra"
            />
            <PurchaseOrderUpload
              currentIngresoBruto={(p as any).ingresoBruto}
              currentIngresoTotal={(p as any).ingresoTotal}
              projectId={p.id}
              onDataExtracted={(ingresoBruto, ingresoTotal, inventarioItems) => {
                // Merge new inventory items with existing ones
                const existingInventario = (p as any).inventario || [];
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
          </div>
        );
      case "notas":
        return (p: Project) => (
          <div className="flex items-center gap-1 max-w-[200px]">
            <EditableCell
              value={p.notas}
              type="text"
              onChange={(value) => updateProject(p.id, "notas", value)}
              className="truncate text-xs flex-1 min-w-0"
              placeholder="Agregar nota"
              disabled={generalReadOnly}
            />
            {p.notas && p.notas.trim() && (
              <button
                onClick={() => setNotaExpandida({ evento: p.evento, nota: p.notas })}
                className="shrink-0 p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Ver nota completa"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        );
      default:
        return (p: Project) => generalReadOnly ? (
          <span className="text-sm truncate">{(p as any)[colConfig.key] || "-"}</span>
        ) : (
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
    width: "240px",
    render: (p: Project) => (
      <div className="flex gap-1 items-center">
        {p.isDeleted && (
          <Badge variant="destructive" className="text-[10px] px-1 py-0 mr-1">
            ELIMINADO
          </Badge>
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-6 px-2 text-[10px]"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/panel-directivo?proyecto=${p.id}`);
          }}
        >
          Directivo
          <ExternalLink className="h-2.5 w-2.5 ml-1" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-6 px-2 text-[10px]"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/panel-operaciones?proyecto=${p.id}`);
          }}
        >
          Ops
          <ExternalLink className="h-2.5 w-2.5 ml-1" />
        </Button>
      </div>
    ),
  };

  // Build columns - direct calculation for immediate updates
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
          title="Panel General"
          description="Vista general de proyectos y variables SSOT"
          panelLinks={[
            { label: "Directivo", to: "/panel-directivo" },
            { label: "Operaciones", to: "/panel-operaciones" },
          ]}
          actions={
            isAdmin && (
              <Button variant="outline" size="sm" onClick={initializeColumns}>
                <Settings className="h-4 w-4 mr-2" />
                Gestionar Columnas
              </Button>
            )
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

        <Tabs defaultValue="matriz" className="space-y-4">
          {/* Mobile-optimized controls: toggle visible without scroll */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Toggle always visible first */}
            <div className="flex items-center gap-3 flex-wrap">
              <TabsList className="w-full sm:w-auto">
                <TabsTrigger value="matriz" className="flex-1 sm:flex-none">Matriz</TabsTrigger>
                <TabsTrigger value="gantt" className="flex-1 sm:flex-none">Gantt</TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-2">
                <Switch
                  id="show-deleted-general"
                  checked={showDeleted}
                  onCheckedChange={setShowDeleted}
                />
                <Label htmlFor="show-deleted-general" className="text-sm text-muted-foreground cursor-pointer whitespace-nowrap">
                  Mostrar eliminados
                </Label>
              </div>
              <Button
                variant={montajeSort ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  if (!montajeSort) setMontajeSort("asc");
                  else if (montajeSort === "asc") setMontajeSort("desc");
                  else setMontajeSort(null);
                }}
                className="h-9 text-xs whitespace-nowrap gap-1.5"
                title={montajeSort === "asc" ? "Montaje: Más antiguo primero" : montajeSort === "desc" ? "Montaje: Más reciente primero" : "Ordenar por Montaje"}
              >
                {montajeSort === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : montajeSort === "desc" ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5" />}
                Montaje
              </Button>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>

          <TabsContent value="matriz" className="mt-4">
            <div className="panel-card">
              <MatrixTable
                key={`table-${allColumnConfigs.map(c => `${c.key}-${c.visible}-${c.order}`).join('_')}`}
                data={filteredProjects}
                columns={columns}
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
        </Tabs>

        <ColumnManagerDialog
          open={columnManagerOpen}
          onOpenChange={setColumnManagerOpen}
          columns={managedColumns.length > 0 ? managedColumns : defaultColumns}
          onColumnsChange={setManagedColumns}
          panelName="Panel General"
          readOnly={!canModifyStructure}
        />

        {/* Dialog para ver nota completa */}
        <Dialog open={!!notaExpandida} onOpenChange={(open) => !open && setNotaExpandida(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm">Nota — {notaExpandida?.evento}</DialogTitle>
            </DialogHeader>
            <p className="text-sm whitespace-pre-wrap text-foreground/80 max-h-[60vh] overflow-y-auto">
              {notaExpandida?.nota}
            </p>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default PanelGeneral;
