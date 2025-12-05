import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { PanelHeader } from "@/components/PanelHeader";
import { MatrixTable } from "@/components/MatrixTable";
import { StatusSelect } from "@/components/StatusSelect";
import { GanttChart } from "@/components/GanttChart";
import { CalendarFilter } from "@/components/CalendarFilter";
import { AttachmentButton, AttachmentManager } from "@/components/AttachmentManager";
import { PurchaseOrderUpload } from "@/components/PurchaseOrderUpload";
import { AvanzadaSelect } from "@/components/AvanzadaSelect";
import { DateTimeRangeEditor } from "@/components/DateTimeRangeEditor";
import { EditableCell, CellType } from "@/components/EditableCell";
import { ClienteAutocomplete } from "@/components/ClienteAutocomplete";
import { EmpleadoAutocomplete } from "@/components/EmpleadoAutocomplete";
import { ColumnManagerDialog, ColumnConfig } from "@/components/ColumnManagerDialog";
import { NotasGeneralesEditor } from "@/components/NotasGeneralesEditor";
import { usePersistedColumns } from "@/hooks/usePersistedColumns";
import { useUserRole } from "@/hooks/useUserRole";
import { useProjects } from "@/contexts/ProjectsContext";
import { Project, PersonalItem, InventarioItem, ProjectStatus, CalendarViewMode } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Users, Package, FileText, FileDown, Settings, Plus, StickyNote, Loader2 } from "lucide-react";
import { format, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";
import { printPersonal, printInventario, printCotizaciones, printPersonalYInventario } from "@/utils/pdfGenerator";
import { toast } from "sonner";

const PanelOperaciones = () => {
  const navigate = useNavigate();
  const { canEditStructure, role } = useUserRole();
  const { projects, loading, updateProject: contextUpdateProject, updateProjectMultiple } = useProjects();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [highlightedProjectId, setHighlightedProjectId] = useState<string | null>(null);
  const [columnManagerOpen, setColumnManagerOpen] = useState(false);
  // Initialize with base columns - persisted to localStorage
  const defaultColumns: ColumnConfig[] = [
    { key: "centroCostos", header: "CC", type: "text" as CellType, width: "100px", visible: true, isCustom: false, order: 0 },
    { key: "numFactura", header: "#Factura", type: "text" as CellType, width: "80px", visible: true, isCustom: false, order: 1 },
    { key: "cliente", header: "Cliente", type: "text" as CellType, width: "150px", visible: true, isCustom: false, order: 2 },
    { key: "evento", header: "Evento", type: "text" as CellType, width: "180px", visible: true, isCustom: false, order: 3 },
    { key: "avanzada", header: "Avanzada", type: "select" as CellType, width: "130px", visible: true, isCustom: false, order: 4, options: ["No se hizo", "Se hizo", "No es necesario"] },
    { key: "fechaMontaje", header: "Montaje", type: "date" as CellType, width: "110px", visible: true, isCustom: false, order: 5 },
    { key: "fechaEjecucion", header: "Ejecución", type: "date" as CellType, width: "110px", visible: true, isCustom: false, order: 6 },
    { key: "estado", header: "Estado", type: "select" as CellType, width: "130px", visible: true, isCustom: false, order: 7 },
    { key: "jefeOperaciones", header: "Jefe Ops", type: "text" as CellType, width: "120px", visible: true, isCustom: false, order: 8 },
    { key: "aCargoDe", header: "A Cargo", type: "text" as CellType, width: "100px", visible: true, isCustom: false, order: 9 },
    { key: "productor", header: "Productor", type: "text" as CellType, width: "110px", visible: true, isCustom: false, order: 10 },
    { key: "ubicacion", header: "Ubicación", type: "text" as CellType, width: "150px", visible: true, isCustom: false, order: 11 },
    { key: "formatoPreproduccion", header: "Formato", type: "file" as CellType, width: "80px", visible: true, isCustom: false, order: 12 },
    { key: "personal", header: "Personal", type: "text" as CellType, width: "80px", visible: true, isCustom: false, order: 13 },
    { key: "cotizacionProveedor", header: "Cot. Prov", type: "file" as CellType, width: "80px", visible: true, isCustom: false, order: 14 },
    { key: "ordenCompraOCR", header: "OC + OCR", type: "file" as CellType, width: "120px", visible: true, isCustom: false, order: 15 },
    { key: "notas", header: "Notas", type: "text" as CellType, width: "150px", visible: true, isCustom: false, order: 16 },
    { key: "inventario", header: "Inventario", type: "text" as CellType, width: "80px", visible: true, isCustom: false, order: 17 },
    { key: "panelGeneral", header: "Panel", type: "text" as CellType, width: "80px", visible: true, isCustom: false, order: 18 },
  ];
  const [managedColumns, setManagedColumns] = usePersistedColumns("panel-operaciones-columns", defaultColumns);
  
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date } | undefined>();
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "todos">("todos");

  // Local state for textareas to prevent "erasing" while typing
  const [localNotas, setLocalNotas] = useState("");
  const [localNotasProveedor, setLocalNotasProveedor] = useState("");
  const [localNotasImagenes, setLocalNotasImagenes] = useState<Array<{id: string; url: string; name: string}>>([]);

  // Sync local textarea state when project changes (not on every keystroke)
  useEffect(() => {
    if (selectedProject) {
      const project = projects.find(p => p.id === selectedProject.id);
      if (project) {
        setLocalNotas(project.notas || "");
        setLocalNotasProveedor((project as any).notasCotizacionProveedor || "");
        setLocalNotasImagenes((project as any).notasImagenes || []);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject?.id]);

  // Check if user is admin
  const isAdmin = role?.toLowerCase() === "administrador";

  const updateProject = (projectId: string, field: string, value: any) => {
    contextUpdateProject(projectId, field, value);
  };

  const handleColumnsChange = (newColumns: ColumnConfig[]) => {
    // Create new array to ensure React detects the change
    console.log('[PanelOperaciones] handleColumnsChange called with:', newColumns.length, 'columns');
    const copiedColumns = newColumns.map(col => ({ ...col }));
    setManagedColumns(copiedColumns);
  };

  // Debug: Log whenever managedColumns changes
  console.log('[PanelOperaciones] Current managedColumns count:', managedColumns.length);

  // Use managed columns directly (already initialized)
  const allColumnConfigs = managedColumns;

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
        case "evento":
          return (
            <EditableCell
              value={p.evento}
              type="text"
              onChange={(value) => updateProject(p.id, "evento", value)}
              className="font-medium"
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
                updateProjectMultiple(p.id, {
                  fechaMontajeInicio: value.fechaInicio,
                  fechaMontajeFin: value.fechaFin,
                  horaMontajeInicio: value.horaInicio,
                  horaMontajeFin: value.horaFin,
                });
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
                updateProjectMultiple(p.id, {
                  fechaEjecucionInicio: value.fechaInicio,
                  fechaEjecucionFin: value.fechaFin,
                  horaEjecucionInicio: value.horaInicio,
                  horaEjecucionFin: value.horaFin,
                });
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
            <AttachmentButton
              attachments={p.formatoPreproduccion || []}
              onAttachmentsChange={(attachments) => updateProject(p.id, "formatoPreproduccion", attachments)}
              multiple
              projectId={p.id}
              fieldName="formatoPreproduccion"
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
            <AttachmentButton
              attachments={p.cotizacionesProveedor || []}
              onAttachmentsChange={(attachments) => updateProject(p.id, "cotizacionesProveedor", attachments)}
              multiple
              projectId={p.id}
              fieldName="cotizacionesProveedor"
            />
          );
        case "ordenCompraOCR":
          return (
            <div className="flex items-center gap-1">
              <AttachmentButton
                attachments={(p as any).ordenesCompra || []}
                onAttachmentsChange={(attachments) => updateProject(p.id, "ordenesCompra", attachments)}
                multiple={false}
                projectId={p.id}
                fieldName="ordenesCompra"
              />
              <PurchaseOrderUpload
                currentIngresoBruto={p.ingresoBruto}
                currentIngresoTotal={p.ingresoTotal}
                onDataExtracted={(ingresoBruto, ingresoTotal) => {
                  updateProjectMultiple(p.id, {
                    ingresoBruto: ingresoBruto ?? undefined,
                    ingresoTotal: ingresoTotal ?? undefined,
                  });
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

  // Generate a unique key for the table to force re-renders when columns change
  const tableKey = `table-${allColumnConfigs.map(c => `${c.key}-${c.visible}-${c.order}`).join('_')}`;

  const updatePersonalItem = (projectId: string, personalId: string, field: string, value: any) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const updatedPersonal = (project.personal || []).map(p => {
      if (p.id !== personalId) return p;
      const updated = { ...p, [field]: value };
      if (field === 'tipoPersonal' && value === 'Transporte' && !p.rutaTransporte) {
        updated.notas = p.notas || 'Agregar ruta realizada';
      }
      return updated;
    });
    contextUpdateProject(projectId, 'personal', updatedPersonal);
  };

  const updateInventarioItem = (projectId: string, inventarioId: string, field: string, value: any) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const updatedInventario = (project.inventario || []).map(i =>
      i.id === inventarioId ? { ...i, [field]: value } : i
    );
    contextUpdateProject(projectId, 'inventario', updatedInventario);
  };

  // Get current project data from state (not stale selectedProject)
  const currentProjectData = useMemo(() => {
    return selectedProject ? projects.find(p => p.id === selectedProject.id) : null;
  }, [selectedProject, projects]);

  const personalColumns = useMemo(() => {
    const projectId = selectedProject?.id;
    const hasTransporte = currentProjectData?.personal?.some(p => p.tipoPersonal === "Transporte");
    const hasProveedorOrTransporte = currentProjectData?.personal?.some(p => p.tipoPersonal === "Proveedor" || p.tipoPersonal === "Transporte");
    
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
                // Clear nombre and empleadoId when switching to BBM (must select from list)
                if (value === "BBM") {
                  updatePersonalItem(projectId, p.id, "nombre", "");
                  updatePersonalItem(projectId, p.id, "empleadoId", undefined);
                }
                // Clear empleadoId when switching away from BBM
                if (value !== "BBM" && p.empleadoId) {
                  updatePersonalItem(projectId, p.id, "empleadoId", undefined);
                }
              }
            }}
          />
        ),
      },
      { 
        key: "nombre", 
        header: "Personal", 
        width: "200px",
        render: (p: PersonalItem) => (
          <EmpleadoAutocomplete
            value={p.nombre}
            tipoPersonal={p.tipoPersonal || "BBM"}
            onChange={(value, empleadoId) => {
              if (projectId) {
                updatePersonalItem(projectId, p.id, "nombre", value);
                // Save empleadoId when selecting BBM employee
                if (empleadoId && p.tipoPersonal === "BBM") {
                  updatePersonalItem(projectId, p.id, "empleadoId", empleadoId);
                }
              }
            }}
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

    // Show Adjuntos column for Proveedor or Transporte
    if (hasProveedorOrTransporte) {
      basePersonalCols.push({
        key: "adjuntos",
        header: "Adjuntos",
        width: "100px",
        render: (p: PersonalItem) => (
          (p.tipoPersonal === "Proveedor" || p.tipoPersonal === "Transporte") ? (
            <AttachmentButton
              attachments={p.adjuntos || []}
              onAttachmentsChange={(attachments) => projectId && updatePersonalItem(projectId, p.id, "adjuntos", attachments)}
              multiple
              projectId={projectId || "general"}
              fieldName={`personal-${p.id}-adjuntos`}
            />
          ) : <span className="text-xs text-muted-foreground">-</span>
        ),
      });
    }
    
    return basePersonalCols;
  }, [selectedProject?.id, currentProjectData?.personal]);

  const inventarioColumns = useMemo(() => {
    // Use currentProjectData?.id to get fresh project ID
    const projectId = currentProjectData?.id;
    
    return [
      { 
        key: "nombreMaterial", 
        header: "Material", 
        width: "180px",
        render: (i: InventarioItem) => (
          <EditableCell
            value={i.nombreMaterial}
            type="text"
            placeholder="Nombre del material..."
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
            placeholder="Observaciones..."
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
            placeholder="Notas adicionales..."
            onChange={(value) => projectId && updateInventarioItem(projectId, i.id, "notasAdicionales", value)}
          />
        ),
      },
  ];
  }, [currentProjectData?.id, currentProjectData?.inventario]);

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
          title="Panel de Operaciones"
          description="Gestión operativa, personal e inventario"
          panelLinks={[
            { label: "Directivo", to: "/panel-directivo" },
            { label: "General", to: "/panel-general" },
            { label: "Proveedores", to: "/proveedores" },
          ]}
          actions={
            <Button variant="outline" size="sm" onClick={() => setColumnManagerOpen(true)}>
              <Settings className="h-4 w-4 mr-2" />
              Gestionar Columnas
            </Button>
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
                key={tableKey}
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
        <Dialog open={!!selectedProject} onOpenChange={(open) => {
          if (!open && selectedProject && currentProjectData) {
            // Save pending notes before closing
            if (localNotasProveedor !== (currentProjectData.notasCotizacionProveedor || "")) {
              updateProject(currentProjectData.id, "notasCotizacionProveedor", localNotasProveedor);
            }
            if (localNotas !== (currentProjectData.notas || "")) {
              updateProject(currentProjectData.id, "notas", localNotas);
            }
            // Save images if changed
            const currentImages = (currentProjectData as any).notasImagenes || [];
            if (JSON.stringify(localNotasImagenes) !== JSON.stringify(currentImages)) {
              updateProject(currentProjectData.id, "notasImagenes", localNotasImagenes);
            }
          }
          setSelectedProject(null);
        }}>
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
                      onClick={async () => {
                        console.log('[PanelOperaciones] Adding personal item to project:', currentProjectData.id);
                        const newPersonal: PersonalItem = {
                          id: `p${Date.now()}`,
                          nombre: "",
                          cargo: "",
                          telefono: "",
                          tipoPersonal: "BBM",
                          notas: "",
                        };
                        try {
                          await contextUpdateProject(currentProjectData.id, 'personal', [...(currentProjectData.personal || []), newPersonal]);
                          toast.success("Personal agregado");
                        } catch (err) {
                          console.error('[PanelOperaciones] Error adding personal:', err);
                          toast.error("Error al agregar personal");
                        }
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
                      onClick={async () => {
                        console.log('[PanelOperaciones] Adding inventario item to project:', currentProjectData.id);
                        const newInventario: InventarioItem = {
                          id: `i${Date.now()}`,
                          nombreMaterial: "",
                          cantidad: 1,
                          unidad: "unidades",
                          observaciones: "",
                          recibido: false,
                          notasAdicionales: "",
                        };
                        try {
                          await contextUpdateProject(currentProjectData.id, 'inventario', [...(currentProjectData.inventario || []), newInventario]);
                          toast.success("Material agregado");
                        } catch (err) {
                          console.error('[PanelOperaciones] Error adding inventario:', err);
                          toast.error("Error al agregar material");
                        }
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
                  <CardContent className="pt-0 space-y-4">
                    {/* Notas del proveedor */}
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Notas del Proveedor</label>
                      <Textarea
                        value={localNotasProveedor}
                        onChange={(e) => setLocalNotasProveedor(e.target.value)}
                        onBlur={() => {
                          if (localNotasProveedor !== (currentProjectData.notasCotizacionProveedor || "")) {
                            updateProject(currentProjectData.id, "notasCotizacionProveedor", localNotasProveedor);
                          }
                        }}
                        placeholder="Escriba notas específicas de la cotización del proveedor..."
                        className="min-h-[60px] text-sm"
                      />
                    </div>
                    
                    {/* Archivos adjuntos múltiples */}
                    <div>
                      <label className="text-xs text-muted-foreground mb-2 block">Documentos Adjuntos</label>
                      <AttachmentManager
                        attachments={currentProjectData.cotizacionesProveedor || []}
                        onAttachmentsChange={(attachments) => updateProject(currentProjectData.id, "cotizacionesProveedor", attachments)}
                        multiple
                        projectId={currentProjectData.id}
                        fieldName="cotizacionesProveedor"
                      />
                      <p className="text-[10px] text-muted-foreground mt-2">
                        Puede adjuntar múltiples archivos: PDF, imágenes, Word, Excel, etc.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <StickyNote className="h-4 w-4" />
                      Notas Generales
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <NotasGeneralesEditor
                      value={localNotas}
                      images={localNotasImagenes}
                      onChange={setLocalNotas}
                      onImagesChange={(images) => {
                        setLocalNotasImagenes(images);
                        // Save images immediately when changed
                        updateProject(currentProjectData.id, "notasImagenes", images);
                      }}
                      onBlur={() => {
                        if (localNotas !== (currentProjectData.notas || "")) {
                          updateProject(currentProjectData.id, "notas", localNotas);
                        }
                      }}
                      placeholder="Escriba notas generales del evento... (Ctrl+V para pegar imágenes)"
                    />
                  </CardContent>
                </Card>
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
