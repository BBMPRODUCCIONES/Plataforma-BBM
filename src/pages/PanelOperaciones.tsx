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
import { EmpleadoAutocomplete } from "@/components/EmpleadoAutocomplete";
import { ColumnManagerDialog, ColumnConfig } from "@/components/ColumnManagerDialog";
import { useUserRole } from "@/hooks/useUserRole";
import { mockProjects } from "@/data/mockData";
import { Project, PersonalItem, InventarioItem, ProjectStatus, CalendarViewMode } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Users, Package, FileText, FileDown, Settings, Plus } from "lucide-react";
import { format, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";
import { printPersonal, printInventario, printCotizaciones, printPersonalYInventario } from "@/utils/pdfGenerator";

const PanelOperaciones = () => {
  const navigate = useNavigate();
  const { canEditStructure } = useUserRole();
  const [searchTerm, setSearchTerm] = useState("");
  const [projects, setProjects] = useState<Project[]>(mockProjects);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [highlightedProjectId, setHighlightedProjectId] = useState<string | null>(null);
  const [columnManagerOpen, setColumnManagerOpen] = useState(false);
  const [managedColumns, setManagedColumns] = useState<ColumnConfig[]>([]);
  
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date } | undefined>();
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "todos">("todos");

  const updateProject = (projectId: string, field: string, value: any) => {
    setProjects(projects.map(proj =>
      proj.id === projectId ? { ...proj, [field]: value } : proj
    ));
  };

  const handleColumnsChange = (newColumns: ColumnConfig[]) => {
    // Create new array to ensure React detects the change
    setManagedColumns([...newColumns]);
  };

  // Define base columns with their configurations (same pattern as PanelDirectivo)
  const baseColumnDefs: ColumnConfig[] = useMemo(() => [
    { key: "centroCostos", header: "CC", type: "text" as CellType, width: "100px", visible: true, isCustom: false, order: 0 },
    { key: "numFactura", header: "#Factura", type: "text" as CellType, width: "80px", visible: true, isCustom: false, order: 1 },
    { key: "cliente", header: "Cliente", type: "text" as CellType, width: "150px", visible: true, isCustom: false, order: 2 },
    { key: "avanzada", header: "Avanzada", type: "select" as CellType, width: "130px", visible: true, isCustom: false, order: 3, options: ["No se hizo", "Se hizo", "No es necesario"] },
    { key: "fechaMontaje", header: "Montaje", type: "date" as CellType, width: "110px", visible: true, isCustom: false, order: 4 },
    { key: "fechaEjecucion", header: "Ejecución", type: "date" as CellType, width: "110px", visible: true, isCustom: false, order: 5 },
    { key: "estado", header: "Estado", type: "select" as CellType, width: "130px", visible: true, isCustom: false, order: 6 },
    { key: "jefeOperaciones", header: "Jefe Ops", type: "text" as CellType, width: "120px", visible: true, isCustom: false, order: 7 },
    { key: "aCargoDe", header: "A Cargo", type: "text" as CellType, width: "100px", visible: true, isCustom: false, order: 8 },
    { key: "productor", header: "Productor", type: "text" as CellType, width: "110px", visible: true, isCustom: false, order: 9 },
    { key: "ubicacion", header: "Ubicación", type: "text" as CellType, width: "150px", visible: true, isCustom: false, order: 10 },
    { key: "formatoPreproduccion", header: "Formato", type: "file" as CellType, width: "80px", visible: true, isCustom: false, order: 11 },
    { key: "personal", header: "Personal", type: "text" as CellType, width: "80px", visible: true, isCustom: false, order: 12 },
    { key: "cotizacionProveedor", header: "Cot. Prov", type: "file" as CellType, width: "80px", visible: true, isCustom: false, order: 13 },
    { key: "ordenCompraOCR", header: "OC + OCR", type: "file" as CellType, width: "120px", visible: true, isCustom: false, order: 14 },
    { key: "notas", header: "Notas", type: "text" as CellType, width: "150px", visible: true, isCustom: false, order: 15 },
    { key: "inventario", header: "Inventario", type: "text" as CellType, width: "80px", visible: true, isCustom: false, order: 16 },
    { key: "panelGeneral", header: "Panel", type: "text" as CellType, width: "80px", visible: true, isCustom: false, order: 17 },
  ], []);

  // Get all columns (base + managed) - use direct calculation for immediate updates
  const allColumnConfigs = managedColumns.length > 0 ? managedColumns : baseColumnDefs;

  // Initialize managed columns if empty
  const initializeColumns = () => {
    if (managedColumns.length === 0) {
      setManagedColumns(baseColumnDefs);
    }
    setColumnManagerOpen(true);
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

  // Function to get render for each column type
  const getColumnRender = (col: ColumnConfig) => {
    return (p: Project) => {
      switch (col.key) {
        case "centroCostos":
          return (
            <EditableCell
              value={p.centroCostos}
              type="text"
              onChange={(value) => updateProject(p.id, "centroCostos", value)}
              className="font-mono"
            />
          );
        case "numFactura":
          return (
            <EditableCell
              value={p.numFactura}
              type="text"
              onChange={(value) => updateProject(p.id, "numFactura", value)}
              className="font-mono"
            />
          );
        case "cliente":
          return (
            <ClienteAutocomplete
              value={p.cliente}
              onChange={(value) => updateProject(p.id, "cliente", value)}
            />
          );
        case "avanzada":
          return (
            <AvanzadaSelect
              value={p.avanzada}
              onChange={(value) => updateProject(p.id, "avanzada", value)}
            />
          );
        case "fechaMontaje":
          return (
            <DateTimeRangeEditor
              type="montaje"
              value={{
                fechaInicio: p.fechaMontajeInicio,
                fechaFin: p.fechaMontajeFin,
                horaInicio: p.horaMontajeInicio,
                horaFin: p.horaMontajeFin,
              }}
              onChange={(value) => {
                setProjects(prev => prev.map(proj =>
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
                <div className="text-xs flex items-center gap-1">
                  <div className="w-2 h-2 rounded-sm bg-gantt-montaje" />
                  {format(parseISO(p.fechaMontajeInicio), "dd/MM")}
                </div>
              }
            />
          );
        case "fechaEjecucion":
          return (
            <DateTimeRangeEditor
              type="ejecucion"
              value={{
                fechaInicio: p.fechaEjecucionInicio,
                fechaFin: p.fechaEjecucionFin,
                horaInicio: p.horaEjecucionInicio,
                horaFin: p.horaEjecucionFin,
              }}
              onChange={(value) => {
                setProjects(prev => prev.map(proj =>
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
                <div className="text-xs flex items-center gap-1">
                  <div className="w-2 h-2 rounded-sm bg-gantt-ejecucion" />
                  {format(parseISO(p.fechaEjecucionInicio), "dd/MM")}
                </div>
              }
            />
          );
        case "estado":
          return (
            <StatusSelect
              value={p.estado}
              onChange={(value) => updateProject(p.id, "estado", value)}
            />
          );
        case "jefeOperaciones":
          return (
            <EditableCell
              value={p.jefeOperaciones}
              type="text"
              onChange={(value) => updateProject(p.id, "jefeOperaciones", value)}
            />
          );
        case "aCargoDe":
          return (
            <EditableCell
              value={p.aCargoDe}
              type="text"
              onChange={(value) => updateProject(p.id, "aCargoDe", value)}
            />
          );
        case "productor":
          return (
            <EditableCell
              value={p.productor}
              type="text"
              onChange={(value) => updateProject(p.id, "productor", value)}
            />
          );
        case "ubicacion":
          return (
            <EditableCell
              value={p.ubicacion}
              type="text"
              onChange={(value) => updateProject(p.id, "ubicacion", value)}
            />
          );
        case "formatoPreproduccion":
          return (
            <FileUploadButton
              attachments={p.formatoPreproduccion || []}
              onAttachmentsChange={(attachments) => updateProject(p.id, "formatoPreproduccion", attachments)}
              multiple
            />
          );
        case "personal":
          return (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedProject(p);
              }}
            >
              <Users className="h-3 w-3 mr-1" />
              {p.personal?.length || 0}
            </Button>
          );
        case "cotizacionProveedor":
          return (
            <FileUploadButton
              attachments={p.cotizacionesProveedor || []}
              onAttachmentsChange={(attachments) => updateProject(p.id, "cotizacionesProveedor", attachments)}
              multiple
            />
          );
        case "ordenCompraOCR":
          return (
            <div className="flex items-center gap-1">
              <FileUploadButton
                attachments={(p as any).ordenesCompra || []}
                onAttachmentsChange={(attachments) => updateProject(p.id, "ordenesCompra", attachments)}
                multiple={false}
              />
              <PurchaseOrderUpload
                currentIngresoBruto={p.ingresoBruto}
                currentIngresoTotal={p.ingresoTotal}
                onDataExtracted={(ingresoBruto, ingresoTotal) => {
                  setProjects(prev => prev.map(proj =>
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
            </div>
          );
        case "notas":
          return (
            <EditableCell
              value={p.notas}
              type="text"
              onChange={(value) => updateProject(p.id, "notas", value)}
            />
          );
        case "inventario":
          return (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedProject(p);
              }}
            >
              <Package className="h-3 w-3 mr-1" />
              {p.inventario?.length || 0}
            </Button>
          );
        case "panelGeneral":
          return (
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/panel-general?proyecto=${p.id}`);
              }}
            >
              General
            </Button>
          );
        default:
          // Custom columns - use EditableCell with appropriate type
          const value = (p as any)[col.key];
          return (
            <EditableCell
              value={value}
              type={col.type || "text"}
              options={col.options}
              onChange={(newValue) => updateProject(p.id, col.key, newValue)}
            />
          );
      }
    };
  };

  // Build columns dynamically from allColumnConfigs - direct calculation for immediate updates
  const columns = allColumnConfigs
    .filter(col => col.visible !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(col => ({
      key: col.key,
      header: col.header,
      width: col.width,
      render: getColumnRender(col),
    }));

  const updatePersonalItem = (projectId: string, personalId: string, field: string, value: any) => {
    setProjects(prevProjects => prevProjects.map(proj => {
      if (proj.id !== projectId) return proj;
      const updatedPersonal = (proj.personal || []).map(p => {
        if (p.id !== personalId) return p;
        const updated = { ...p, [field]: value };
        // Si el tipo cambia a Transporte y no hay ruta, agregar placeholder
        if (field === 'tipoPersonal' && value === 'Transporte' && !p.rutaTransporte) {
          updated.notas = p.notas || 'Agregar ruta realizada';
        }
        return updated;
      });
      return { ...proj, personal: updatedPersonal };
    }));
  };

  const updateInventarioItem = (projectId: string, inventarioId: string, field: string, value: any) => {
    setProjects(prevProjects => prevProjects.map(proj => {
      if (proj.id !== projectId) return proj;
      const updatedInventario = (proj.inventario || []).map(i =>
        i.id === inventarioId ? { ...i, [field]: value } : i
      );
      return { ...proj, inventario: updatedInventario };
    }));
  };

  // Get current project data from state (not stale selectedProject)
  const currentProjectData = useMemo(() => {
    return selectedProject ? projects.find(p => p.id === selectedProject.id) : null;
  }, [selectedProject, projects]);

  const personalColumns = useMemo(() => {
    const projectId = selectedProject?.id;
    const hasTransporte = currentProjectData?.personal?.some(p => p.tipoPersonal === "Transporte");
    
    const basePersonalCols = [
      { 
        key: "tipoPersonal", 
        header: "Tipo", 
        width: "120px",
        render: (p: PersonalItem) => (
          <EditableCell
            value={p.tipoPersonal}
            type="select"
            options={["BBM", "Proveedor", "Transporte"]}
            onChange={(value) => {
              if (projectId) {
                updatePersonalItem(projectId, p.id, "tipoPersonal", value);
                // Clear nombre when switching to BBM (must select from list)
                if (value === "BBM") {
                  updatePersonalItem(projectId, p.id, "nombre", "");
                }
              }
            }}
          />
        ),
      },
      { 
        key: "nombre", 
        header: "Personal", 
        width: "180px",
        render: (p: PersonalItem) => (
          <EmpleadoAutocomplete
            value={p.nombre}
            tipoPersonal={p.tipoPersonal || "BBM"}
            onChange={(value) => projectId && updatePersonalItem(projectId, p.id, "nombre", value)}
          />
        ),
      },
      { 
        key: "cargo", 
        header: "Cargo", 
        width: "120px",
        render: (p: PersonalItem) => (
          <EditableCell
            value={p.cargo}
            type="text"
            onChange={(value) => projectId && updatePersonalItem(projectId, p.id, "cargo", value)}
          />
        ),
      },
      { 
        key: "telefono", 
        header: "Teléfono", 
        width: "130px",
        render: (p: PersonalItem) => (
          <EditableCell
            value={p.telefono}
            type="text"
            onChange={(value) => projectId && updatePersonalItem(projectId, p.id, "telefono", value)}
          />
        ),
      },
      { 
        key: "notas", 
        header: "Notas", 
        width: "200px",
        render: (p: PersonalItem) => (
          <EditableCell
            value={p.notas}
            type="text"
            placeholder="-"
            onChange={(value) => projectId && updatePersonalItem(projectId, p.id, "notas", value)}
          />
        ),
      },
    ];

    // Always show Ruta Transporte column when there's transport personnel
    if (hasTransporte) {
      basePersonalCols.push({
        key: "rutaTransporte",
        header: "Ruta Realizada *",
        width: "200px",
        render: (p: PersonalItem) => (
          p.tipoPersonal === "Transporte" ? (
            <EditableCell
              value={p.rutaTransporte}
              type="text"
              placeholder="Ruta obligatoria..."
              onChange={(value) => projectId && updatePersonalItem(projectId, p.id, "rutaTransporte", value)}
              className={!p.rutaTransporte ? "border-destructive/50" : ""}
            />
          ) : <span className="text-xs text-muted-foreground">-</span>
        ),
      });
    }
    
    return basePersonalCols;
  }, [selectedProject?.id, currentProjectData?.personal]);

  const inventarioColumns = useMemo(() => {
    const projectId = selectedProject?.id;
    
    return [
      { 
        key: "nombreMaterial", 
        header: "Material", 
        width: "180px",
        render: (i: InventarioItem) => (
          <EditableCell
            value={i.nombreMaterial}
            type="text"
            onChange={(value) => projectId && updateInventarioItem(projectId, i.id, "nombreMaterial", value)}
          />
        ),
      },
      {
        key: "cantidad",
        header: "Cantidad",
        width: "100px",
        render: (i: InventarioItem) => (
          <div className="flex items-center gap-1">
            <EditableCell
              value={i.cantidad}
              type="number"
              onChange={(value) => projectId && updateInventarioItem(projectId, i.id, "cantidad", value)}
              className="w-14"
            />
            <EditableCell
              value={i.unidad}
              type="text"
              onChange={(value) => projectId && updateInventarioItem(projectId, i.id, "unidad", value)}
              className="w-16"
              placeholder="uds"
            />
          </div>
        ),
      },
      { 
        key: "observaciones", 
        header: "Observaciones", 
        width: "200px",
        render: (i: InventarioItem) => (
          <EditableCell
            value={i.observaciones}
            type="text"
            onChange={(value) => projectId && updateInventarioItem(projectId, i.id, "observaciones", value)}
          />
        ),
      },
      {
        key: "recibido",
        header: "Recibido",
        width: "80px",
        render: (i: InventarioItem) => (
          <EditableCell
            value={i.recibido}
            type="boolean"
            onChange={(value) => projectId && updateInventarioItem(projectId, i.id, "recibido", value)}
          />
        ),
      },
      { 
        key: "notasAdicionales", 
        header: "Notas Adicionales", 
        width: "180px",
        render: (i: InventarioItem) => (
          <EditableCell
            value={i.notasAdicionales}
            type="text"
            onChange={(value) => projectId && updateInventarioItem(projectId, i.id, "notasAdicionales", value)}
          />
        ),
      },
    ];
  }, [selectedProject?.id]);

  return (
    <Layout>
      <div className="space-y-6">
        <PanelHeader
          title="Panel de Operaciones"
          description="Gestión operativa, personal e inventario"
          panelLinks={[
            { label: "Directivo", to: "/panel-directivo" },
            { label: "General", to: "/panel-general" },
            { label: "Proveedores", to: "/proveedores" },
          ]}
          actions={
            canEditStructure() && (
              <Button variant="outline" size="sm" onClick={initializeColumns}>
                <Settings className="h-4 w-4 mr-2" />
                Gestionar Columnas
              </Button>
            )
          }
        />

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
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="matriz">Matriz Operaciones</TabsTrigger>
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
                data={filteredProjects}
                columns={columns}
                onRowClick={(p) => setSelectedProject(p)}
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

        {/* Project Detail Dialog */}
        <Dialog open={!!selectedProject} onOpenChange={() => setSelectedProject(null)}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedProject?.evento}
                {selectedProject && (
                  <StatusSelect
                    value={selectedProject.estado}
                    onChange={(value) => updateProject(selectedProject.id, "estado", value)}
                  />
                )}
              </DialogTitle>
            </DialogHeader>

            {selectedProject && currentProjectData && (
              <div className="space-y-6 mt-4">
                {/* Unified PDF Button */}
                <div className="flex justify-end">
                  <Button variant="default" onClick={() => printPersonalYInventario(currentProjectData)}>
                    <FileDown className="h-4 w-4 mr-2" />
                    Generar PDF (Personal + Inventario)
                  </Button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <span className="text-xs text-muted-foreground">Cliente</span>
                    <p className="text-sm font-medium">{currentProjectData.cliente}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Centro Costos</span>
                    <p className="text-sm font-mono">{currentProjectData.centroCostos}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Jefe Operaciones</span>
                    <p className="text-sm">{currentProjectData.jefeOperaciones || "-"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Ubicación</span>
                    <p className="text-sm">{currentProjectData.ubicacion || "-"}</p>
                  </div>
                </div>

                <Card>
                  <CardHeader className="py-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Personal ({(currentProjectData.personal || []).length})
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newPersonal: PersonalItem = {
                          id: `p${Date.now()}`,
                          nombre: "",
                          cargo: "",
                          telefono: "",
                          tipoPersonal: "BBM",
                          notas: "",
                        };
                        setProjects(prev => prev.map(proj =>
                          proj.id === currentProjectData.id
                            ? { ...proj, personal: [...(proj.personal || []), newPersonal] }
                            : proj
                        ));
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Agregar Personal
                    </Button>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {(currentProjectData.personal || []).length > 0 ? (
                      <MatrixTable
                        data={currentProjectData.personal || []}
                        columns={personalColumns}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">No hay personal asignado. Haga clic en "Agregar Personal" para comenzar.</p>
                    )}
                    <div className="mt-3 p-2 bg-muted/30 rounded text-[10px] text-muted-foreground">
                      <strong>Nota:</strong> Si selecciona Tipo = BBM, solo podrá elegir empleados registrados en el módulo "Creación de Empleados".
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="py-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Inventario ({(currentProjectData.inventario || []).length})
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newInventario: InventarioItem = {
                          id: `i${Date.now()}`,
                          nombreMaterial: "",
                          cantidad: 1,
                          unidad: "unidades",
                          observaciones: "",
                          recibido: false,
                          notasAdicionales: "",
                        };
                        setProjects(prev => prev.map(proj =>
                          proj.id === currentProjectData.id
                            ? { ...proj, inventario: [...(proj.inventario || []), newInventario] }
                            : proj
                        ));
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Agregar Material
                    </Button>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {(currentProjectData.inventario || []).length > 0 ? (
                      <MatrixTable
                        data={currentProjectData.inventario || []}
                        columns={inventarioColumns}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">No hay inventario registrado. Haga clic en "Agregar Material" para comenzar.</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Cotizaciones Proveedor
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground">
                      No hay cotizaciones adjuntas
                    </p>
                  </CardContent>
                </Card>

                {currentProjectData.notas && (
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">Notas</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm">{currentProjectData.notas}</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <ColumnManagerDialog
          open={columnManagerOpen}
          onOpenChange={setColumnManagerOpen}
          columns={allColumnConfigs}
          onColumnsChange={handleColumnsChange}
          panelName="Panel Operaciones"
        />
      </div>
    </Layout>
  );
};

export default PanelOperaciones;
