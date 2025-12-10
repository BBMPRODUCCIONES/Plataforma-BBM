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
import { CajaMenorEstadoSelect } from "@/components/CajaMenorEstadoSelect";
import { ColumnManagerDialog, ColumnConfig } from "@/components/ColumnManagerDialog";
import { NotasGeneralesEditor } from "@/components/NotasGeneralesEditor";
import { usePersistedColumns } from "@/hooks/usePersistedColumns";
import { useUserRole } from "@/hooks/useUserRole";
import { useProjects } from "@/contexts/ProjectsContext";
import { useEmpleados } from "@/contexts/EmpleadosContext";
import { Project, PersonalItem, InventarioItem, CajaMenorItem, ProjectStatus, CalendarViewMode, Attachment } from "@/types";
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
import { Search, Users, Package, FileText, FileDown, Settings, Plus, StickyNote, Loader2, Trash2, MessageSquare, Wallet, FileSpreadsheet, ChevronDown } from "lucide-react";
import { format, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";
import { printPersonal, printInventario, printCotizaciones, printPersonalYInventario, printCajaMenor, exportCajaMenorToExcel } from "@/utils/pdfGenerator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

const PanelOperaciones = () => {
  const navigate = useNavigate();
  const { canEditStructure, role, canViewFeedback, canEditFeedback } = useUserRole();
  const { projects, loading, updateProject: contextUpdateProject, updateProjectMultiple } = useProjects();
  const { empleados } = useEmpleados();
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
    { key: "cajaMenor", header: "Caja Menor", type: "text" as CellType, width: "100px", visible: true, isCustom: false, order: 18 },
    { key: "panelGeneral", header: "Panel", type: "text" as CellType, width: "80px", visible: true, isCustom: false, order: 19 },
  ];
  const [managedColumns, setManagedColumns] = usePersistedColumns("panel-operaciones-columns", defaultColumns);
  
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date } | undefined>();
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "todos">("todos");

  // Local state for textareas to prevent "erasing" while typing
  const [localNotas, setLocalNotas] = useState("");
  const [localNotasProveedor, setLocalNotasProveedor] = useState("");
  const [localFeedback, setLocalFeedback] = useState("");
  const [localNotasImagenes, setLocalNotasImagenes] = useState<Array<{id: string; url: string; name: string}>>([]);
  const [localFeedbackAdjuntos, setLocalFeedbackAdjuntos] = useState<Attachment[]>([]);

  // Sync local state when project changes (not on every keystroke)
  useEffect(() => {
    if (selectedProject) {
      const project = projects.find(p => p.id === selectedProject.id);
      if (project) {
        setLocalNotas(project.notas || "");
        setLocalNotasProveedor(project.notasCotizacionProveedor || "");
        setLocalNotasImagenes(project.notasImagenes || []);
        setLocalFeedback(project.feedback || "");
        setLocalFeedbackAdjuntos(project.feedbackAdjuntos || []);
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
        case "cajaMenor":
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
              <Wallet className="h-3 w-3 mr-1" />
              {p.cajaMenor?.length || 0}
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

  // Atomic update for multiple fields - prevents stale closure issues
  const updatePersonalItemMultiple = (projectId: string, personalId: string, updates: Partial<PersonalItem>) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const updatedPersonal = (project.personal || []).map(p => {
      if (p.id !== personalId) return p;
      const updated = { ...p, ...updates };
      if (updates.tipoPersonal === 'Transporte' && !p.rutaTransporte) {
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

  // Delete functions for Personal and Inventario
  const deletePersonalItem = async (projectId: string, personalId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const updatedPersonal = (project.personal || []).filter(p => p.id !== personalId);
    try {
      await contextUpdateProject(projectId, 'personal', updatedPersonal);
      toast.success("Personal eliminado");
    } catch (err) {
      console.error('[PanelOperaciones] Error deleting personal:', err);
      toast.error("Error al eliminar personal");
    }
  };

  const deleteInventarioItem = async (projectId: string, inventarioId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const updatedInventario = (project.inventario || []).filter(i => i.id !== inventarioId);
    try {
      await contextUpdateProject(projectId, 'inventario', updatedInventario);
      toast.success("Material eliminado");
    } catch (err) {
      console.error('[PanelOperaciones] Error deleting inventario:', err);
      toast.error("Error al eliminar material");
    }
  };

  // Caja Menor CRUD functions
  const updateCajaMenorItem = (projectId: string, cajaMenorId: string, field: string, value: any) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const updatedCajaMenor = (project.cajaMenor || []).map(c =>
      c.id === cajaMenorId ? { ...c, [field]: value } : c
    );
    contextUpdateProject(projectId, 'cajaMenor', updatedCajaMenor);
  };

  const deleteCajaMenorItem = async (projectId: string, cajaMenorId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const updatedCajaMenor = (project.cajaMenor || []).filter(c => c.id !== cajaMenorId);
    try {
      await contextUpdateProject(projectId, 'cajaMenor', updatedCajaMenor);
      toast.success("Registro de caja menor eliminado");
    } catch (err) {
      console.error('[PanelOperaciones] Error deleting caja menor:', err);
      toast.error("Error al eliminar registro");
    }
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
                // Use atomic update to prevent stale closure issues
                if (value === "BBM") {
                  updatePersonalItemMultiple(projectId, p.id, {
                    tipoPersonal: value,
                    nombre: "",
                    empleadoId: undefined
                  });
                } else if (value !== "BBM" && p.empleadoId) {
                  updatePersonalItemMultiple(projectId, p.id, {
                    tipoPersonal: value,
                    empleadoId: undefined
                  });
                } else {
                  updatePersonalItem(projectId, p.id, "tipoPersonal", value);
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
                // Use atomic update for BBM employees
                if (empleadoId && p.tipoPersonal === "BBM") {
                  updatePersonalItemMultiple(projectId, p.id, {
                    nombre: value,
                    empleadoId: empleadoId
                  });
                } else {
                  updatePersonalItem(projectId, p.id, "nombre", value);
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

    // Add delete action column
    basePersonalCols.push({
      key: "acciones",
      header: "",
      width: "50px",
      render: (p: PersonalItem) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            if (projectId) {
              deletePersonalItem(projectId, p.id);
            }
          }}
          title="Eliminar"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
    });

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
      {
        key: "acciones",
        header: "",
        width: "50px",
        render: (i: InventarioItem) => (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              if (projectId) {
                deleteInventarioItem(projectId, i.id);
              }
            }}
            title="Eliminar"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ),
      },
  ];
  }, [currentProjectData?.id, currentProjectData?.inventario]);

  // Caja Menor columns definition
  const cajaMenorColumns = useMemo(() => {
    const projectId = currentProjectData?.id;
    return [
      {
        key: "empleado",
        header: "Empleado",
        width: "180px",
        render: (c: CajaMenorItem) => (
          <EmpleadoAutocomplete
            value={c.empleadoId || ""}
            onChange={(empleadoId) => projectId && updateCajaMenorItem(projectId, c.id, "empleadoId", empleadoId)}
            useEmpleadoId
            placeholder="Seleccionar empleado..."
          />
        ),
      },
      {
        key: "concepto",
        header: "Concepto",
        width: "200px",
        render: (c: CajaMenorItem) => (
          <EditableCell
            value={c.concepto}
            type="text"
            placeholder="Descripción del concepto..."
            onChange={(value) => projectId && updateCajaMenorItem(projectId, c.id, "concepto", value)}
          />
        ),
      },
      {
        key: "imagenes",
        header: "Imágenes",
        width: "120px",
        render: (c: CajaMenorItem) => (
          <AttachmentButton
            attachments={c.imagenes || []}
            onAttachmentsChange={(attachments) => projectId && updateCajaMenorItem(projectId, c.id, "imagenes", attachments)}
            multiple
            projectId={projectId || ""}
            fieldName={`caja-menor-${c.id}-imagenes`}
            enableCamera
          />
        ),
      },
      {
        key: "valor",
        header: "Valor",
        width: "100px",
        render: (c: CajaMenorItem) => (
          <EditableCell
            value={c.valor}
            type="number"
            placeholder="0"
            onChange={(value) => projectId && updateCajaMenorItem(projectId, c.id, "valor", value)}
          />
        ),
      },
      {
        key: "categoria",
        header: "Categoría",
        width: "130px",
        render: (c: CajaMenorItem) => (
          <EditableCell
            value={c.categoria}
            type="select"
            options={["Transporte", "Alimentación", "Compras"]}
            onChange={(value) => projectId && updateCajaMenorItem(projectId, c.id, "categoria", value)}
          />
        ),
      },
      {
        key: "estado",
        header: "Estado",
        width: "130px",
        render: (c: CajaMenorItem) => (
          <CajaMenorEstadoSelect
            value={c.estado}
            onChange={(value) => projectId && updateCajaMenorItem(projectId, c.id, "estado", value)}
          />
        ),
      },
      {
        key: "acciones",
        header: "",
        width: "50px",
        render: (c: CajaMenorItem) => (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              if (projectId) {
                deleteCajaMenorItem(projectId, c.id);
              }
            }}
            title="Eliminar"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ),
      },
    ];
  }, [currentProjectData?.id, currentProjectData?.cajaMenor]);

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
            // Save feedback if changed
            if (localFeedback !== (currentProjectData.feedback || "")) {
              updateProject(currentProjectData.id, "feedback", localFeedback);
            }
            // Save feedback attachments if changed
            if (JSON.stringify(localFeedbackAdjuntos) !== JSON.stringify(currentProjectData.feedbackAdjuntos || [])) {
              updateProject(currentProjectData.id, "feedbackAdjuntos", localFeedbackAdjuntos);
            }
            // Save images if changed
            const currentImages = currentProjectData.notasImagenes || [];
            if (JSON.stringify(localNotasImagenes) !== JSON.stringify(currentImages)) {
              updateProject(currentProjectData.id, "notasImagenes", localNotasImagenes);
            }
          }
          setSelectedProject(null);
        }}>
          <DialogContent 
            className="w-[95vw] max-w-[1400px] max-h-[90vh] p-0"
            onOpenAutoFocus={(e) => e.preventDefault()}
            onPointerDownOutside={(e) => {
              const target = e.target as HTMLElement;
              if (target.closest('#empleado-dropdown-portal')) {
                e.preventDefault();
              }
            }}
            onInteractOutside={(e) => {
              const target = e.target as HTMLElement;
              if (target.closest('#empleado-dropdown-portal')) {
                e.preventDefault();
              }
            }}
            onFocusOutside={(e) => {
              const target = e.target as HTMLElement;
              if (target.closest('#empleado-dropdown-portal')) {
                e.preventDefault();
              }
            }}
          >
            <div className="overflow-y-auto overflow-x-hidden max-h-[calc(90vh-2rem)] p-6">
              <DialogHeader className="mb-4">
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
                <div className="space-y-6">
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

                {/* Caja Menor Section */}
                <Card className="overflow-hidden">
                  <CardHeader className="py-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Wallet className="h-4 w-4" />
                      Caja Menor ({(currentProjectData.cajaMenor || []).length})
                    </CardTitle>
                    <div className="flex gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            <FileDown className="h-3 w-3 mr-1" />
                            Exportar
                            <ChevronDown className="h-3 w-3 ml-1" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => printCajaMenor(currentProjectData, empleados)}>
                            <FileDown className="h-4 w-4 mr-2" />
                            Descargar PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => exportCajaMenorToExcel(currentProjectData, empleados)}>
                            <FileSpreadsheet className="h-4 w-4 mr-2" />
                            Descargar Excel
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          console.log('[PanelOperaciones] Adding caja menor item to project:', currentProjectData.id);
                          const newCajaMenor: CajaMenorItem = {
                            id: `cm${Date.now()}`,
                            empleadoId: "",
                            concepto: "",
                            imagenes: [],
                            valor: 0,
                            categoria: "Compras",
                            estado: "No aprobado",
                          };
                          try {
                            await contextUpdateProject(currentProjectData.id, 'cajaMenor', [...(currentProjectData.cajaMenor || []), newCajaMenor]);
                            toast.success("Registro de caja menor agregado");
                          } catch (err) {
                            console.error('[PanelOperaciones] Error adding caja menor:', err);
                            toast.error("Error al agregar registro");
                          }
                        }}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Agregar Registro
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 overflow-hidden">
                    {(currentProjectData.cajaMenor || []).length > 0 ? (
                      <MatrixTable
                        data={currentProjectData.cajaMenor || []}
                        columns={cajaMenorColumns}
                        noHorizontalScroll
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">No hay registros de caja menor. Haga clic en "Agregar Registro" para comenzar.</p>
                    )}
                  </CardContent>
                </Card>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <ColumnManagerDialog
          open={columnManagerOpen}
          onOpenChange={setColumnManagerOpen}
          columns={managedColumns}
          onColumnsChange={setManagedColumns}
          panelName="Panel Operaciones"
        />
      </div>
    </Layout>
  );
};

export default PanelOperaciones;
