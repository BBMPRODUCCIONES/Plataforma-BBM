import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";
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
import { EventLink } from "@/components/EventLink";
import { useGlobalColumns } from "@/hooks/useGlobalColumns";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/contexts/ProjectsContext";
import { useDateRange } from "@/contexts/DateRangeContext";
import { Project, ProjectStatus, CalendarViewMode } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, ExternalLink, Settings, Loader2, Trash2, RotateCcw, ArrowUpDown, ArrowUp, ArrowDown, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
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

interface SmartSuggestion {
  type: string;
  label: string;
  value: string;
  displayLabel: string;
}

const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

type SortDirection = "asc" | "desc" | null;
type EmptyPlacement = "last" | "first";

const KNOWN_ESTADOS_DIR = ["Por Ejecutar", "En Progreso", "Facturado", "Completado", "Cancelado"];
const KNOWN_AVANZADA = ["No se hizo", "Se hizo", "No es necesario"];

const PanelDirectivo = () => {
  const navigate = useNavigate();
  const { canEditStructure, role, canEditDirectivo } = useUserRole();
  const { user } = useAuth();
  const { projects, loading, updateProject: contextUpdateProject, updateProjectMultiple, addProject, softDeleteProject, restoreProject } = useProjects();
  const { globalDateRange, setGlobalDateRange, globalViewMode, setGlobalViewMode, globalSelectedDate, setGlobalSelectedDate } = useDateRange();
  const isAdmin = role?.toLowerCase() === "administrador";
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState("");
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [columnManagerOpen, setColumnManagerOpen] = useState(false);
  const [highlightedProjectId, setHighlightedProjectId] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [notaExpandida, setNotaExpandida] = useState<{ evento: string; nota: string } | null>(null);
  
  // Smart search state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Sort state
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [emptyPlacement, setEmptyPlacement] = useState<EmptyPlacement>("last");
  
  // Column management state - persisted to localStorage
  const defaultColumns: ColumnConfig[] = [
    { key: "centroCostos", header: "CC", type: "text" as CellType, width: "60px", visible: true, isCustom: false, order: 0 },
    { key: "cliente", header: "Cliente", type: "text" as CellType, width: "120px", visible: true, isCustom: false, order: 1 },
    { key: "evento", header: "Evento", type: "text" as CellType, width: "140px", visible: true, isCustom: false, order: 2 },
    { key: "avanzada", header: "Avanzada", type: "select" as CellType, width: "115px", visible: true, isCustom: false, order: 3, options: ["No se hizo", "Se hizo", "No es necesario"] },
    { key: "fechaMontaje", header: "Montaje", type: "date" as CellType, width: "80px", visible: true, isCustom: false, order: 4 },
    { key: "fechaEjecucion", header: "Ejecución", type: "date" as CellType, width: "80px", visible: true, isCustom: false, order: 5 },
    { key: "fechaDesmontaje", header: "Desmontaje", type: "date" as CellType, width: "85px", visible: true, isCustom: false, order: 6 },
    { key: "estado", header: "Estado", type: "select" as CellType, width: "115px", visible: true, isCustom: false, order: 7 },
    { key: "ingresoBruto", header: "Ing. Bruto", type: "number" as CellType, width: "110px", visible: true, isCustom: false, order: 8 },
    { key: "ingresoTotal", header: "Ing. Total", type: "number" as CellType, width: "110px", visible: true, isCustom: false, order: 9 },
    { key: "cotizaciones", header: "Cotización", type: "file" as CellType, width: "75px", visible: true, isCustom: false, order: 10 },
    { key: "ordenCompra", header: "OC", type: "file" as CellType, width: "55px", visible: true, isCustom: false, order: 11 },
    { key: "numFactura", header: "#Fact.", type: "text" as CellType, width: "65px", visible: true, isCustom: false, order: 12 },
    { key: "notas", header: "Notas", type: "text" as CellType, width: "130px", visible: true, isCustom: false, order: 13 },
    { key: "panelGeneral", header: "Panel", type: "text" as CellType, width: "60px", visible: true, isCustom: false, order: 14 },
  ];
  const { columns: managedColumns, setColumns: setManagedColumns, loading: columnsLoading, isAdmin: canModifyStructure } = useGlobalColumns("panel-directivo", defaultColumns);
  
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

  // Smart search: parse search tokens
  const searchTokens = useMemo(() => {
    return searchTerm.split(',').map(t => t.trim()).filter(Boolean).map(t => normalize(t));
  }, [searchTerm]);

  const currentToken = useMemo(() => {
    const parts = searchTerm.split(',');
    return parts[parts.length - 1].trim().toLowerCase();
  }, [searchTerm]);

  // Unique values for autocomplete
  const uniqueClientes = useMemo(() => {
    const set = new Set<string>();
    projects.forEach(p => { if (!p.isDeleted && p.cliente) set.add(p.cliente); });
    return Array.from(set).sort();
  }, [projects]);

  const uniqueEventos = useMemo(() => {
    const set = new Set<string>();
    projects.forEach(p => { if (!p.isDeleted && p.evento) set.add(p.evento); });
    return Array.from(set).sort();
  }, [projects]);

  const uniqueCCs = useMemo(() => {
    const set = new Set<string>();
    projects.forEach(p => { if (!p.isDeleted && p.centroCostos) set.add(p.centroCostos); });
    return Array.from(set).sort();
  }, [projects]);

  // Autocomplete suggestions
  const suggestions = useMemo((): SmartSuggestion[] => {
    if (currentToken.length < 1) return [];
    const results: SmartSuggestion[] = [];
    const nt = normalize(currentToken);

    KNOWN_ESTADOS_DIR.filter(e => normalize(e).includes(nt)).forEach(e => {
      results.push({ type: 'estado', label: 'Estado', value: e, displayLabel: e });
    });
    KNOWN_AVANZADA.filter(a => normalize(a).includes(nt)).forEach(a => {
      results.push({ type: 'avanzada', label: 'Avanzada', value: a, displayLabel: a });
    });
    uniqueClientes.filter(c => normalize(c).includes(nt)).slice(0, 5).forEach(c => {
      results.push({ type: 'cliente', label: 'Cliente', value: c, displayLabel: c });
    });
    uniqueEventos.filter(e => normalize(e).includes(nt)).slice(0, 5).forEach(e => {
      results.push({ type: 'evento', label: 'Evento', value: e, displayLabel: e });
    });
    uniqueCCs.filter(c => normalize(c).includes(nt)).slice(0, 5).forEach(c => {
      results.push({ type: 'cc', label: 'CC', value: c, displayLabel: c });
    });

    // Special: "con factura" / "sin factura" / "con cotización" / "sin cotización" / "con orden" / "sin orden"
    const specials = [
      { keyword: "con factura", value: "con:factura", label: "Con #Factura" },
      { keyword: "sin factura", value: "sin:factura", label: "Sin #Factura" },
      { keyword: "con cotizacion", value: "con:cotizacion", label: "Con Cotización" },
      { keyword: "sin cotizacion", value: "sin:cotizacion", label: "Sin Cotización" },
      { keyword: "con orden", value: "con:orden", label: "Con Orden de Compra" },
      { keyword: "sin orden", value: "sin:orden", label: "Sin Orden de Compra" },
    ];
    specials.filter(s => normalize(s.keyword).includes(nt) || normalize(s.label).includes(nt)).forEach(s => {
      results.push({ type: 'special', label: 'Filtro', value: s.value, displayLabel: s.label });
    });

    return results.slice(0, 12);
  }, [currentToken, uniqueClientes, uniqueEventos, uniqueCCs]);

  const handleSelectSuggestion = useCallback((suggestion: SmartSuggestion) => {
    const parts = searchTerm.split(',');
    parts.pop();
    const newValue = parts.length > 0
      ? parts.map(p => p.trim()).join(', ') + ', ' + suggestion.value
      : suggestion.value;
    setSearchTerm(newValue + ', ');
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    inputRef.current?.focus();
  }, [searchTerm]);

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => prev < suggestions.length - 1 ? prev + 1 : 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : suggestions.length - 1);
    } else if (e.key === 'Enter' && selectedSuggestionIndex >= 0) {
      e.preventDefault();
      handleSelectSuggestion(suggestions[selectedSuggestionIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  }, [showSuggestions, suggestions, selectedSuggestionIndex, handleSelectSuggestion]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current && !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (suggestions.length > 0 && currentToken.length >= 2) {
      setShowSuggestions(true);
      setSelectedSuggestionIndex(-1);
    } else {
      setShowSuggestions(false);
    }
  }, [suggestions, currentToken]);

  const filteredProjects = useMemo(() => {
    let result = projects.filter((p) => {
      const matchesDeleted = showDeleted || !p.isDeleted;
      const matchesStatus = statusFilter === "todos" || p.estado === statusFilter;
      
      const range = getDateRange();
      const projectStart = parseISO(p.fechaMontajeInicio);
      const projectEnd = parseISO(p.fechaEjecucionFin);
      const matchesDate = 
        isWithinInterval(projectStart, range) ||
        isWithinInterval(projectEnd, range) ||
        (projectStart <= range.start && projectEnd >= range.end);

      if (!matchesDeleted || !matchesStatus || !matchesDate) return false;

      // Smart search: check each token
      if (searchTokens.length === 0) return true;
      
      return searchTokens.every(token => {
        // Special filters
        if (token === "con:factura") return !!p.numFactura && p.numFactura.trim() !== "";
        if (token === "sin:factura") return !p.numFactura || p.numFactura.trim() === "";
        if (token === "con:cotizacion") return (p.cotizaciones || []).length > 0;
        if (token === "sin:cotizacion") return (p.cotizaciones || []).length === 0;
        if (token === "con:orden") return (p.ordenesCompra || []).length > 0;
        if (token === "sin:orden") return (p.ordenesCompra || []).length === 0;
        
        // General text search across all fields
        return (
          normalize(p.cliente || "").includes(token) ||
          normalize(p.evento || "").includes(token) ||
          normalize(p.centroCostos || "").includes(token) ||
          normalize(p.estado || "").includes(token) ||
          normalize(p.avanzada || "").includes(token) ||
          normalize(p.numFactura || "").includes(token) ||
          normalize(p.notas || "").includes(token)
        );
      });
    });

    // Sort
    if (sortColumn && sortDirection) {
      result = [...result].sort((a, b) => {
        const getVal = (proj: Project): string | number => {
          switch (sortColumn) {
            case "numFactura": return proj.numFactura || "";
            case "cliente": return proj.cliente || "";
            case "evento": return proj.evento || "";
            case "centroCostos": return proj.centroCostos || "";
            case "estado": return proj.estado || "";
            case "avanzada": return proj.avanzada || "";
            case "ingresoBruto": return proj.ingresoBruto || 0;
            case "ingresoTotal": return proj.ingresoTotal || 0;
            case "cotizaciones": return (proj.cotizaciones || []).length;
            case "ordenCompra": return (proj.ordenesCompra || []).length;
            case "notas": return proj.notas || "";
            case "fechaMontaje": return proj.fechaMontajeInicio || "";
            case "fechaEjecucion": return proj.fechaEjecucionInicio || "";
            case "fechaDesmontaje": return proj.fechaDesmontajeInicio || "";
            default: return (proj as any)[sortColumn] || "";
          }
        };

        const valA = getVal(a);
        const valB = getVal(b);
        
        const emptyA = valA === "" || valA === 0;
        const emptyB = valB === "" || valB === 0;

        // Empty placement
        if (emptyA && !emptyB) return emptyPlacement === "last" ? 1 : -1;
        if (!emptyA && emptyB) return emptyPlacement === "last" ? -1 : 1;
        if (emptyA && emptyB) return 0;

        const dir = sortDirection === "asc" ? 1 : -1;
        if (typeof valA === "number" && typeof valB === "number") return (valA - valB) * dir;
        return String(valA).localeCompare(String(valB)) * dir;
      });
    }

    return result;
  }, [projects, showDeleted, statusFilter, searchTokens, sortColumn, sortDirection, emptyPlacement, globalSelectedDate, globalViewMode, globalDateRange]);

  const handleColumnSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      if (sortDirection === "asc") setSortDirection("desc");
      else if (sortDirection === "desc") { setSortColumn(null); setSortDirection(null); }
    } else {
      setSortColumn(columnKey);
      setSortDirection("asc");
    }
  };

  const toggleEmptyPlacement = () => {
    setEmptyPlacement(prev => prev === "last" ? "first" : "last");
  };

  const handleSoftDelete = async (project: Project) => {
    if (!user) return;
    await softDeleteProject(project.id, user.email || "", user.id);
  };

  const handleRestore = async (project: Project) => {
    await restoreProject(project.id);
  };

  const getRowClassName = (project: Project) => {
    if (project.isDeleted) {
      return "row-deleted";
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
    { key: "centroCostos", header: "CC", type: "text" as CellType, width: "70px", visible: true, isCustom: false, order: 0 },
    { key: "cliente", header: "Cliente", type: "text" as CellType, width: "130px", visible: true, isCustom: false, order: 1 },
    { key: "evento", header: "Evento", type: "text" as CellType, width: "150px", visible: true, isCustom: false, order: 2 },
    { key: "avanzada", header: "Avanzada", type: "select" as CellType, width: "110px", visible: true, isCustom: false, order: 3 },
    { key: "fechaMontaje", header: "Montaje", type: "date" as CellType, width: "90px", visible: true, isCustom: false, order: 4 },
    { key: "fechaEjecucion", header: "Ejecución", type: "date" as CellType, width: "90px", visible: true, isCustom: false, order: 5 },
    { key: "fechaDesmontaje", header: "Desmontaje", type: "date" as CellType, width: "95px", visible: true, isCustom: false, order: 6 },
    { key: "estado", header: "Estado", type: "select" as CellType, width: "110px", visible: true, isCustom: false, order: 7 },
    { key: "ingresoBruto", header: "Ing. Bruto", type: "number" as CellType, width: "90px", visible: true, isCustom: false, order: 8 },
    { key: "ingresoTotal", header: "Ing. Total", type: "number" as CellType, width: "90px", visible: true, isCustom: false, order: 9 },
    { key: "cotizaciones", header: "Cotización", type: "file" as CellType, width: "85px", visible: true, isCustom: false, order: 10 },
    { key: "ordenCompra", header: "OC", type: "file" as CellType, width: "70px", visible: true, isCustom: false, order: 11 },
    { key: "numFactura", header: "#Factura", type: "text" as CellType, width: "75px", visible: true, isCustom: false, order: 12 },
    { key: "notas", header: "Notas", type: "text" as CellType, width: "110px", visible: true, isCustom: false, order: 13 },
  ], []);

  // Get all columns (base + managed) - direct calculation for immediate updates
  const allColumnConfigs = managedColumns.length > 0 ? managedColumns : baseColumnDefs;

  // Handle columns change from manager - force new array reference
  const handleColumnsChange = (newColumns: ColumnConfig[]) => {
    logger.debug('[PanelDirectivo] Received column changes:', newColumns.length, newColumns);
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
  const canEditDir = canEditDirectivo();
  const getColumnRender = (colConfig: ColumnConfig) => {
    // Special render functions for specific columns
    if (!canEditDir) {
      // Read-only mode for users without directivo edit permission
      switch (colConfig.key) {
        case "centroCostos":
          return (p: Project) => <span className="text-xs font-mono">{p.centroCostos || "—"}</span>;
        case "numFactura":
          return (p: Project) => <span className="text-xs font-mono">{p.numFactura || "—"}</span>;
        case "cliente":
          return (p: Project) => <span className="text-xs">{p.cliente || "—"}</span>;
        case "evento":
          return (p: Project) => (
            <EventLink eventId={p.id} eventName={p.evento} isDeleted={p.isDeleted} className="font-medium" source="directivo" />
          );
        case "avanzada":
          return (p: Project) => {
            const labels: Record<string, string> = { "NO_SE_HIZO": "No se hizo", "SE_HIZO": "Se hizo", "NO_ES_NECESARIO": "No es necesario" };
            return <Badge variant="outline" className="text-xs">{labels[p.avanzada] || p.avanzada || "—"}</Badge>;
          };
        case "fechaMontaje":
          return (p: Project) => p.fechaMontajeInicio ? (
            <div className="text-xs">
              <div>{format(parseISO(p.fechaMontajeInicio), "dd MMM", { locale: es })}</div>
              <div className="text-muted-foreground">- {format(parseISO(p.fechaMontajeFin), "dd MMM", { locale: es })}</div>
            </div>
          ) : <span className="text-xs text-muted-foreground">—</span>;
        case "fechaEjecucion":
          return (p: Project) => p.fechaEjecucionInicio ? (
            <div className="text-xs">
              <div>{format(parseISO(p.fechaEjecucionInicio), "dd MMM", { locale: es })}</div>
              <div className="text-muted-foreground">- {format(parseISO(p.fechaEjecucionFin), "dd MMM", { locale: es })}</div>
            </div>
          ) : <span className="text-xs text-muted-foreground">—</span>;
        case "fechaDesmontaje":
          return (p: Project) => p.fechaDesmontajeInicio && p.fechaDesmontajeFin ? (
            <div className="text-xs">
              <div>{format(parseISO(p.fechaDesmontajeInicio), "dd MMM", { locale: es })}</div>
              <div className="text-muted-foreground">- {format(parseISO(p.fechaDesmontajeFin), "dd MMM", { locale: es })}</div>
            </div>
          ) : <span className="text-xs text-muted-foreground">—</span>;
        case "estado":
          return (p: Project) => {
            const statusLabels: Record<string, string> = { por_planear: "Por Planear", por_ejecutar: "Por Ejecutar", en_progreso: "En Progreso", terminado: "Terminado", facturado: "Facturado" };
            return <Badge variant="outline" className="text-xs">{statusLabels[p.estado] || p.estado}</Badge>;
          };
        case "ingresoBruto":
          return (p: Project) => <span className="text-xs font-mono">{p.ingresoBruto ? `$ ${p.ingresoBruto.toLocaleString("es-CO")}` : "—"}</span>;
        case "ingresoTotal":
          return (p: Project) => <span className="text-xs font-mono text-primary">{p.ingresoTotal ? `$ ${p.ingresoTotal.toLocaleString("es-CO")}` : "—"}</span>;
        case "cotizaciones":
          return (p: Project) => <span className="text-xs">{(p.cotizaciones || []).length > 0 ? `${(p.cotizaciones || []).length} archivo(s)` : "—"}</span>;
        case "ordenCompra":
          return (p: Project) => <span className="text-xs">{(p.ordenesCompra || []).length > 0 ? `${(p.ordenesCompra || []).length} archivo(s)` : "—"}</span>;
        case "notas":
          return (p: Project) => (
            <div className="flex items-center gap-1 max-w-[150px]">
              <span className="text-xs truncate">{p.notas || "—"}</span>
              {p.notas && p.notas.trim() && (
                <button onClick={() => setNotaExpandida({ evento: p.evento, nota: p.notas })} className="shrink-0 p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Ver nota completa">
                  <Eye className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        default:
          return (p: Project) => <span className="text-xs">{(p as any)[colConfig.key] || "—"}</span>;
      }
    }
    switch (colConfig.key) {
      case "centroCostos":
        return (p: Project) => (
          <EditableCell
            value={p.centroCostos}
            type="text"
            onChange={(value) => updateProject(p.id, "centroCostos", value)}
            className="font-mono"
            placeholder="Ej: 3-00814"
          />
        );
      case "numFactura":
        return (p: Project) => (
          <EditableCell
            value={p.numFactura}
            type="text"
            onChange={(value) => updateProject(p.id, "numFactura", value)}
            className="font-mono"
            placeholder="Nº factura"
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
          <EventLink
            eventId={p.id}
            eventName={p.evento}
            isDeleted={p.isDeleted}
            className="font-medium"
            source="directivo"
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
      case "fechaDesmontaje":
        return (p: Project) => (
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
                <div className="text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm bg-gantt-desmontaje" />
                    {format(parseISO(p.fechaDesmontajeInicio), "dd MMM", { locale: es })}
                  </div>
                  <div className="text-muted-foreground">
                    - {format(parseISO(p.fechaDesmontajeFin), "dd MMM", { locale: es })}
                  </div>
                </div>
              ) : (
                <span className="text-muted-foreground text-xs hover:text-primary cursor-pointer">+ Agregar</span>
              )
            }
          />
        );
      case "administrativoResponsable":
        return (p: Project) => (
          <EditableCell
            value={p.administrativoResponsable}
            type="text"
            onChange={(value) => updateProject(p.id, "administrativoResponsable", value)}
            placeholder="Asignar responsable"
          />
        );
      case "ingresoTotal":
        return (p: Project) => (
          <EditableCell
            value={p.ingresoTotal}
            type="number"
            onChange={(value) => updateProject(p.id, "ingresoTotal", value)}
            className="text-primary"
            placeholder="$ Ingreso total"
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
          <div className={cn((p.cotizaciones || []).length === 0 && "ring-2 ring-red-500 rounded-md")}>
            <PurchaseOrderUpload
              attachments={p.cotizaciones || []}
              onAttachmentsChange={(attachments) => updateProject(p.id, "cotizaciones", attachments)}
              currentIngresoBruto={p.ingresoBruto}
              currentIngresoTotal={p.ingresoTotal}
              projectId={p.id}
              placeholderText="Cargar CO"
              onDataExtracted={(ingresoBruto, ingresoTotal, inventarioItems) => {
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
      case "ordenCompra":
        return (p: Project) => (
          <div className={cn((p.ordenesCompra || []).length === 0 && "ring-2 ring-red-500 rounded-md")}>
            <PurchaseOrderUpload
              attachments={p.ordenesCompra || []}
              onAttachmentsChange={(attachments) => updateProject(p.id, "ordenesCompra", attachments)}
              currentIngresoBruto={p.ingresoBruto}
              currentIngresoTotal={p.ingresoTotal}
              projectId={p.id}
              placeholderText="Cargar OC"
              onDataExtracted={(ingresoBruto, ingresoTotal, inventarioItems) => {
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
      case "estado":
        return (p: Project) => (
          <StatusSelect
            value={p.estado}
            onChange={(value) => updateProject(p.id, "estado", value)}
          />
        );
      case "notas":
        return (p: Project) => (
          <div className="flex items-center gap-1 max-w-[150px]">
            <EditableCell
              value={p.notas}
              type="text"
              onChange={(value) => updateProject(p.id, "notas", value)}
              className="truncate text-xs flex-1 min-w-0"
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

  // Build final columns array with sortable headers
  const columns = (() => {
    const visibleColumns = allColumnConfigs
      .filter(col => col.visible)
      .sort((a, b) => a.order - b.order)
      .map(col => ({
        key: col.key,
        header: (
          <button
            className="flex items-center gap-1 hover:text-primary transition-colors w-full text-left"
            onClick={(e) => { e.stopPropagation(); handleColumnSort(col.key); }}
            title={`Ordenar por ${col.header}`}
          >
            <span>{col.header}</span>
            {sortColumn === col.key ? (
              sortDirection === "asc" ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />
            ) : (
              <ArrowUpDown className="h-3 w-3 opacity-30" />
            )}
          </button>
        ),
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
      <div className={isMobile ? "space-y-2 px-2 pt-1" : "space-y-6"}>
        <PanelHeader
          title="Panel Directivo"
          description="Gestión ejecutiva de proyectos y control de ingresos"
          panelLinks={[
            { label: "General", to: "/panel-general" },
            { label: "Operaciones", to: "/panel-operaciones" },
            { label: "Proveedores", to: "/proveedores" },
          ]}
          actions={
            <div className={`flex ${isMobile ? 'flex-col gap-1.5' : 'gap-2'}`}>
              {isAdmin && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={initializeColumns}
                  className={isMobile ? 'h-8 text-xs px-2.5' : ''}
                >
                  <Settings className={isMobile ? 'h-3.5 w-3.5 mr-1' : 'h-4 w-4 mr-2'} />
                  {isMobile ? 'Columnas' : 'Gestionar Columnas'}
                </Button>
              )}
              <Button 
                size="sm" 
                onClick={() => setNewProjectOpen(true)}
                className={isMobile ? 'h-8 text-xs px-2.5' : ''}
              >
                <Plus className={isMobile ? 'h-3.5 w-3.5 mr-1' : 'h-4 w-4 mr-2'} />
                {isMobile ? 'Nuevo' : 'Nuevo Proyecto'}
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

        <Tabs defaultValue="tabla" className={isMobile ? "space-y-2" : "space-y-4"}>
          {/* Mobile-optimized: toggle visible without scroll */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Toggle always visible first on mobile */}
            <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
              <TabsList className={isMobile ? 'w-full h-8' : ''}>
                <TabsTrigger value="tabla" className={isMobile ? 'flex-1 h-7 text-xs px-2.5' : ''}>Tabla</TabsTrigger>
                <TabsTrigger value="gantt" className={isMobile ? 'flex-1 h-7 text-xs px-2.5' : ''}>Gantt</TabsTrigger>
                <TabsTrigger value="dashboard" className={isMobile ? 'flex-1 h-7 text-xs px-2.5' : ''}>Dashboard</TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-2">
                <Switch
                  id="show-deleted"
                  checked={showDeleted}
                  onCheckedChange={setShowDeleted}
                  className={isMobile ? 'scale-90' : ''}
                />
                <Label htmlFor="show-deleted" className={`cursor-pointer whitespace-nowrap ${isMobile ? 'text-xs text-muted-foreground' : 'text-sm text-muted-foreground'}`}>
                  Mostrar eliminados
                </Label>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={sortColumn === "fechaMontaje" ? "default" : "outline"}
                size="sm"
                onClick={() => handleColumnSort("fechaMontaje")}
                className={`text-xs whitespace-nowrap gap-1.5 ${isMobile ? 'h-8 px-2.5' : 'h-9'}`}
                title={sortColumn === "fechaMontaje" && sortDirection === "asc" ? "Montaje: Más antiguo primero" : sortColumn === "fechaMontaje" && sortDirection === "desc" ? "Montaje: Más reciente primero" : "Ordenar por Montaje"}
              >
                {sortColumn === "fechaMontaje" && sortDirection === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : sortColumn === "fechaMontaje" && sortDirection === "desc" ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5" />}
                Montaje
              </Button>
              <div className={isMobile ? 'relative w-full' : 'relative w-80'}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                <Input
                  ref={inputRef}
                  placeholder="Buscar: cliente, estado, con factura, sin orden..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  onFocus={() => { if (suggestions.length > 0 && currentToken.length >= 2) setShowSuggestions(true); }}
                  className={isMobile ? 'pl-9 h-8 text-sm' : 'pl-9 h-9'}
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div
                    ref={suggestionsRef}
                    className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border border-border rounded-md shadow-lg overflow-hidden max-h-64 overflow-y-auto"
                  >
                    {suggestions.map((s, idx) => (
                      <button
                        key={`${s.type}-${s.value}`}
                        className={cn(
                          "w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-accent transition-colors",
                          idx === selectedSuggestionIndex && "bg-accent"
                        )}
                        onClick={() => handleSelectSuggestion(s)}
                        onMouseEnter={() => setSelectedSuggestionIndex(idx)}
                      >
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">{s.label}</Badge>
                        <span className="truncate">{s.displayLabel}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {sortColumn && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleEmptyPlacement}
                  className="text-xs h-9 whitespace-nowrap"
                  title={`Vacíos: ${emptyPlacement === "last" ? "al final" : "al inicio"}`}
                >
                  {emptyPlacement === "last" ? "Vacíos al final" : "Vacíos al inicio"}
                </Button>
              )}
            </div>
          </div>

          <TabsContent value="tabla" className={isMobile ? "mt-2" : "mt-4"}>
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
          columns={managedColumns.length > 0 ? managedColumns : defaultColumns}
          onColumnsChange={setManagedColumns}
          panelName="Panel Directivo"
          readOnly={!canModifyStructure}
        />
      </div>

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
    </Layout>
  );
};

export default PanelDirectivo;
