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
import { ProveedorAutocomplete } from "@/components/ProveedorAutocomplete";
import { CajaMenorEstadoSelect } from "@/components/CajaMenorEstadoSelect";
import { ColumnManagerDialog, ColumnConfig } from "@/components/ColumnManagerDialog";
import { NotasGeneralesEditor } from "@/components/NotasGeneralesEditor";
import { usePersistedColumns } from "@/hooks/usePersistedColumns";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/contexts/ProjectsContext";
import { useEmpleados } from "@/contexts/EmpleadosContext";
import { useDateRange } from "@/contexts/DateRangeContext";
import { supabase } from "@/integrations/supabase/client";
import { Project, PersonalItem, InventarioItem, CajaMenorItem, ProjectStatus, CalendarViewMode, Attachment } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Users, Package, FileText, FileDown, Settings, Plus, StickyNote, Loader2, Trash2, MessageSquare, Wallet, FileSpreadsheet, ChevronDown, Clock, Lock } from "lucide-react";
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
import { HorarioFormDialog } from "@/components/HorarioFormDialog";

const PanelOperaciones = () => {
  const navigate = useNavigate();
  const { canEditStructure, role, canViewFeedback, canEditFeedback, canApproveCajaMenor } = useUserRole();
  const { user } = useAuth();
  const { projects, loading, updateProject: contextUpdateProject, updateProjectMultiple } = useProjects();
  const { empleados } = useEmpleados();
  const { globalDateRange, setGlobalDateRange, globalViewMode, setGlobalViewMode, globalSelectedDate, setGlobalSelectedDate } = useDateRange();
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
  
  // Calendar filter state - using global context
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "todos">("todos");
  const [hideDeleted, setHideDeleted] = useState(false);
  // Computed dateRange from global context
  const dateRange = globalDateRange?.from && globalDateRange?.to 
    ? { start: globalDateRange.from, end: globalDateRange.to } 
    : undefined;

  // Local state for textareas to prevent "erasing" while typing
  const [localNotas, setLocalNotas] = useState("");
  const [localNotasProveedor, setLocalNotasProveedor] = useState("");
  const [localFeedback, setLocalFeedback] = useState("");
  const [selectedSection, setSelectedSection] = useState<"plantilla" | "cajaMenor" | null>(null);
  const [localNotasImagenes, setLocalNotasImagenes] = useState<Array<{id: string; url: string; name: string}>>([]);
  const [localFeedbackAdjuntos, setLocalFeedbackAdjuntos] = useState<Attachment[]>([]);
  const [horarioFormOpen, setHorarioFormOpen] = useState(false);

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
  
  // Find the current user's linked employee using RPC (works for all roles)
  const currentUserEmail = user?.email?.toLowerCase();
  const [currentUserEmpleado, setCurrentUserEmpleado] = useState<{id: string; nombre: string; correo: string; cargo: string} | null>(null);
  
  useEffect(() => {
    const fetchMyEmployee = async () => {
      if (!user) {
        setCurrentUserEmpleado(null);
        return;
      }
      
      try {
        const { data, error } = await supabase.rpc('get_my_employee');
        if (error) {
          console.error('[PanelOperaciones] Error fetching my employee:', error);
          return;
        }
        if (data && data.length > 0) {
          setCurrentUserEmpleado(data[0]);
        } else {
          // Fallback: try to find in empleados array (for admins)
          const found = empleados.find(e => e.correo?.toLowerCase() === currentUserEmail);
          if (found) {
            setCurrentUserEmpleado({ id: found.id, nombre: found.nombre, correo: found.correo || '', cargo: found.cargo });
          }
        }
      } catch (err) {
        console.error('[PanelOperaciones] Exception fetching my employee:', err);
      }
    };
    
    fetchMyEmployee();
  }, [user, empleados, currentUserEmail]);
  
  // Helper to check if user can edit a Caja Menor record
  const canEditCajaMenorRecord = (record: CajaMenorItem): boolean => {
    if (isAdmin) return true;
    // Operativo can only edit their own records
    if (!currentUserEmail) return false;
    return record.empleadoEmail?.toLowerCase() === currentUserEmail;
  };

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


  // Row className for deleted projects (red styling)
  const getRowClassName = (project: Project) => {
    if (project.isDeleted) {
      return "row-deleted";
    }
    return "";
  };

  const filteredProjects = projects.filter((p) => {
    // Show all by default, hide deleted only when hideDeleted is enabled
    const matchesDeleted = !hideDeleted || !p.isDeleted;
    
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
                setSelectedSection("plantilla");
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
                onDataExtracted={(ingresoBruto, ingresoTotal, inventarioItems) => {
                  // Merge new inventory items with existing ones
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
                setSelectedSection("plantilla");
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
                setSelectedSection("cajaMenor");
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

  // Caja Menor CRUD functions with permission checks
  const updateCajaMenorItem = (projectId: string, cajaMenorId: string, field: string, value: any) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    // Permission check for non-admins
    const record = (project.cajaMenor || []).find(c => c.id === cajaMenorId);
    if (!isAdmin && record && !canEditCajaMenorRecord(record)) {
      toast.error("No tienes permiso para editar este registro");
      return;
    }
    
    const updatedCajaMenor = (project.cajaMenor || []).map(c =>
      c.id === cajaMenorId ? { ...c, [field]: value } : c
    );
    contextUpdateProject(projectId, 'cajaMenor', updatedCajaMenor);
  };

  const deleteCajaMenorItem = async (projectId: string, cajaMenorId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    // Permission check for non-admins
    const record = (project.cajaMenor || []).find(c => c.id === cajaMenorId);
    if (!isAdmin && record && !canEditCajaMenorRecord(record)) {
      toast.error("No tienes permiso para eliminar este registro");
      return;
    }
    
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
        render: (p: PersonalItem) => {
          // BBM uses EmpleadoAutocomplete, Proveedor/Transporte use ProveedorAutocomplete
          if (p.tipoPersonal === "BBM") {
            return (
              <EmpleadoAutocomplete
                value={p.empleadoId || ""}
                tipoPersonal="BBM"
                useEmpleadoId
                fallbackName={p.nombre}
                onChange={(nombreValue, empleadoId) => {
                  if (projectId) {
                    updatePersonalItemMultiple(projectId, p.id, {
                      nombre: nombreValue,
                      empleadoId: empleadoId
                    });
                  }
                }}
              />
            );
          }
          // Proveedor or Transporte - use ProveedorAutocomplete
          return (
            <ProveedorAutocomplete
              value={p.nombre}
              onChange={(value, proveedorId) => {
                if (projectId) {
                  updatePersonalItemMultiple(projectId, p.id, {
                    nombre: value,
                    proveedorId: proveedorId
                  });
                }
              }}
              placeholder={p.tipoPersonal === "Transporte" ? "Buscar transporte..." : "Buscar proveedor..."}
            />
          );
        },
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
            <div className={`rounded ${!p.rutaTransporte ? "bg-destructive/20 ring-2 ring-destructive/50" : ""}`}>
              <EditableCell
                value={p.rutaTransporte}
                type="text"
                placeholder="⚠️ Ruta obligatoria..."
                onChange={(value) => projectId && updatePersonalItem(projectId, p.id, "rutaTransporte", value)}
                className={!p.rutaTransporte ? "border-destructive text-destructive placeholder:text-destructive/70" : ""}
              />
            </div>
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
        width: "65%",
        className: "align-top",
        render: (i: InventarioItem) => {
          const text = i.nombreMaterial || "";
          const lineCount = text.split('\n').length;
          const charLength = text.length;
          const estimatedRows = Math.max(lineCount, Math.ceil(charLength / 60));
          const rows = Math.max(2, Math.min(estimatedRows, 20));
          
          return (
            <Textarea
              value={text}
              placeholder="Nombre del material..."
              onChange={(e) => projectId && updateInventarioItem(projectId, i.id, "nombreMaterial", e.target.value)}
              className="w-full resize-none text-sm bg-transparent border-0 focus-visible:ring-1 focus-visible:ring-ring"
              style={{ 
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
                minHeight: `${rows * 1.5}rem`,
                height: 'auto',
                overflow: 'visible'
              }}
              rows={rows}
            />
          );
        },
      },
      { 
        key: "cantidad", 
        header: "Cantidad", 
        width: "8%",
        render: (i: InventarioItem) => (
          <div className="flex flex-col gap-1">
            <EditableCell
              value={i.cantidad}
              type="number"
              onChange={(value) => projectId && updateInventarioItem(projectId, i.id, "cantidad", value)}
              className="w-full"
            />
            <EditableCell
              value={i.unidad}
              type="text"
              onChange={(value) => projectId && updateInventarioItem(projectId, i.id, "unidad", value)}
              className="w-full text-xs"
              placeholder="uds"
            />
          </div>
        ),
      },
      {
        key: "recibido",
        header: "Recibido",
        width: "7%",
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
        width: "17%",
        render: (i: InventarioItem) => (
          <EditableCell
            value={i.notasAdicionales}
            type="text"
            placeholder="Notas..."
            onChange={(value) => projectId && updateInventarioItem(projectId, i.id, "notasAdicionales", value)}
          />
        ),
      },
      {
        key: "acciones",
        header: "",
        width: "3%",
        render: (i: InventarioItem) => (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              if (projectId) {
                deleteInventarioItem(projectId, i.id);
              }
            }}
            title="Eliminar"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        ),
      },
  ];
  }, [currentProjectData?.id, currentProjectData?.inventario]);

  // Caja Menor columns definition with role-based permissions
  const cajaMenorColumns = useMemo(() => {
    const projectId = currentProjectData?.id;
    
    // Helper to get employee display name - prioritize DB lookup over stored name
    const getEmpleadoName = (c: CajaMenorItem) => {
      // First try to find the employee by ID (most reliable, gets current name from DB)
      if (c.empleadoId) {
        const emp = empleados.find(e => e.id === c.empleadoId);
        if (emp?.nombre) return emp.nombre;
      }
      // Fallback to stored name if ID lookup fails
      if (c.empleadoNombre) return c.empleadoNombre;
      return "Sin empleado";
    };
    
    return [
      {
        key: "empleado",
        header: "Empleado",
        width: "200px",
        render: (c: CajaMenorItem) => {
          const canEdit = canEditCajaMenorRecord(c);
          
          // Admin: can change employee; Operativo: read-only display
          if (isAdmin) {
            return (
              <EmpleadoAutocomplete
                value={c.empleadoId || ""}
                onChange={(nombreValue, empleadoId) => {
                  if (projectId && empleadoId) {
                    const emp = empleados.find(e => e.id === empleadoId);
                    // Update all three fields atomically
                    const project = projects.find(p => p.id === projectId);
                    if (project) {
                      const updatedCajaMenor = (project.cajaMenor || []).map(item =>
                        item.id === c.id ? { 
                          ...item, 
                          empleadoId,
                          empleadoNombre: emp?.nombre || nombreValue,
                          empleadoEmail: emp?.correo || ""
                        } : item
                      );
                      contextUpdateProject(projectId, 'cajaMenor', updatedCajaMenor);
                    }
                  }
                }}
                useEmpleadoId
                placeholder="Seleccionar empleado..."
              />
            );
          }
          
          // Operativo: read-only display with lock icon
          return (
            <div className="flex items-center gap-2 text-sm">
              <Lock className="h-3 w-3 text-muted-foreground" />
              <span className={canEdit ? "text-foreground" : "text-muted-foreground"}>
                {getEmpleadoName(c)}
              </span>
            </div>
          );
        },
      },
      {
        key: "concepto",
        header: "Concepto",
        width: "200px",
        render: (c: CajaMenorItem) => {
          const canEdit = canEditCajaMenorRecord(c);
          if (!canEdit) {
            return <span className="text-sm text-muted-foreground">{c.concepto || "-"}</span>;
          }
          return (
            <EditableCell
              value={c.concepto}
              type="text"
              placeholder="Descripción del concepto..."
              onChange={(value) => projectId && updateCajaMenorItem(projectId, c.id, "concepto", value)}
            />
          );
        },
      },
      {
        key: "imagenes",
        header: "Imágenes",
        width: "120px",
        render: (c: CajaMenorItem) => {
          const canEdit = canEditCajaMenorRecord(c);
          return (
            <AttachmentButton
              attachments={c.imagenes || []}
              onAttachmentsChange={(attachments) => {
                if (canEdit && projectId) {
                  updateCajaMenorItem(projectId, c.id, "imagenes", attachments);
                }
              }}
              multiple
              projectId={projectId || ""}
              fieldName={`caja-menor-${c.id}-imagenes`}
              enableCamera={canEdit}
              disabled={!canEdit}
            />
          );
        },
      },
      {
        key: "valor",
        header: "VALOR (COP)",
        width: "130px",
        render: (c: CajaMenorItem) => {
          const canEdit = canEditCajaMenorRecord(c);
          const formattedValue = `$ ${(c.valor || 0).toLocaleString('es-CO')}`;
          if (!canEdit) {
            return <span className="text-base font-semibold font-mono text-foreground">{formattedValue}</span>;
          }
          return (
            <EditableCell
              value={c.valor}
              type="number"
              placeholder="0"
              onChange={(value) => projectId && updateCajaMenorItem(projectId, c.id, "valor", value)}
              className="text-base font-semibold"
            />
          );
        },
      },
      {
        key: "categoria",
        header: "Categoría",
        width: "130px",
        render: (c: CajaMenorItem) => {
          const canEdit = canEditCajaMenorRecord(c);
          if (!canEdit) {
            return <span className="text-sm text-muted-foreground">{c.categoria}</span>;
          }
          return (
            <EditableCell
              value={c.categoria}
              type="select"
              options={["Transporte", "Alimentación", "Compras"]}
              onChange={(value) => projectId && updateCajaMenorItem(projectId, c.id, "categoria", value)}
            />
          );
        },
      },
      {
        key: "recursos",
        header: "Recursos *",
        width: "140px",
        render: (c: CajaMenorItem) => {
          const canEdit = canEditCajaMenorRecord(c);
          const isEmpty = !c.recursos;
          if (!canEdit) {
            return (
              <span className={`text-sm ${isEmpty ? "text-destructive italic" : "text-muted-foreground"}`}>
                {c.recursos || "Sin seleccionar"}
              </span>
            );
          }
          return (
            <div className={isEmpty ? "ring-2 ring-destructive/50 rounded" : ""}>
              <EditableCell
                value={c.recursos || ""}
                type="select"
                options={["Recursos propios", "BBM", "Anticipo BBM"]}
                placeholder="Seleccionar..."
                onChange={(value) => projectId && updateCajaMenorItem(projectId, c.id, "recursos", value)}
              />
            </div>
          );
        },
      },
      {
        key: "contingencia",
        header: "Contingencia",
        width: "120px",
        render: (c: CajaMenorItem) => {
          const canEdit = canEditCajaMenorRecord(c);
          const value = c.contingencia || "No";
          if (!canEdit) {
            return (
              <span className={`text-sm px-2 py-0.5 rounded ${
                value === "Sí" ? "bg-amber-500/10 text-amber-500" : "text-muted-foreground"
              }`}>
                {value}
              </span>
            );
          }
          return (
            <EditableCell
              value={value}
              type="select"
              options={["Sí", "No"]}
              onChange={(value) => projectId && updateCajaMenorItem(projectId, c.id, "contingencia", value)}
            />
          );
        },
      },
      {
        key: "estado",
        header: "Estado",
        width: "130px",
        render: (c: CajaMenorItem) => {
          // Only users with canApproveCajaMenor permission can change Estado
          const canChangeEstado = canApproveCajaMenor();
          
          if (!canChangeEstado) {
            return (
              <div className="flex items-center gap-1">
                <Lock className="h-3 w-3 text-muted-foreground" />
                <span className={`text-sm px-2 py-0.5 rounded ${
                  c.estado === "Aprobado" ? "bg-green-500/10 text-green-500" : "bg-yellow-500/10 text-yellow-500"
                }`}>
                  {c.estado}
                </span>
              </div>
            );
          }
          return (
            <CajaMenorEstadoSelect
              value={c.estado}
              onChange={(value) => projectId && updateCajaMenorItem(projectId, c.id, "estado", value)}
            />
          );
        },
      },
      {
        key: "acciones",
        header: "",
        width: "50px",
        render: (c: CajaMenorItem) => {
          const canEdit = canEditCajaMenorRecord(c);
          if (!canEdit) {
            return null; // Hide delete button for non-editable records
          }
          return (
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
          );
        },
      },
    ];
  }, [currentProjectData?.id, currentProjectData?.cajaMenor, empleados, isAdmin, currentUserEmail, canEditCajaMenorRecord, projects, canApproveCajaMenor]);

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
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setHorarioFormOpen(true)}>
                <Clock className="h-4 w-4 mr-2" />
                Gestión de Horarios
              </Button>
              {canEditStructure() && (
                <Button variant="outline" size="sm" onClick={() => setColumnManagerOpen(true)}>
                  <Settings className="h-4 w-4 mr-2" />
                  Gestionar Columnas
                </Button>
              )}
            </div>
          }
        />

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
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="matriz">Matriz Operaciones</TabsTrigger>
              <TabsTrigger value="gantt">Gantt</TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="hide-deleted-operaciones"
                  checked={hideDeleted}
                  onCheckedChange={setHideDeleted}
                />
                <Label htmlFor="hide-deleted-operaciones" className="text-sm text-muted-foreground cursor-pointer">
                  Ocultar eliminados
                </Label>
              </div>
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
          </div>

          <TabsContent value="matriz" className="mt-4">
            <div className="panel-card">
              <MatrixTable
                key={tableKey}
                data={filteredProjects}
                columns={[
                  ...columns,
                ]}
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

        {/* Project Detail Dialog */}
        <Dialog open={!!selectedProject} onOpenChange={(open) => {
          if (!open && selectedProject && currentProjectData) {
            // Validate transport routes before closing (only for plantilla section)
            if (selectedSection === "plantilla") {
              const transportesSinRuta = (currentProjectData.personal || []).filter(
                p => p.tipoPersonal === "Transporte" && !p.rutaTransporte?.trim()
              );
              if (transportesSinRuta.length > 0) {
                toast.error(`Faltan rutas obligatorias en ${transportesSinRuta.length} transporte(s). Complete las rutas antes de cerrar.`);
                return; // Prevent closing
              }
            }
            
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
          setSelectedSection(null);
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
                <div className="flex items-center justify-between">
                  <DialogTitle className="flex items-center gap-2">
                    {selectedProject?.evento}
                    {selectedProject && (
                      <StatusSelect
                        value={selectedProject.estado}
                        onChange={(value) => updateProject(selectedProject.id, "estado", value)}
                      />
                    )}
                  </DialogTitle>
                  {selectedSection === "plantilla" && currentProjectData && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <FileDown className="h-4 w-4 mr-2" />
                          Exportar
                          <ChevronDown className="h-3 w-3 ml-1" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover border border-border">
                        <DropdownMenuItem onClick={() => printPersonalYInventario(currentProjectData, true)}>
                          <FileDown className="h-4 w-4 mr-2" />
                          PDF Completo
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => printPersonal(currentProjectData, true)}>
                          <Users className="h-4 w-4 mr-2" />
                          Solo Personal
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => printInventario(currentProjectData, true)}>
                          <Package className="h-4 w-4 mr-2" />
                          Solo Inventario
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
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

                  {/* Plantilla Completa: Personal, Inventario, Cotizaciones Proveedor, Feedback, Notas */}
                  {selectedSection === "plantilla" && (
                    <>
                      {/* Personal Section */}
                      <Card className="overflow-hidden">
                        <CardHeader className="py-3 flex flex-row items-center justify-between">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Personal ({(currentProjectData.personal || []).length})
                          </CardTitle>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              const newPersonal: PersonalItem = {
                                id: `p${Date.now()}`,
                                tipoPersonal: "BBM",
                                nombre: "",
                                cargo: "",
                                telefono: "",
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
                        <CardContent className="pt-0 overflow-hidden">
                          {(currentProjectData.personal || []).length > 0 ? (
                            <MatrixTable
                              data={currentProjectData.personal || []}
                              columns={personalColumns}
                              noHorizontalScroll
                            />
                          ) : (
                            <p className="text-sm text-muted-foreground">No hay personal asignado. Haga clic en "Agregar Personal" para comenzar.</p>
                          )}
                        </CardContent>
                      </Card>

                      {/* Inventario Section */}
                      <Card className="overflow-hidden">
                        <CardHeader className="py-3 flex flex-row items-center justify-between">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            Inventario ({(currentProjectData.inventario || []).length})
                          </CardTitle>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              const newInventario: InventarioItem = {
                                id: `i${Date.now()}`,
                                nombreMaterial: "",
                                cantidad: 1,
                                unidad: "uds",
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
                        <CardContent className="pt-0 overflow-hidden">
                          {(currentProjectData.inventario || []).length > 0 ? (
                            <MatrixTable
                              data={currentProjectData.inventario || []}
                              columns={inventarioColumns}
                              noHorizontalScroll
                            />
                          ) : (
                            <p className="text-sm text-muted-foreground">No hay materiales en inventario. Haga clic en "Agregar Material" para comenzar.</p>
                          )}
                        </CardContent>
                      </Card>


                      {/* Feedback Section - Only visible to users with permission */}
                      {canViewFeedback() && (
                        <Card className="overflow-hidden">
                          <CardHeader className="py-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <MessageSquare className="h-4 w-4" />
                              Feedback
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div>
                              <Textarea
                                value={localFeedback}
                                onChange={(e) => setLocalFeedback(e.target.value)}
                                onBlur={() => {
                                  if (localFeedback !== (currentProjectData.feedback || "")) {
                                    updateProject(currentProjectData.id, "feedback", localFeedback);
                                  }
                                }}
                                placeholder="Comentarios y feedback del evento..."
                                className="min-h-[100px]"
                                disabled={!canEditFeedback()}
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">Archivos Adjuntos</label>
                              <AttachmentManager
                                attachments={localFeedbackAdjuntos}
                                onAttachmentsChange={(attachments) => {
                                  setLocalFeedbackAdjuntos(attachments);
                                  updateProject(currentProjectData.id, "feedbackAdjuntos", attachments);
                                }}
                                projectId={currentProjectData.id}
                                fieldName="feedbackAdjuntos"
                                multiple
                                disabled={!canEditFeedback()}
                              />
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Notas Generales Section */}
                      <Card className="overflow-hidden">
                        <CardHeader className="py-3">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <StickyNote className="h-4 w-4" />
                            Notas Generales
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <NotasGeneralesEditor
                            value={localNotas}
                            images={localNotasImagenes}
                            onChange={setLocalNotas}
                            onImagesChange={(images) => {
                              setLocalNotasImagenes(images);
                              updateProject(currentProjectData.id, "notasImagenes", images);
                            }}
                            onBlur={() => {
                              if (localNotas !== (currentProjectData.notas || "")) {
                                updateProject(currentProjectData.id, "notas", localNotas);
                              }
                            }}
                            placeholder="Notas generales del evento (puedes pegar imágenes con Ctrl+V)..."
                          />
                        </CardContent>
                      </Card>
                    </>
                  )}

                  {/* Caja Menor Section - Solo cuando selectedSection === "cajaMenor" */}
                  {selectedSection === "cajaMenor" && (
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
                              // Auto-fill with current user's employee
                              const newCajaMenor: CajaMenorItem = {
                                id: `cm${Date.now()}`,
                                empleadoId: currentUserEmpleado?.id || "",
                                empleadoNombre: currentUserEmpleado?.nombre || "",
                                empleadoEmail: currentUserEmpleado?.correo || currentUserEmail || "",
                                concepto: "",
                                imagenes: [],
                                valor: 0,
                                categoria: "Compras",
                                recursos: "",
                                contingencia: "No",
                                estado: "No aprobado",
                              };
                              toast.info("Recuerda seleccionar el tipo de recursos");
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
                  )}
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

        <HorarioFormDialog
          open={horarioFormOpen}
          onOpenChange={setHorarioFormOpen}
          mode="field"
          lockEmpleado={true}
          lockFecha={true}
          defaultEmpleadoId={currentUserEmpleado?.id}
        />
      </div>
    </Layout>
  );
};

export default PanelOperaciones;
