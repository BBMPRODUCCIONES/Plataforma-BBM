import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { PanelHeader } from "@/components/PanelHeader";
import { MatrixTable } from "@/components/MatrixTable";
import { StatusSelect } from "@/components/StatusSelect";
import { GanttChart } from "@/components/GanttChart";
import { CalendarFilter } from "@/components/CalendarFilter";
import { FileUploadButton } from "@/components/FileUpload";
import { PurchaseOrderUpload } from "@/components/PurchaseOrderUpload";
import { AvanzadaSelect } from "@/components/AvanzadaSelect";
import { DateTimeRangeEditor } from "@/components/DateTimeRangeEditor";
import { EditableCell, CellType } from "@/components/EditableCell";
import { ClienteAutocomplete } from "@/components/ClienteAutocomplete";
import { ColumnManagerDialog, ColumnConfig } from "@/components/ColumnManagerDialog";
import { usePersistedColumns } from "@/hooks/usePersistedColumns";
import { useUserRole } from "@/hooks/useUserRole";
import { mockProjects } from "@/data/mockData";
import { Project, ProjectStatus, CalendarViewMode } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, ExternalLink, Settings } from "lucide-react";
import { format, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";

const PanelGeneral = () => {
  const navigate = useNavigate();
  const { canEditStructure, role } = useUserRole();
  const isAdmin = role?.toLowerCase() === "administrador";
  const [searchTerm, setSearchTerm] = useState("");
  const [projects, setProjects] = useState<Project[]>(mockProjects);
  const [highlightedProjectId, setHighlightedProjectId] = useState<string | null>(null);
  const [columnManagerOpen, setColumnManagerOpen] = useState(false);
  // Initialize with base columns - persisted to localStorage
  const defaultColumns: ColumnConfig[] = [
    { key: "centroCostos", header: "Centro de Costos", type: "text" as CellType, width: "130px", visible: true, isCustom: false, order: 0 },
    { key: "numFactura", header: "#Factura", type: "text" as CellType, width: "100px", visible: true, isCustom: false, order: 1 },
    { key: "cliente", header: "Cliente", type: "text" as CellType, width: "200px", visible: true, isCustom: false, order: 2 },
    { key: "avanzada", header: "Avanzada", type: "select" as CellType, width: "130px", visible: true, isCustom: false, order: 3, options: ["No se hizo", "Se hizo", "No es necesario"] },
    { key: "fechaMontaje", header: "Montaje", type: "date" as CellType, width: "130px", visible: true, isCustom: false, order: 4 },
    { key: "fechaEjecucion", header: "Ejecución", type: "date" as CellType, width: "130px", visible: true, isCustom: false, order: 5 },
    { key: "estado", header: "Estado", type: "select" as CellType, width: "140px", visible: true, isCustom: false, order: 6 },
    { key: "jefeOperaciones", header: "Jefe Operaciones", type: "text" as CellType, width: "150px", visible: true, isCustom: false, order: 7 },
    { key: "aCargoDe", header: "A Cargo De", type: "text" as CellType, width: "130px", visible: true, isCustom: false, order: 8 },
    { key: "productor", header: "Productor", type: "text" as CellType, width: "130px", visible: true, isCustom: false, order: 9 },
    { key: "ubicacion", header: "Ubicación", type: "text" as CellType, width: "200px", visible: true, isCustom: false, order: 10 },
    { key: "notas", header: "Notas", type: "text" as CellType, width: "200px", visible: true, isCustom: false, order: 11 },
    { key: "panelDirectivo", header: "Panel Directivo", type: "text" as CellType, width: "100px", visible: true, isCustom: false, order: 12 },
  ];
  const [managedColumns, setManagedColumns] = usePersistedColumns("panel-general-columns", defaultColumns);
  
  // Calendar filter state
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date } | undefined>();
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "todos">("todos");

  const updateProject = (projectId: string, field: string, value: any) => {
    setProjects(prevProjects => prevProjects.map(proj =>
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

  const handleGanttProjectClick = (projectId: string) => {
    setHighlightedProjectId(projectId);
    const tabTrigger = document.querySelector('[value="matriz"]') as HTMLElement;
    if (tabTrigger) tabTrigger.click();
  };

  // Define base columns
  const baseColumnDefs: ColumnConfig[] = useMemo(() => [
    { key: "centroCostos", header: "Centro de Costos", type: "text" as CellType, width: "130px", visible: true, isCustom: false, order: 0 },
    { key: "numFactura", header: "#Factura", type: "text" as CellType, width: "100px", visible: true, isCustom: false, order: 1 },
    { key: "cliente", header: "Cliente", type: "text" as CellType, width: "200px", visible: true, isCustom: false, order: 2 },
    { key: "avanzada", header: "Avanzada", type: "select" as CellType, width: "130px", visible: true, isCustom: false, order: 3 },
    { key: "fechaMontaje", header: "Montaje", type: "date" as CellType, width: "130px", visible: true, isCustom: false, order: 4 },
    { key: "fechaEjecucion", header: "Ejecución", type: "date" as CellType, width: "130px", visible: true, isCustom: false, order: 5 },
    { key: "estado", header: "Estado", type: "select" as CellType, width: "130px", visible: true, isCustom: false, order: 6 },
    { key: "ordenCompra", header: "OC + OCR", type: "file" as CellType, width: "130px", visible: true, isCustom: false, order: 7 },
  ], []);

  // Get all columns - direct calculation for immediate updates
  const allColumnConfigs = managedColumns.length > 0 ? managedColumns : baseColumnDefs;

  // Handle columns change - force new array reference
  const handleColumnsChange = (newColumns: ColumnConfig[]) => {
    console.log('[PanelGeneral] Received column changes:', newColumns.length, newColumns);
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
        return (p: Project) => (
          <EditableCell
            value={p.centroCostos}
            type="text"
            onChange={(value) => updateProject(p.id, "centroCostos", value)}
            className="font-mono bg-muted px-2 py-1 rounded"
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
          <div>
            <ClienteAutocomplete
              value={p.cliente}
              onChange={(value) => updateProject(p.id, "cliente", value)}
            />
            <div className="text-[10px] text-muted-foreground truncate max-w-[180px]">
              {p.evento}
            </div>
          </div>
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
              setProjects(prevProjects => prevProjects.map(proj =>
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
              setProjects(prevProjects => prevProjects.map(proj =>
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
      case "estado":
        return (p: Project) => (
          <StatusSelect
            value={p.estado}
            onChange={(value) => updateProject(p.id, "estado", value)}
          />
        );
      case "ordenCompra":
        return (p: Project) => (
          <div className="flex items-center gap-1">
            <FileUploadButton
              attachments={(p as any).ordenesCompra || []}
              onAttachmentsChange={(attachments) => updateProject(p.id, "ordenesCompra", attachments)}
              multiple={false}
            />
            <PurchaseOrderUpload
              currentIngresoBruto={(p as any).ingresoBruto}
              currentIngresoTotal={(p as any).ingresoTotal}
              onDataExtracted={(ingresoBruto, ingresoTotal) => {
                setProjects(prevProjects => prevProjects.map(proj =>
                  proj.id === p.id
                    ? {
                        ...proj,
                        ingresoBruto: ingresoBruto ?? (proj as any).ingresoBruto,
                        ingresoTotal: ingresoTotal ?? (proj as any).ingresoTotal,
                      }
                    : proj
                ));
              }}
            />
          </div>
        );
      default:
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
          Operaciones
          <ExternalLink className="h-2.5 w-2.5 ml-1" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-6 px-2 text-[10px]"
          onClick={(e) => {
            e.stopPropagation();
            navigate("/proveedores");
          }}
        >
          Proveedores
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
          viewMode={viewMode}
          selectedDate={selectedDate}
          dateRange={dateRange}
          statusFilter={statusFilter}
          onViewModeChange={setViewMode}
          onDateChange={setSelectedDate}
          onDateRangeChange={setDateRange}
          onStatusChange={setStatusFilter}
        />

        <Tabs defaultValue="matriz" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <TabsList>
              <TabsTrigger value="matriz">Matriz</TabsTrigger>
              <TabsTrigger value="gantt">Gantt</TabsTrigger>
            </TabsList>

            <div className="relative w-64">
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
        </Tabs>

        <ColumnManagerDialog
          open={columnManagerOpen}
          onOpenChange={setColumnManagerOpen}
          columns={managedColumns.length > 0 ? managedColumns : baseColumnDefs}
          onColumnsChange={handleColumnsChange}
          panelName="Panel General"
        />
      </div>
    </Layout>
  );
};

export default PanelGeneral;
