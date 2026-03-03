import { useState, useMemo, useEffect, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNavigate, useSearchParams } from "react-router-dom";
import { logger } from "@/lib/logger";
import Layout from "@/components/Layout";
import { PanelHeader } from "@/components/PanelHeader";
import { MatrixTable } from "@/components/MatrixTable";
import { DragReorderHandle } from "@/components/DragReorderHandle";
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
import { InventarioResponsablesSelector, ResponsableAutoLog } from "@/components/InventarioResponsablesSelector";
import { useGlobalColumns } from "@/hooks/useGlobalColumns";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/contexts/ProjectsContext";
import { useEmpleados } from "@/contexts/EmpleadosContext";
import { useDateRange } from "@/contexts/DateRangeContext";
import { supabase } from "@/integrations/supabase/client";
import { Project, PersonalItem, InventarioItem, CajaMenorItem, LegalizacionItem, ProjectStatus, CalendarViewMode, Attachment, RelacionGastoEntry } from "@/types";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Search, Users, Package, FileText, FileDown, Settings, Plus, StickyNote, Loader2, Trash2, MessageSquare, Wallet, FileSpreadsheet, ChevronDown, Clock, Lock, ArrowUp, ArrowDown, X, Paperclip, Upload, Image, AlertTriangle, Eye } from "lucide-react";
import { format, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";
import { printPersonal, printInventario, printCotizaciones, printPersonalYInventario, printSolicitudPresupuesto, printLegalizacion, exportSolicitudToExcel, exportLegalizacionToExcel } from "@/utils/pdfGenerator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { HorarioFormDialog } from "@/components/HorarioFormDialog";
import { CajaMenorStatusIcon } from "@/components/CajaMenorStatusIcon";
import { useGastosMenores } from "@/hooks/useGastosMenores";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PhotoExportDialog, PhotoExportItem } from "@/components/PhotoExportDialog";

// (Legacy responsable helpers removed - now using auto-login system)

// ============= RelacionGastosEditor: isolated component with local state =============
interface RelacionGastosEditorProps {
  entries: RelacionGastoEntry[];
  isFullyLocked: boolean;
  canEdit: boolean;
  valorAnticipo: number;
  onUpdate: (updated: RelacionGastoEntry[]) => void;
  projectId?: string;
  cmId?: string;
  isSolicitudAprobada?: boolean;
}

function RelacionGastosEditor({ entries, isFullyLocked, canEdit, valorAnticipo, onUpdate, projectId, cmId, isSolicitudAprobada }: RelacionGastosEditorProps) {
  const [localEntries, setLocalEntries] = useState<RelacionGastoEntry[]>(entries);
  const [newComercio, setNewComercio] = useState("");
  const [newNit, setNewNit] = useState("");
  const [newConcepto, setNewConcepto] = useState("");
  const [newValor, setNewValor] = useState("");
  const prevEntriesRef = useRef<string>("");

  useEffect(() => {
    const serialized = JSON.stringify(entries);
    if (serialized !== prevEntriesRef.current) {
      prevEntriesRef.current = serialized;
      setLocalEntries(entries);
    }
  }, [entries]);

  const currentSum = localEntries.reduce((s, e) => s + (e.valor || 0), 0);
  const exceedsLimit = valorAnticipo > 0 && currentSum > valorAnticipo;

  const updateEntry = (idx: number, field: keyof RelacionGastoEntry, value: string | number | undefined) => {
    const updated = localEntries.map((e, i) => i === idx ? { ...e, [field]: value } : e);
    setLocalEntries(updated);
    onUpdate(updated);
  };

  const deleteEntry = (idx: number) => {
    const updated = localEntries.filter((_, i) => i !== idx);
    setLocalEntries(updated);
    onUpdate(updated);
  };

  const addEntry = () => {
    const comercio = newComercio.trim();
    const nitCedula = newNit.trim();
    const concepto = newConcepto.trim();
    const valor = parseFloat(newValor) || 0;
    if (!comercio && !nitCedula && !concepto && !valor) return;

    const updated = [...localEntries, { comercio, nitCedula, concepto, valor }];
    setLocalEntries(updated);
    onUpdate(updated);
    setNewComercio("");
    setNewNit("");
    setNewConcepto("");
    setNewValor("");
  };

  const handleImageUpload = async (idx: number, file: File) => {
    const ext = file.name.split('.').pop();
    const path = `relacion-gastos/${projectId}/${cmId}/${idx}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("notes-images").upload(path, file);
    if (error) { toast.error("Error al subir imagen"); return; }
    const { data: urlData } = supabase.storage.from("notes-images").getPublicUrl(path);
    updateEntry(idx, "imagen_url", urlData.publicUrl);
  };

  return (
    <div className="flex flex-col gap-1.5 min-w-[300px]">
      {localEntries.map((entry, idx) => (
        <div key={idx} className="flex flex-col gap-0.5 border-b border-border/40 pb-1">
          <div className="flex items-center gap-1 text-xs">
            {!isFullyLocked && canEdit ? (
              <div className="flex-1 grid grid-cols-4 gap-1">
                <Input
                  className="h-6 text-xs px-1"
                  value={entry.comercio || ""}
                  placeholder="Comercio"
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => updateEntry(idx, "comercio", e.target.value)}
                />
                <Input
                  className="h-6 text-xs px-1"
                  value={entry.nitCedula || ""}
                  placeholder="NIT/Cédula"
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => updateEntry(idx, "nitCedula", e.target.value)}
                />
                <Input
                  className="h-6 text-xs px-1"
                  value={entry.concepto || ""}
                  placeholder="Concepto"
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => updateEntry(idx, "concepto", e.target.value)}
                />
                <div className="relative">
                  <span className="absolute left-1 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">$</span>
                  <Input
                    className="h-6 text-xs pl-4 pr-1 font-mono text-right"
                    type="text"
                    inputMode="numeric"
                    value={entry.valor ? entry.valor.toLocaleString('es-CO') : ""}
                    placeholder="0"
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9\-]/g, "");
                      updateEntry(idx, "valor", parseInt(raw) || 0);
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1 grid grid-cols-4 gap-1">
                <span className="truncate" title={entry.comercio}>{entry.comercio || "—"}</span>
                <span className="truncate" title={entry.nitCedula}>{entry.nitCedula || "—"}</span>
                <span className="truncate" title={entry.concepto}>{entry.concepto || "—"}</span>
                <span className="truncate text-right font-mono">$ {(entry.valor || 0).toLocaleString('es-CO')}</span>
              </div>
            )}
            {/* Image attachment inline */}
            {isSolicitudAprobada && (
              <div className="shrink-0">
                {entry.imagen_url ? (
                  <div className="flex items-center gap-0.5">
                    <a href={entry.imagen_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                      <Paperclip className="h-3 w-3" />
                    </a>
                    {!isFullyLocked && canEdit && (
                      <button
                        type="button"
                        className="h-4 w-4 flex items-center justify-center text-muted-foreground hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); updateEntry(idx, "imagen_url", undefined); }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ) : !isFullyLocked && canEdit ? (
                  <label className={`flex items-center gap-0.5 cursor-pointer text-xs text-muted-foreground hover:text-primary transition-colors ${!entry.imagen_url ? "text-destructive" : ""}`}>
                    <Upload className="h-3 w-3" />
                    <input type="file" accept="image/*" className="hidden" onClick={(e) => e.stopPropagation()} onChange={async (e) => {
                      e.stopPropagation();
                      const file = e.target.files?.[0];
                      if (file) await handleImageUpload(idx, file);
                    }} />
                  </label>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>
            )}
            {!isFullyLocked && canEdit && (
              <button
                type="button"
                className="h-5 w-5 flex items-center justify-center text-muted-foreground hover:text-destructive shrink-0"
                onClick={(e) => { e.stopPropagation(); deleteEntry(idx); }}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      ))}

      {!isFullyLocked && canEdit && (
        <div className="flex items-center gap-1">
          <div className="grid grid-cols-4 gap-1 flex-1">
            <Input
              className="h-7 text-xs"
              placeholder="Comercio"
              value={newComercio}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setNewComercio(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEntry(); } }}
            />
            <Input
              className="h-7 text-xs"
              placeholder="NIT/Cédula"
              value={newNit}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setNewNit(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEntry(); } }}
            />
            <Input
              className="h-7 text-xs"
              placeholder="Concepto"
              value={newConcepto}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setNewConcepto(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEntry(); } }}
            />
            <div className="relative">
              <span className="absolute left-1 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">$</span>
              <Input
                className="h-7 text-xs pl-4 pr-1 font-mono text-right"
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={newValor ? parseInt(newValor.replace(/[^0-9\-]/g, "") || "0").toLocaleString('es-CO') : ""}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9\-]/g, "");
                  setNewValor(raw);
                }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEntry(); } }}
              />
            </div>
          </div>
          <button
            type="button"
            className="h-7 w-7 flex items-center justify-center border border-border rounded-md hover:bg-accent shrink-0"
            onClick={(e) => { e.stopPropagation(); addEntry(); }}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      )}

      {localEntries.length === 0 && isFullyLocked && (
        <span className="text-xs text-muted-foreground">Sin datos de relación de gastos</span>
      )}

    </div>
  );
}

const PanelOperaciones = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const { canEditStructure, role, canViewFeedback, canEditFeedback, canApproveCajaMenor, canCrearAnticipos, canEditOperaciones } = useUserRole();
  const { user } = useAuth();
  const { projects, loading, updateProject: contextUpdateProject, updateProjectMultiple } = useProjects();
  const { empleados } = useEmpleados();
  const { globalDateRange, setGlobalDateRange, globalViewMode, setGlobalViewMode, globalSelectedDate, setGlobalSelectedDate } = useDateRange();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [highlightedProjectId, setHighlightedProjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"matriz" | "gantt">("matriz");
  const [columnManagerOpen, setColumnManagerOpen] = useState(false);
  const eventIdHandledRef = useRef<string | null>(null);
  // Initialize with base columns - persisted to localStorage
  const defaultColumns: ColumnConfig[] = [
    { key: "centroCostos", header: "CC", type: "text" as CellType, width: "100px", visible: true, isCustom: false, order: 0 },
    { key: "numFactura", header: "#Factura", type: "text" as CellType, width: "80px", visible: true, isCustom: false, order: 1 },
    { key: "cliente", header: "Cliente", type: "text" as CellType, width: "150px", visible: true, isCustom: false, order: 2 },
    { key: "evento", header: "Evento", type: "text" as CellType, width: "180px", visible: true, isCustom: false, order: 3 },
    { key: "avanzada", header: "Avanzada", type: "select" as CellType, width: "130px", visible: true, isCustom: false, order: 4, options: ["No se hizo", "Se hizo", "No es necesario"] },
    { key: "fechaMontaje", header: "Montaje", type: "date" as CellType, width: "110px", visible: true, isCustom: false, order: 5 },
    { key: "fechaEjecucion", header: "Ejecución", type: "date" as CellType, width: "110px", visible: true, isCustom: false, order: 6 },
    { key: "fechaDesmontaje", header: "Desmontaje", type: "date" as CellType, width: "110px", visible: true, isCustom: false, order: 7 },
    { key: "estado", header: "Estado", type: "select" as CellType, width: "130px", visible: true, isCustom: false, order: 8 },
    { key: "jefeOperaciones", header: "Jefe Ops", type: "text" as CellType, width: "120px", visible: true, isCustom: false, order: 9 },
    { key: "aCargoDe", header: "A Cargo", type: "text" as CellType, width: "100px", visible: true, isCustom: false, order: 10 },
    { key: "productor", header: "Productor", type: "text" as CellType, width: "110px", visible: true, isCustom: false, order: 11 },
    { key: "ubicacion", header: "Ubicación", type: "text" as CellType, width: "150px", visible: true, isCustom: false, order: 12 },
    { key: "formatoPreproduccion", header: "Formato", type: "file" as CellType, width: "80px", visible: true, isCustom: false, order: 13 },
    { key: "personal", header: "Personal", type: "text" as CellType, width: "80px", visible: true, isCustom: false, order: 14 },
    { key: "cotizacionProveedor", header: "Cot. Prov", type: "file" as CellType, width: "80px", visible: true, isCustom: false, order: 15 },
    { key: "ordenCompraOCR", header: "OC + OCR", type: "file" as CellType, width: "120px", visible: true, isCustom: false, order: 16 },
    { key: "notas", header: "Notas", type: "text" as CellType, width: "150px", visible: true, isCustom: false, order: 17 },
    { key: "inventario", header: "Inventario", type: "text" as CellType, width: "80px", visible: true, isCustom: false, order: 18 },
    { key: "cajaMenor", header: "Gasto", type: "text" as CellType, width: "100px", visible: true, isCustom: false, order: 19 },
    { key: "panelGeneral", header: "Panel", type: "text" as CellType, width: "80px", visible: true, isCustom: false, order: 20 },
  ];
  const { columns: managedColumns, setColumns: setManagedColumns, loading: columnsLoading, isAdmin: canModifyStructure } = useGlobalColumns("panel-operaciones", defaultColumns);
  
  // Calendar filter state - using global context
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "todos">("todos");
  const [hideDeleted, setHideDeleted] = useState(false);
  const [notaExpandida, setNotaExpandida] = useState<{ evento: string; nota: string } | null>(null);
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
  const [photoExportOpen, setPhotoExportOpen] = useState(false);
  const [photoExportData, setPhotoExportData] = useState<{ title: string; subtitle: string; photos: PhotoExportItem[] }>({ title: "", subtitle: "", photos: [] });
  // Estado para errores inline de Caja Menor (visible en el modal)
  const [cajaMenorValidationErrors, setCajaMenorValidationErrors] = useState<string[]>([]);
  // Estados para opciones de exportación - checkboxes
  const [includeLegalizacionInExport, setIncludeLegalizacionInExport] = useState(false);
  const [includeSolicitudInExport, setIncludeSolicitudInExport] = useState(false);
  
  // Gastos menores for the current project's centroCostos
  const gastosMenoresCentroCostos = selectedProject ? (projects.find(p => p.id === selectedProject.id) || selectedProject)?.centroCostos : undefined;
  const { gastos: gastosMenoresForProject } = useGastosMenores(gastosMenoresCentroCostos || undefined);

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

  // State to track if we're in "focus mode" (navigated via eventId link)
  const [focusedEventId, setFocusedEventId] = useState<string | null>(null);
  const [focusedEventName, setFocusedEventName] = useState<string | null>(null);
  const [focusedEventSource, setFocusedEventSource] = useState<string | null>(null);

  // Helper function to scroll to element with retry mechanism
  const scrollToEventWithRetry = (eventId: string, maxAttempts = 10) => {
    let attempts = 0;
    const tryScroll = () => {
      const rowElement = document.querySelector(`[data-project-id="${eventId}"]`);
      if (rowElement) {
        rowElement.scrollIntoView({ behavior: "smooth", block: "center" });
        rowElement.classList.add("event-focus-pulse");
        return true;
      }
      attempts++;
      if (attempts < maxAttempts) {
        requestAnimationFrame(tryScroll);
      }
      return false;
    };
    // Start after a short delay to allow React to render
    setTimeout(() => tryScroll(), 100);
  };

  // Exit focus mode - returns to normal filtered view
  const exitFocusMode = () => {
    setFocusedEventId(null);
    setFocusedEventName(null);
    setFocusedEventSource(null);
    setHighlightedProjectId(null);
    // Clean up pulse class
    document.querySelectorAll('.event-focus-pulse').forEach(el => {
      el.classList.remove('event-focus-pulse');
    });
  };

  // Handle eventId URL parameter - FOCUS MODE: bypass all filters and show only this event
  useEffect(() => {
    const eventId = searchParams.get("eventId");
    const source = searchParams.get("source") || "link";
    
    if (!eventId || loading || projects.length === 0) return;

    // Prevent handling the same eventId multiple times in a row
    if (eventIdHandledRef.current === eventId) return;
    eventIdHandledRef.current = eventId;

    // Find the project (search in ALL projects, including deleted)
    const project = projects.find((p) => p.id === eventId);
    if (!project) {
      toast.error("Evento no encontrado");
      setSearchParams({}, { replace: true });
      eventIdHandledRef.current = null;
      return;
    }

    // === ACTIVATE FOCUS MODE ===
    // This bypasses ALL filters by setting focusedEventId
    setFocusedEventId(eventId);
    setFocusedEventName(project.evento);
    setFocusedEventSource(source);
    setHighlightedProjectId(eventId);

    // Switch to matrix tab
    setActiveTab("matriz");

    // Show toast notification
    toast.success(`Evento "${project.evento}" localizado`, {
      description: "Modo foco activado - mostrando solo este evento",
      duration: 4000,
    });

    // Scroll to the row with retry mechanism
    scrollToEventWithRetry(eventId);

    // Clear the URL param after handling
    setTimeout(() => {
      setSearchParams({}, { replace: true });
      eventIdHandledRef.current = null;
    }, 300);

  }, [searchParams, loading, projects, setSearchParams]);

  // Check if user is admin
  const isAdmin = role?.toLowerCase() === "administrador";
  // Operativos without productor permission are read-only (except Recursos propios)
  const operativoReadOnly = !canEditOperaciones();
  
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
  
  // Helper to check if a record is approved (locked)
  const isRecordApproved = (record: CajaMenorItem): boolean => {
    return record.estado === "Aprobado";
  };

  // Helper to check if the current user is the creator/owner of a record
  const isCreatorOfRecord = (record: { empleadoEmail?: string; empleadoId?: string }): boolean => {
    if (!currentUserEmail) return false;
    if (record.empleadoEmail?.toLowerCase() === currentUserEmail) return true;
    if (currentUserEmpleado?.id && record.empleadoId === currentUserEmpleado.id) return true;
    return false;
  };

  // Helper to check if user can edit a Caja Menor record (content fields)
  // ONLY the creator of the anticipo can edit content fields
  // Admins can only change estado (approve/reject)
  const canEditCajaMenorRecord = (record: CajaMenorItem): boolean => {
    // If approved, no one can edit content (estado changes handled separately)
    if (isRecordApproved(record)) return false;
    
    // Only the creator can edit content fields
    return isCreatorOfRecord(record);
  };
  
  // Get row class name for approved records
  const getCajaMenorRowClassName = (record: CajaMenorItem): string => {
    if (isRecordApproved(record)) {
      return "caja-menor-row-approved";
    }
    return "";
  };

  const updateProject = (projectId: string, field: string, value: any) => {
    contextUpdateProject(projectId, field, value);
  };

  // Helper to get or assign solicitud de anticipo number via RPC
  const getOrAssignSolicitudNum = async (projectId: string): Promise<number | null> => {
    try {
      const { data, error } = await supabase.rpc('assign_solicitud_anticipo_num', { p_project_id: projectId });
      if (error) {
        console.error('[PanelOperaciones] Error assigning solicitud num:', error);
        toast.error('Error al asignar número de solicitud');
        return null;
      }
      return data as number;
    } catch (err) {
      console.error('[PanelOperaciones] Exception assigning solicitud num:', err);
      toast.error('Error al asignar número de solicitud');
      return null;
    }
  };

  const handleColumnsChange = (newColumns: ColumnConfig[]) => {
    // Create new array to ensure React detects the change
    logger.debug('[PanelOperaciones] handleColumnsChange called with:', newColumns.length, 'columns');
    const copiedColumns = newColumns.map(col => ({ ...col }));
    setManagedColumns(copiedColumns);
  };

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

  // FOCUS MODE: If focusedEventId is set, ONLY show that event (bypass all filters)
  const filteredProjects = useMemo(() => {
    // Focus mode - show ONLY the focused event, ignoring all filters
    if (focusedEventId) {
      const focused = projects.find(p => p.id === focusedEventId);
      return focused ? [focused] : [];
    }
    
    // Normal filter mode
    return projects.filter((p) => {
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
  }, [focusedEventId, projects, hideDeleted, searchTerm, statusFilter, globalViewMode, globalSelectedDate, globalDateRange]);

  const handleGanttProjectClick = (projectId: string) => {
    // Find the project
    const project = projects.find((p) => p.id === projectId);
    
    // Activate focus mode (same as external navigation)
    setFocusedEventId(projectId);
    setFocusedEventName(project?.evento || null);
    setFocusedEventSource("gantt");
    setHighlightedProjectId(projectId);
    setActiveTab("matriz");

    // Show toast
    if (project) {
      toast.success(`Evento "${project.evento}" seleccionado`, {
        description: "Modo foco activado",
        duration: 2000,
      });
    }

    // Scroll to the row with retry mechanism
    scrollToEventWithRetry(projectId);
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
              disabled={operativoReadOnly}
            />
          );
        case "numFactura":
          return (
            <EditableCell
              value={p.numFactura}
              type="text"
              onChange={(value) => updateProject(p.id, "numFactura", value)}
              className="font-mono"
              disabled={operativoReadOnly}
            />
          );
        case "cliente":
          return operativoReadOnly ? (
            <span className="text-sm truncate">{p.cliente || "-"}</span>
          ) : (
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
              disabled={operativoReadOnly}
            />
          );
        case "avanzada":
          return operativoReadOnly ? (
            <span className="text-xs">{p.avanzada || "-"}</span>
          ) : (
            <AvanzadaSelect
              value={p.avanzada}
              onChange={(value) => updateProject(p.id, "avanzada", value)}
            />
          );
        case "fechaMontaje":
          return operativoReadOnly ? (
            <div className="text-xs flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm bg-gantt-montaje" />
              {format(parseISO(p.fechaMontajeInicio), "dd/MM")}
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
                <div className="text-xs flex items-center gap-1">
                  <div className="w-2 h-2 rounded-sm bg-gantt-montaje" />
                  {format(parseISO(p.fechaMontajeInicio), "dd/MM")}
                </div>
              }
            />
          );
        case "fechaEjecucion":
          return operativoReadOnly ? (
            <div className="text-xs flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm bg-gantt-ejecucion" />
              {format(parseISO(p.fechaEjecucionInicio), "dd/MM")}
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
                <div className="text-xs flex items-center gap-1">
                  <div className="w-2 h-2 rounded-sm bg-gantt-ejecucion" />
                  {format(parseISO(p.fechaEjecucionInicio), "dd/MM")}
                </div>
              }
            />
          );
        case "fechaDesmontaje":
          return operativoReadOnly ? (
            p.fechaDesmontajeInicio && p.fechaDesmontajeFin ? (
              <div className="text-xs flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm bg-gantt-desmontaje" />
                {format(parseISO(p.fechaDesmontajeInicio), "dd/MM")}
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
                  <div className="text-xs flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm bg-gantt-desmontaje" />
                    {format(parseISO(p.fechaDesmontajeInicio), "dd/MM")}
                  </div>
                ) : (
                  <span className="text-muted-foreground text-xs hover:text-primary cursor-pointer">+ Agregar</span>
                )
              }
            />
          );
        case "estado":
          return operativoReadOnly ? (
            <Badge variant="outline" className="text-[10px]">{p.estado.replace(/_/g, ' ')}</Badge>
          ) : (
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
              disabled={operativoReadOnly}
            />
          );
        case "aCargoDe":
          return (
            <EditableCell
              value={p.aCargoDe}
              type="text"
              onChange={(value) => updateProject(p.id, "aCargoDe", value)}
              disabled={operativoReadOnly}
            />
          );
        case "productor":
          return (
            <EditableCell
              value={p.productor}
              type="text"
              onChange={(value) => updateProject(p.id, "productor", value)}
              disabled={operativoReadOnly}
            />
          );
        case "ubicacion":
          return (
            <EditableCell
              value={p.ubicacion}
              type="text"
              onChange={(value) => updateProject(p.id, "ubicacion", value)}
              disabled={operativoReadOnly}
            />
          );
        case "formatoPreproduccion":
          return operativoReadOnly ? (
            <span className="text-xs text-muted-foreground">{(p.formatoPreproduccion || []).length || "—"}</span>
          ) : (
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
          return operativoReadOnly ? (
            <span className="text-xs text-muted-foreground">{(p.cotizacionesProveedor || []).length || "—"}</span>
          ) : (
            <AttachmentButton
              attachments={p.cotizacionesProveedor || []}
              onAttachmentsChange={(attachments) => updateProject(p.id, "cotizacionesProveedor", attachments)}
              multiple
              projectId={p.id}
              fieldName="cotizacionesProveedor"
            />
          );
        case "ordenCompraOCR":
          return operativoReadOnly ? (
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
                currentIngresoBruto={p.ingresoBruto}
                currentIngresoTotal={p.ingresoTotal}
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
        case "notas":
          return (
            <div className="flex items-center gap-1 max-w-[150px]">
              <EditableCell
                value={p.notas}
                type="text"
                onChange={(value) => updateProject(p.id, "notas", value)}
                className="truncate text-xs flex-1 min-w-0"
                disabled={operativoReadOnly}
              />
              {p.notas && p.notas.trim() && (
                <button
                  onClick={(e) => { e.stopPropagation(); setNotaExpandida({ evento: p.evento, nota: p.notas }); }}
                  className="shrink-0 p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="Ver nota completa"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
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
            <div className="flex items-center gap-2">
              <CajaMenorStatusIcon cajaMenor={p.cajaMenor || []} legalizacion={p.legalizacion || []} />
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
            </div>
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
              disabled={operativoReadOnly}
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

  // Helper function to create cotizacion history records when attachments are added
  const createCotizacionHistoryFromAttachments = async (
    projectId: string,
    personalItem: PersonalItem,
    newAttachments: Attachment[],
    previousAttachments: Attachment[]
  ) => {
    // Only process for Proveedor or Transporte types with proveedorId
    if (!personalItem.proveedorId || (personalItem.tipoPersonal !== "Proveedor" && personalItem.tipoPersonal !== "Transporte")) {
      logger.debug("[CotizacionHistory] Skipping - not Proveedor/Transporte or no proveedorId");
      return;
    }

    logger.debug("[CotizacionHistory] Processing attachments:", {
      newCount: newAttachments?.length || 0,
      previousCount: previousAttachments?.length || 0,
      tipoPersonal: personalItem.tipoPersonal,
      proveedorId: personalItem.proveedorId
    });

    const getAttachmentKey = (a: Attachment): string => {
      // Primary identifier: unique id
      if (a.id) return `id:${a.id}`;
      // Secondary: bucket + filePath combination
      if (a.filePath) return `path:${a.bucket || 'default'}:${a.filePath}`;
      // Fallback: name + uploadedAt + size for uniqueness
      return `fallback:${a.name || "archivo"}:${a.uploadedAt || ""}:${a.size || 0}`;
    };

    // Find truly new attachments (not in previous)
    const previousKeys = new Set((previousAttachments || []).map(a => {
      const key = getAttachmentKey(a);
      return key;
    }));
    
    const addedAttachments = (newAttachments || []).filter((a) => {
      const key = getAttachmentKey(a);
      const isNew = !previousKeys.has(key);
      return isNew;
    });

    logger.debug("[CotizacionHistory] Added attachments count:", addedAttachments.length);

    if (addedAttachments.length === 0) {
      logger.debug("[CotizacionHistory] No new attachments to process");
      return;
    }

    // Get proveedor data for snapshot
    const { data: proveedorData, error: provError } = await supabase
      .from("suppliers")
      .select("*")
      .eq("id", personalItem.proveedorId)
      .single();

    if (provError || !proveedorData) {
      console.error("[CotizacionHistory] Error fetching proveedor for history:", provError);
      return;
    }

    // Create history record for each new attachment - use Promise.all for parallel inserts
    const insertPromises = addedAttachments.map(async (attachment, index) => {
      try {
        // Always ensure bucket prefix is included - default to project-attachments
        const bucket = attachment.bucket || "project-attachments";
        const storageRef = attachment.filePath 
          ? `${bucket}/${attachment.filePath}`
          : "";

        logger.debug(`[CotizacionHistory] Creating record ${index + 1}/${addedAttachments.length}:`, {
          name: attachment.name,
          filePath: storageRef
        });

        const historyRecord = {
          proveedor_id: personalItem.proveedorId,
          evento_id: projectId,
          personal_item_id: personalItem.id || null, // Link to personal row for grouping
          fecha: new Date().toISOString(),
          proveedor_nombre: proveedorData.nombre || "",
          proveedor_categoria: proveedorData.categoria || "",
          proveedor_telefono: proveedorData.telefono || "",
          proveedor_correo: proveedorData.correo || "",
          proveedor_tipo_producto_servicio: proveedorData.tipo_producto_servicio || "",
          file_name: attachment.name || "archivo",
          file_url: attachment.url || "",
          file_path: storageRef,
          file_size: attachment.size || 0,
          uploaded_by: user?.id || null,
          uploaded_by_email: user?.email || null,
          feedback: personalItem.feedback || "", // Include feedback from Personal item
        };

        const { error } = await supabase.from("supplier_cotizacion_history").insert(historyRecord);

        if (error) {
          console.error("[CotizacionHistory] Error creating record:", error, attachment.name);
          return { success: false, name: attachment.name, error };
        } else {
          logger.debug("[CotizacionHistory] Created record successfully:", attachment.name);
          return { success: true, name: attachment.name };
        }
      } catch (err) {
        console.error("[CotizacionHistory] Exception creating record:", err, attachment.name);
        return { success: false, name: attachment.name, error: err };
      }
    });

    const results = await Promise.all(insertPromises);
    const successCount = results.filter(r => r.success).length;
    logger.debug(`[CotizacionHistory] Completed: ${successCount}/${addedAttachments.length} records created`);
  };

  const updatePersonalItem = async (projectId: string, personalId: string, field: string, value: any) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    // Get current personal item for comparison
    const currentItem = (project.personal || []).find(p => p.id === personalId);
    
    const updatedPersonal = (project.personal || []).map(p => {
      if (p.id !== personalId) return p;
      const updated = { ...p, [field]: value };
      if (field === 'tipoPersonal' && value === 'Transporte' && !p.rutaTransporte) {
        updated.notas = p.notas || 'Agregar ruta realizada';
      }
      return updated;
    });
    
    // Update project first
    contextUpdateProject(projectId, 'personal', updatedPersonal);
    
    // If adjuntos field is being updated, create history records automatically
    if (field === 'adjuntos' && currentItem && (currentItem.tipoPersonal === 'Proveedor' || currentItem.tipoPersonal === 'Transporte')) {
      await createCotizacionHistoryFromAttachments(
        projectId,
        { ...currentItem, [field]: value },
        value as Attachment[],
        currentItem.adjuntos || []
      );
    }
    
    // If feedback field is being updated for Proveedor/Transporte, sync to history
    if (field === 'feedback' && currentItem && (currentItem.tipoPersonal === 'Proveedor' || currentItem.tipoPersonal === 'Transporte')) {
      await syncFeedbackToHistory(projectId, personalId, value as string);
    }
  };

  // Sync feedback from Personal to supplier_cotizacion_history
  const syncFeedbackToHistory = async (projectId: string, personalItemId: string, feedback: string) => {
    try {
      const { error } = await supabase
        .from("supplier_cotizacion_history")
        .update({ feedback: feedback || "" })
        .eq("evento_id", projectId)
        .eq("personal_item_id", personalItemId)
        .is("deleted_at", null);

      if (error) {
        console.error("[FeedbackSync] Error syncing feedback to history:", error);
      } else {
        logger.debug("[FeedbackSync] Synced feedback to history:", { projectId, personalItemId });
      }
    } catch (err) {
      console.error("[FeedbackSync] Exception syncing feedback:", err);
    }
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

  const moveInventarioItem = async (projectId: string, inventarioId: string, direction: 'up' | 'down') => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const items = [...(project.inventario || [])];
    const index = items.findIndex(i => i.id === inventarioId);
    if (index < 0) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    [items[index], items[targetIndex]] = [items[targetIndex], items[index]];
    try {
      await contextUpdateProject(projectId, 'inventario', items);
    } catch (err) {
      console.error('[PanelOperaciones] Error reordering inventario:', err);
      toast.error("Error al reordenar material");
    }
  };

  const moveInventarioByIndex = async (fromIndex: number, toIndex: number) => {
    const projectId = currentProjectData?.id;
    if (!projectId) return;
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const items = [...(project.inventario || [])];
    if (fromIndex < 0 || fromIndex >= items.length || toIndex < 0 || toIndex >= items.length) return;
    const [moved] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, moved);
    try {
      await contextUpdateProject(projectId, 'inventario', items);
    } catch (err) {
      console.error('[PanelOperaciones] Error reordering inventario:', err);
      toast.error("Error al reordenar material");
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
    
    const record = (project.cajaMenor || []).find(c => c.id === cajaMenorId);
    if (!record) return;
    
    // Contingencia field: ONLY Administrador can edit
    if (field === "contingencia" && !isAdmin) {
      toast.error("Solo el administrador puede modificar el campo Contingencia");
      return;
    }
    
    // Estado changes: admins and approval users can change estado
    if (field === "estado") {
      if (!isAdmin && !canApproveCajaMenor()) {
        toast.error("No tienes permiso para cambiar el estado");
        return;
      }
    } else {
      // Content fields: ONLY the creator can edit
      // If record is approved, only relacion_gastos, imagenes, notas_comentarios are allowed (for legalization phase)
      const allowedFieldsWhenApproved = ["imagenes", "notas_comentarios", "relacion_gastos"];
      if (isRecordApproved(record) && !allowedFieldsWhenApproved.includes(field)) {
        toast.error("El registro está aprobado y no puede ser modificado");
        return;
      }
      
      // Only the creator can edit content fields (even admins cannot)
      if (!isCreatorOfRecord(record)) {
        toast.error("Solo el creador de este anticipo puede editarlo");
        return;
      }
    }
    
    const updatedCajaMenor = (project.cajaMenor || []).map(c =>
      c.id === cajaMenorId ? { ...c, [field]: value } : c
    );
    contextUpdateProject(projectId, 'cajaMenor', updatedCajaMenor);
  };

  const deleteCajaMenorItem = async (projectId: string, cajaMenorId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    // Permission check: only creator can delete
    const record = (project.cajaMenor || []).find(c => c.id === cajaMenorId);
    if (record && !isCreatorOfRecord(record)) {
      toast.error("Solo el creador de este anticipo puede eliminarlo");
      return;
    }
    
    const updatedCajaMenor = (project.cajaMenor || []).filter(c => c.id !== cajaMenorId);
    // Also remove linked legalization record (leg-{cajaMenorId}) so it doesn't appear in Caja Menor
    const linkedLegId = `leg-${cajaMenorId}`;
    const updatedLegalizacion = (project.legalizacion || []).filter(l => l.id !== linkedLegId);
    try {
      await updateProjectMultiple(projectId, {
        cajaMenor: updatedCajaMenor,
        legalizacion: updatedLegalizacion,
      });
      toast.success("Registro de anticipo eliminado");
    } catch (err) {
      console.error('[PanelOperaciones] Error deleting anticipo:', err);
      toast.error("Error al eliminar registro");
    }
  };

  // Legalización CRUD functions with permission checks
  // NOTA: La legalización ahora se sincroniza automáticamente con cajaMenor
  // Los IDs de legalización tienen formato "leg-{cajaMenorId}"
  const updateLegalizacionItem = (projectId: string, legalizacionId: string, field: string, value: any) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    // Extraer el ID del cajaMenor si tiene formato "leg-{id}"
    const sourceId = legalizacionId.startsWith("leg-") ? legalizacionId.replace("leg-", "") : null;
    
    // Buscar registro existente en legalización
    let record = (project.legalizacion || []).find(l => l.id === legalizacionId);
    
    // Si no existe pero tenemos sourceId, buscar en cajaMenor para obtener datos base
    if (!record && sourceId) {
      const cajaMenorRecord = (project.cajaMenor || []).find(c => c.id === sourceId);
      if (cajaMenorRecord) {
        // Crear nuevo registro de legalización basado en cajaMenor
        record = {
          id: legalizacionId,
          empleadoId: cajaMenorRecord.empleadoId,
          empleadoNombre: cajaMenorRecord.empleadoNombre || empleados.find(e => e.id === cajaMenorRecord.empleadoId)?.nombre || "",
          empleadoEmail: cajaMenorRecord.empleadoEmail,
          concepto: cajaMenorRecord.concepto,
          imagenes: [],
          valor: cajaMenorRecord.valor,
          categoria: cajaMenorRecord.categoria,
          recursos: cajaMenorRecord.recursos,
          contingencia: "No",
          estado: "No aprobado",
          createdAt: new Date().toISOString(),
        } as LegalizacionItem;
      }
    }
    
    if (!record) return;
    
    // Contingencia field: ONLY Administrador can edit
    if (field === "contingencia" && !isAdmin) {
      toast.error("Solo el administrador puede modificar el campo Contingencia");
      return;
    }
    
    // Estado changes: admins and approval users can change estado
    if (field === "estado") {
      if (!isAdmin && !canApproveCajaMenor()) {
        toast.error("No tienes permiso para cambiar el estado");
        return;
      }
    } else {
      // If record is approved, no content edits allowed
      if (record.estado === "Aprobado") {
        toast.error("El registro está aprobado y no puede ser modificado");
        return;
      }
      
      // Only the creator can edit content fields
      if (!isCreatorOfRecord(record)) {
        toast.error("Solo el creador de este anticipo puede editarlo");
        return;
      }
    }
    
    // Buscar si ya existe en el array de legalización
    const existingIndex = (project.legalizacion || []).findIndex(l => l.id === legalizacionId);
    let updatedLegalizacion: LegalizacionItem[];
    
    if (existingIndex >= 0) {
      // Actualizar registro existente
      updatedLegalizacion = (project.legalizacion || []).map(l =>
        l.id === legalizacionId ? { ...l, [field]: value } : l
      );
    } else {
      // Agregar nuevo registro con el campo actualizado
      updatedLegalizacion = [...(project.legalizacion || []), { ...record, [field]: value }];
    }
    
    contextUpdateProject(projectId, 'legalizacion', updatedLegalizacion);
  };

  const deleteLegalizacionItem = async (projectId: string, legalizacionId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    // Permission check: only creator can delete
    const record = (project.legalizacion || []).find(l => l.id === legalizacionId);
    if (record) {
      if (!isCreatorOfRecord(record) || record.estado === "Aprobado") {
        toast.error("No tienes permiso para eliminar este registro");
        return;
      }
    }
    
    const updatedLegalizacion = (project.legalizacion || []).filter(l => l.id !== legalizacionId);
    try {
      await contextUpdateProject(projectId, 'legalizacion', updatedLegalizacion);
      toast.success("Registro de caja menor eliminado");
    } catch (err) {
      console.error('[PanelOperaciones] Error deleting legalizacion:', err);
      toast.error("Error al eliminar registro");
    }
  };
  
  // Helper to check if user can edit a Legalizacion record (content fields)
  // ONLY the creator can edit, not admins
  const canEditLegalizacionRecord = (record: LegalizacionItem): boolean => {
    if (record.estado === "Aprobado") return false;
    return isCreatorOfRecord(record);
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
        mobileWidth: "120px",
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
        mobileWidth: "200px",
        render: (p: PersonalItem) => {
          // BBM uses EmpleadoAutocomplete, Proveedor/Transporte use ProveedorAutocomplete
          if (p.tipoPersonal === "BBM") {
            return (
              <EmpleadoAutocomplete
                value={p.empleadoId || ""}
                tipoPersonal="BBM"
                useEmpleadoId
                fallbackName={p.nombre}
                onChange={(nombreValue, empleadoId, cedula, empleadoData) => {
                  if (projectId) {
                    updatePersonalItemMultiple(projectId, p.id, {
                      nombre: nombreValue,
                      empleadoId: empleadoId,
                      cedula: cedula || "",
                      cedulaOrigen: "empleado",
                      cargo: empleadoData?.cargo || "",
                      telefono: empleadoData?.telefono || "",
                    });
                  }
                }}
              />
            );
          }
          return (
            <ProveedorAutocomplete
              value={p.nombre}
              onChange={(value, proveedorId, proveedorData) => {
                if (projectId) {
                  updatePersonalItemMultiple(projectId, p.id, {
                    nombre: value,
                    proveedorId: proveedorId,
                    telefono: proveedorData?.telefono || "",
                    cedulaOrigen: "manual"
                  });
                }
              }}
              placeholder={p.tipoPersonal === "Transporte" ? "Buscar transporte..." : "Buscar proveedor..."}
            />
          );
        },
      },
      {
        key: "cedula",
        header: "Cédula-Nit",
        width: "140px",
        mobileWidth: "140px",
        render: (p: PersonalItem) => {
          // BBM: Auto-filled from employee, read-only
          if (p.tipoPersonal === "BBM") {
            return (
              <div className="flex items-center gap-1" title="Cédula desde Creación de Empleados">
                <span className={`text-sm truncate ${!p.cedula ? "text-muted-foreground italic" : ""}`}>
                  {p.cedula || "Sin cédula"}
                </span>
                <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              </div>
            );
          }
          // Proveedor/Transporte: Manual editable with validation
          return (
            <div className={`rounded ${!p.cedula ? "ring-2 ring-destructive/50" : ""}`}>
              <EditableCell
                value={p.cedula || ""}
                type="text"
                placeholder="Cédula *"
                onChange={(value) => {
                  if (projectId) {
                    updatePersonalItemMultiple(projectId, p.id, {
                      cedula: value,
                      cedulaOrigen: "manual"
                    });
                  }
                }}
                className={!p.cedula ? "border-destructive" : ""}
              />
            </div>
          );
        },
      },
      { 
        key: "cargo", 
        header: "Cargo", 
        width: "120px",
        mobileWidth: "120px",
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
        mobileWidth: "130px",
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
        mobileWidth: "200px",
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
      mobileWidth: "50px",
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
        mobileWidth: "200px",
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
        mobileWidth: "100px",
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

    // Feedback column - DECOUPLED logic by tipoPersonal
    // BBM: uses canViewFeedback()/canEditFeedback() (special permission required for operativo)
    // Proveedor/Transporte: Admin and ALL Operativo can view/edit, Visual never
    const isAdminRole = role?.toLowerCase() === "administrador";
    const isOperativoRole = role?.toLowerCase() === "operativo";
    const canViewProveedorFeedback = isAdminRole || isOperativoRole;
    const canEditProveedorFeedback = isAdminRole || isOperativoRole;
    
    // Show feedback column if user can see BBM feedback OR can see Proveedor/Transporte feedback
    if (canViewFeedback() || canViewProveedorFeedback) {
      (basePersonalCols as any).push({
        key: "feedback",
        header: "Feedback",
        width: "200px",
        mobileWidth: "200px",
        className: "personal-feedback-cell",
        render: (p: PersonalItem) => {
          const isBBM = p.tipoPersonal === "BBM";
          const isProveedorOrTransporte = p.tipoPersonal === "Proveedor" || p.tipoPersonal === "Transporte";
          
          // Determine visibility and edit permissions based on tipoPersonal
          let canView = false;
          let canEditItem = false;
          
          if (isBBM) {
            canView = canViewFeedback();
            canEditItem = canEditFeedback();
          } else if (isProveedorOrTransporte) {
            canView = canViewProveedorFeedback;
            canEditItem = canEditProveedorFeedback;
          }
          
          if (!canView) {
            return <span className="text-xs text-muted-foreground">-</span>;
          }
          
          const feedbackValue = p.feedback || "";
          const displayName = p.nombre || "Personal";
          
          // Pattern IDENTICAL to HistorialCotizaciones feedback column
          // Uses isMobile hook (not sm: breakpoint) for consistent behavior
          if (feedbackValue) {
            return isMobile ? (
              // Mobile: truncated text + dialog to view full feedback (same as Historial)
              <div className="flex items-start gap-1">
                <span className="line-clamp-2 flex-1 break-words text-xs">{feedbackValue}</span>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 min-h-6 min-w-6 flex-shrink-0">
                      <MessageSquare className="h-3.5 w-3.5" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-[90vw] max-h-[80vh]">
                    <DialogHeader>
                      <DialogTitle className="text-base">Feedback - {displayName}</DialogTitle>
                    </DialogHeader>
                    {canEditItem ? (
                      <Textarea
                        value={feedbackValue}
                        onChange={(e) => projectId && updatePersonalItem(projectId, p.id, "feedback", e.target.value)}
                        placeholder="Escribe el feedback..."
                        className="min-h-[150px] resize-none"
                      />
                    ) : (
                      <div className="whitespace-pre-wrap text-sm overflow-y-auto max-h-[60vh] pr-2">
                        {feedbackValue}
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              </div>
            ) : (
              // Desktop: internal vertical scroll (same as Historial)
              <div 
                className="max-h-[80px] overflow-y-auto pr-1 break-words whitespace-pre-wrap scrollbar-thin text-xs"
                title={feedbackValue}
              >
                {canEditItem ? (
                  <Dialog>
                    <DialogTrigger asChild>
                      <div className="cursor-pointer hover:bg-muted/50 rounded p-1 -m-1">
                        {feedbackValue}
                      </div>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle className="text-base">Editar Feedback - {displayName}</DialogTitle>
                      </DialogHeader>
                      <Textarea
                        value={feedbackValue}
                        onChange={(e) => projectId && updatePersonalItem(projectId, p.id, "feedback", e.target.value)}
                        placeholder="Escribe el feedback..."
                        className="min-h-[200px] resize-none"
                      />
                    </DialogContent>
                  </Dialog>
                ) : (
                  feedbackValue
                )}
              </div>
            );
          }
          
          // No feedback yet - show placeholder with option to add
          return canEditItem ? (
            isMobile ? (
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">-</span>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 min-h-6 min-w-6 flex-shrink-0">
                      <MessageSquare className="h-3.5 w-3.5" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-[90vw] max-h-[80vh]">
                    <DialogHeader>
                      <DialogTitle className="text-base">Feedback - {displayName}</DialogTitle>
                    </DialogHeader>
                    <Textarea
                      value=""
                      onChange={(e) => projectId && updatePersonalItem(projectId, p.id, "feedback", e.target.value)}
                      placeholder="Escribe el feedback..."
                      className="min-h-[150px] resize-none"
                    />
                  </DialogContent>
                </Dialog>
              </div>
            ) : (
              <Dialog>
                <DialogTrigger asChild>
                  <div className="cursor-pointer hover:bg-muted/50 rounded p-1 text-xs text-muted-foreground">
                    Agregar feedback...
                  </div>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle className="text-base">Agregar Feedback - {displayName}</DialogTitle>
                  </DialogHeader>
                  <Textarea
                    value=""
                    onChange={(e) => projectId && updatePersonalItem(projectId, p.id, "feedback", e.target.value)}
                    placeholder="Escribe el feedback..."
                    className="min-h-[200px] resize-none"
                  />
                </DialogContent>
              </Dialog>
            )
          ) : (
            <span className="text-xs text-muted-foreground">-</span>
          );
        },
      });
    }
    
    return basePersonalCols;
  }, [selectedProject?.id, currentProjectData?.personal, canViewFeedback, canEditFeedback, role, isMobile]);

  const inventarioColumns = useMemo(() => {
    // Use currentProjectData?.id to get fresh project ID
    const projectId = currentProjectData?.id;
    
    return [
      {
        key: "reorder",
        header: "",
        width: "40px",
        mobileWidth: "40px",
        render: (i: InventarioItem, index: number) => (
          <div className="flex flex-col items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-muted-foreground hover:text-foreground"
              disabled={index === 0}
              onClick={(e) => {
                e.stopPropagation();
                if (projectId) moveInventarioItem(projectId, i.id, 'up');
              }}
              title="Subir"
            >
              <ArrowUp className="h-3 w-3" />
            </Button>
            <DragReorderHandle
              index={index}
              totalItems={currentProjectData?.inventario?.length ?? 0}
              onReorder={moveInventarioByIndex}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-muted-foreground hover:text-foreground"
              disabled={index === (currentProjectData?.inventario?.length ?? 1) - 1}
              onClick={(e) => {
                e.stopPropagation();
                if (projectId) moveInventarioItem(projectId, i.id, 'down');
              }}
              title="Bajar"
            >
              <ArrowDown className="h-3 w-3" />
            </Button>
          </div>
        ),
      },
      { 
        key: "nombreMaterial", 
        header: "Material", 
        width: "280px",
        mobileWidth: "280px",
        className: "align-top inventario-material-cell",
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
        width: "100px",
        mobileWidth: "100px",
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
        width: "80px",
        mobileWidth: "80px",
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
        width: "200px",
        mobileWidth: "200px",
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
        width: "50px",
        mobileWidth: "50px",
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
        mobileWidth: "180px",
        className: "caja-menor-sticky-col-1",
        render: (c: CajaMenorItem) => {
          // Always read-only display with lock icon (same as Legalización section)
          const empleadoName = getEmpleadoName(c);
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 text-sm truncate max-w-full cursor-default">
                    <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="truncate text-foreground">
                      {empleadoName}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[300px]">
                  <p>{empleadoName}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        },
      },
      {
        key: "concepto",
        header: "Concepto",
        width: "250px",
        mobileWidth: "220px",
        className: "caja-menor-sticky-col-2 caja-menor-concepto-cell",
        render: (c: CajaMenorItem) => {
          const canEdit = canEditCajaMenorRecord(c);
          if (!canEdit) {
            const conceptoText = c.concepto || "-";
            return (
              <div className="flex flex-col gap-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-sm text-muted-foreground block truncate max-w-full cursor-default">
                        {conceptoText}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[400px]">
                      <p className="whitespace-pre-wrap">{conceptoText}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {(c as any).notaAdicional && (
                  <div className="flex items-center gap-1 text-xs text-primary/80">
                    <MessageSquare className="h-3 w-3 shrink-0" />
                    <span className="truncate">{(c as any).notaAdicional}</span>
                  </div>
                )}
              </div>
            );
          }
          return (
            <div className="flex flex-col gap-1">
              <EditableCell
                value={c.concepto}
                type="text"
                placeholder="Descripción del concepto..."
                onChange={(value) => projectId && updateCajaMenorItem(projectId, c.id, "concepto", value)}
              />
              <div className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3 text-primary shrink-0" />
                <Input
                  value={(c as any).notaAdicional || ""}
                  placeholder="+ Agregar nota..."
                  className="h-6 text-xs border-dashed border-primary/30 bg-transparent focus:border-primary"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  onChange={(e) => {
                    if (projectId) {
                      updateCajaMenorItem(projectId, c.id, "notaAdicional", e.target.value);
                    }
                  }}
                />
              </div>
            </div>
          );
        },
      },
      {
        key: "imagenes",
        header: "Imágenes",
        width: "120px",
        mobileWidth: "120px",
        render: (c: CajaMenorItem) => {
          const canEdit = canEditCajaMenorRecord(c);
          return (
            <div className="overflow-hidden max-w-full">
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
            </div>
          );
        },
      },
      {
        key: "valor",
        header: "VALOR (COP) *",
        width: "130px",
        mobileWidth: "130px",
        className: "caja-menor-valor-cell",
        render: (c: CajaMenorItem) => {
          const canEdit = canEditCajaMenorRecord(c);
          const isEmpty = !c.valor || c.valor === 0;
          const formattedValue = `$ ${(c.valor || 0).toLocaleString('es-CO')}`;
          if (!canEdit) {
            return (
              <span className={`text-base font-semibold font-mono ${isEmpty ? "text-destructive" : "text-foreground"}`}>
                {isEmpty ? "$ 0 (Requerido)" : formattedValue}
              </span>
            );
          }
          return (
            <div className={isEmpty ? "ring-2 ring-destructive/50 rounded bg-destructive/5" : ""}>
              <EditableCell
                value={c.valor}
                type="number"
                placeholder="0"
                onChange={(value) => {
                  if (projectId) {
                    updateCajaMenorItem(projectId, c.id, "valor", value);
                    setCajaMenorValidationErrors([]);
                  }
                }}
                className={`text-base font-semibold ${isEmpty ? "text-destructive" : ""}`}
              />
            </div>
          );
        },
      },
      {
        key: "categoria",
        header: "Categoría *",
        width: "130px",
        mobileWidth: "130px",
        render: (c: CajaMenorItem) => {
          const canEdit = canEditCajaMenorRecord(c);
          const isEmpty = !c.categoria?.trim();
          if (!canEdit) {
            return (
              <span className={`text-sm ${isEmpty ? "text-destructive italic" : "text-muted-foreground"}`}>
                {isEmpty ? "Sin categoría" : c.categoria}
              </span>
            );
          }
          return (
            <div className={isEmpty ? "ring-2 ring-destructive/50 rounded bg-destructive/5" : ""}>
              <EditableCell
                value={c.categoria}
                type="select"
                options={["Transporte", "Alimentación", "Compras"]}
                onChange={(value) => {
                  if (projectId) {
                    updateCajaMenorItem(projectId, c.id, "categoria", value);
                    setCajaMenorValidationErrors([]);
                  }
                }}
              />
            </div>
          );
        },
      },
      {
        key: "acciones",
        header: "",
        width: "50px",
        mobileWidth: "50px",
        render: (c: CajaMenorItem) => {
          const isApproved = isRecordApproved(c);
          const canEdit = canEditCajaMenorRecord(c);
          
          // If approved, show lock icon with tooltip
          if (isApproved) {
            return (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center justify-center h-7 w-7">
                      <Lock className="h-4 w-4 text-green-500" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <p>Registro aprobado: edición bloqueada</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          }
          
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
  }, [currentProjectData?.id, currentProjectData?.cajaMenor, empleados, isAdmin, currentUserEmail, canEditCajaMenorRecord, projects, canApproveCajaMenor, isRecordApproved]);

  // Columnas para legalización (datos independientes, imagen OBLIGATORIA)
  const legalizacionColumns = useMemo(() => {
    const projectId = currentProjectData?.id;
    
    const getEmpleadoName = (l: LegalizacionItem) => {
      if (l.empleadoId) {
        const emp = empleados.find(e => e.id === l.empleadoId);
        if (emp?.nombre) return emp.nombre;
      }
      if (l.empleadoNombre) return l.empleadoNombre;
      return "Sin empleado";
    };
    
    return [
      {
        key: "empleado",
        header: "Empleado",
        width: "200px",
        mobileWidth: "180px",
        render: (l: LegalizacionItem) => {
          const empleadoName = getEmpleadoName(l);
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 text-sm truncate max-w-full cursor-default">
                    <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="truncate text-foreground">
                      {empleadoName}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[300px]">
                  <p>{empleadoName}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        },
      },
      {
        key: "concepto",
        header: "Concepto",
        width: "250px",
        mobileWidth: "220px",
        render: (l: LegalizacionItem & { notas_comentarios?: string[] }) => {
          const canEdit = canEditLegalizacionRecord(l);
          const notas: string[] = (l as any).notas_comentarios || [];
          
          return (
            <div className="flex flex-col gap-1">
              {canEdit ? (
                <div className={!l.concepto?.trim() ? "ring-1 ring-red-500 rounded" : ""}>
                  <EditableCell
                    value={l.concepto}
                    type="text"
                    placeholder="Escribir concepto..."
                    onChange={(value) => {
                      if (projectId) {
                        updateLegalizacionItem(projectId, l.id, "concepto", value);
                      }
                    }}
                  />
                </div>
              ) : (
                <span className="text-sm text-muted-foreground truncate">
                  {l.concepto || "-"}
                </span>
              )}
              {/* Notas/comentarios ilimitados */}
              <div className="flex flex-col gap-0.5">
                {notas.map((nota: string, idx: number) => (
                  <div key={idx} className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3 text-primary shrink-0" />
                    {canEdit ? (
                      <Input
                        value={nota}
                        placeholder="Nota..."
                        className="h-6 text-xs border-dashed border-primary/30 bg-transparent focus:border-primary"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                        onChange={(e) => {
                          if (projectId) {
                            const updated = [...notas];
                            updated[idx] = e.target.value;
                            updateLegalizacionItem(projectId, l.id, "notas_comentarios", updated);
                          }
                        }}
                      />
                    ) : (
                      <span className="text-xs text-primary/80 truncate">{nota}</span>
                    )}
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (projectId) {
                            const updated = notas.filter((_: string, i: number) => i !== idx);
                            updateLegalizacionItem(projectId, l.id, "notas_comentarios", updated);
                          }
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
                {canEdit && (
                  <button
                    className="flex items-center gap-1 text-xs text-primary/60 hover:text-primary cursor-pointer mt-0.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (projectId) {
                        updateLegalizacionItem(projectId, l.id, "notas_comentarios", [...notas, ""]);
                      }
                    }}
                  >
                    <MessageSquare className="h-3 w-3" />
                    + Agregar nota...
                  </button>
                )}
              </div>
            </div>
          );
        },
      },
      {
        key: "imagenes",
        header: "Imágenes *",
        width: "120px",
        mobileWidth: "120px",
        render: (l: LegalizacionItem) => {
          const canEdit = canEditLegalizacionRecord(l);
          const isEmpty = !l.imagenes || l.imagenes.length === 0;
          return (
            <div className={`overflow-hidden max-w-full ${isEmpty ? "ring-2 ring-destructive/50 rounded bg-destructive/5" : ""}`}>
              <AttachmentButton
                attachments={l.imagenes || []}
                onAttachmentsChange={(attachments) => {
                  if (canEdit && projectId) {
                    updateLegalizacionItem(projectId, l.id, "imagenes", attachments);
                    if (attachments.length > 0) {
                      setCajaMenorValidationErrors([]);
                    }
                  }
                }}
                multiple
                projectId={projectId || ""}
                fieldName={`legalizacion-${l.id}-imagenes`}
                enableCamera={canEdit}
                disabled={!canEdit}
              />
              {isEmpty && <span className="text-[10px] text-destructive block text-center">Requerida</span>}
            </div>
          );
        },
      },
      {
        key: "valor",
        header: "VALOR (COP) *",
        width: "130px",
        mobileWidth: "130px",
        render: (l: LegalizacionItem) => {
          const canEdit = canEditLegalizacionRecord(l);
          const isEmpty = !l.valor || l.valor === 0;
          const formattedValue = `$ ${(l.valor || 0).toLocaleString('es-CO')}`;
          if (!canEdit) {
            return (
              <span className={`text-base font-semibold font-mono ${isEmpty ? "text-destructive" : "text-foreground"}`}>
                {isEmpty ? "$ 0 (Requerido)" : formattedValue}
              </span>
            );
          }
          return (
            <div className={isEmpty ? "ring-2 ring-destructive/50 rounded bg-destructive/5" : ""}>
              <EditableCell
                value={l.valor}
                type="number"
                placeholder="0"
                onChange={(value) => {
                  if (projectId) {
                    updateLegalizacionItem(projectId, l.id, "valor", value);
                    setCajaMenorValidationErrors([]);
                  }
                }}
                className={`text-base font-semibold ${isEmpty ? "text-destructive" : ""}`}
              />
            </div>
          );
        },
      },
      {
        key: "categoria",
        header: "Categoría *",
        width: "130px",
        mobileWidth: "130px",
        render: (l: LegalizacionItem) => {
          const isEmpty = !l.categoria?.trim();
          const canEdit = canEditLegalizacionRecord(l);
          
          if (canEdit) {
            return (
              <div className={isEmpty ? "ring-1 ring-red-500 rounded" : ""}>
                <EditableCell
                  value={l.categoria}
                  type="select"
                  options={["Transporte", "Alimentación", "Compras"]}
                  placeholder={isEmpty ? "Elegir opción" : "Seleccionar..."}
                  onChange={(value) => {
                    if (projectId) {
                      updateLegalizacionItem(projectId, l.id, "categoria", value);
                      setCajaMenorValidationErrors([]);
                    }
                  }}
                />
              </div>
            );
          }
          
          return (
            <span className={`text-sm ${isEmpty ? "text-destructive italic" : "text-muted-foreground"}`}>
              {isEmpty ? "Sin categoría" : l.categoria}
            </span>
          );
        },
      },
      {
        key: "contingencia",
        header: "Contingencia",
        width: "120px",
        mobileWidth: "120px",
        render: (l: LegalizacionItem) => {
          const value = l.contingencia || "No";
          // Only Administrador can edit Contingencia column, and only if not approved
          const isAdminUser = role?.toLowerCase() === "administrador";
          const isApproved = l.estado === "Aprobado";
          const canEditContingencia = isAdminUser && !isApproved;
          
          if (!canEditContingencia) {
            const tooltipText = !isAdminUser 
              ? "Solo el rol administrativo puede modificar este campo"
              : "Registro aprobado: edición bloqueada";
            return (
              <div className="flex items-center gap-1" title={tooltipText}>
                <span className={`text-sm px-2 py-0.5 rounded ${
                  value === "Sí" ? "bg-amber-500/10 text-amber-500" : "text-muted-foreground"
                }`}>
                  {value}
                </span>
                <Lock className="h-3 w-3 text-muted-foreground" />
              </div>
            );
          }
          return (
            <EditableCell
              value={value}
              type="select"
              options={["Sí", "No"]}
              onChange={(value) => projectId && updateLegalizacionItem(projectId, l.id, "contingencia", value)}
            />
          );
        },
      },
      {
        key: "estado",
        header: "Estado",
        width: "120px",
        mobileWidth: "120px",
        render: (l: LegalizacionItem) => {
          const estadoClass = l.estado === "Aprobado" 
            ? "bg-green-500/20 text-green-400 border-green-500/30" 
            : l.estado === "No aprobado"
              ? "bg-red-500/20 text-red-400 border-red-500/30"
              : "bg-amber-500/20 text-amber-400 border-amber-500/30";
          return (
            <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border whitespace-nowrap ${estadoClass}`}>
              {l.estado === "Pendiente" ? "En revisión" : l.estado}
            </span>
          );
        },
      },
      {
        key: "acciones",
        header: "",
        width: "50px",
        mobileWidth: "50px",
        render: (l: LegalizacionItem) => {
          const isApproved = l.estado === "Aprobado";
          
          if (!isApproved && canEditLegalizacionRecord(l)) {
            return (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  if (projectId) deleteLegalizacionItem(projectId, l.id);
                }}
                title="Eliminar"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            );
          }
          
          if (isApproved) {
            return (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center justify-center h-7 w-7">
                      <Lock className="h-4 w-4 text-green-500" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <p>Registro aprobado: edición bloqueada</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          }
          
          return null;
        },
      },
    ];
  }, [currentProjectData?.id, currentProjectData?.cajaMenor, currentProjectData?.legalizacion, empleados, canEditLegalizacionRecord, canApproveCajaMenor, role]);

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
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  if (!currentUserEmpleado) {
                    toast.error('No se encontró empleado para tu usuario. Contacta al administrador para vincular tu cuenta a un empleado.');
                    return;
                  }
                  setHorarioFormOpen(true);
                }}
              >
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
          onViewModeChange={(mode) => {
            exitFocusMode();
            setGlobalViewMode(mode);
          }}
          onDateChange={(date) => {
            exitFocusMode();
            setGlobalSelectedDate(date);
          }}
          onDateRangeChange={(range) => {
            exitFocusMode();
            range ? setGlobalDateRange({ from: range.start, to: range.end }) : setGlobalDateRange(undefined);
          }}
          onStatusChange={(status) => {
            exitFocusMode();
            setStatusFilter(status);
          }}
        />

        {/* Focus Mode Banner - shows when navigated from another panel */}
        {focusedEventId && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-primary/10 border border-primary/20 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20">
                <Search className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Modo foco: <span className="text-primary">{focusedEventName}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {focusedEventSource === "gantt" 
                    ? "Desde vista Gantt" 
                    : focusedEventSource === "reportes" 
                      ? "Desde Panel de Reportes"
                      : focusedEventSource === "directivo"
                        ? "Desde Panel Directivo"
                        : focusedEventSource === "horarios"
                          ? "Desde Gestión de Horarios"
                          : focusedEventSource === "historial"
                            ? "Desde Historial de Cotizaciones"
                            : "Navegación externa"}
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={exitFocusMode}
              className="shrink-0"
            >
              Salir del modo foco
            </Button>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "matriz" | "gantt")} className="space-y-4">
          {/* Mobile-optimized controls: toggle visible without scroll */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Toggle always visible first */}
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="matriz" className="flex-1 sm:flex-none">Matriz</TabsTrigger>
              <TabsTrigger value="gantt" className="flex-1 sm:flex-none">Gantt</TabsTrigger>
            </TabsList>

            {/* Secondary controls below on mobile, inline on desktop */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="hide-deleted-operaciones"
                  checked={hideDeleted}
                  onCheckedChange={(checked) => {
                    exitFocusMode();
                    setHideDeleted(checked);
                  }}
                />
                <Label htmlFor="hide-deleted-operaciones" className="text-sm text-muted-foreground cursor-pointer whitespace-nowrap">
                  Ocultar eliminados
                </Label>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => {
                    exitFocusMode();
                    setSearchTerm(e.target.value);
                  }}
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
                onRowClick={(item) => setSelectedProject(item as Project)}
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

              // Validar responsables de inventario obligatorios
              const faltanResponsables: string[] = [];
              if (!currentProjectData.inventarioResponsableSalidaNombre) faltanResponsables.push("Responsable de Salida");
              if (!currentProjectData.inventarioResponsableEntradaNombre) faltanResponsables.push("Responsable de Entrada");
              if (!currentProjectData.inventarioResponsableEventoNombre) faltanResponsables.push("Responsable durante el Evento");
              if (faltanResponsables.length > 0) {
                toast.error(`Debe asignar: ${faltanResponsables.join(", ")}`, {
                  description: "Los responsables del inventario son obligatorios.",
                  duration: 5000,
                });
                return;
              }
            }
            
            // Validación de Caja Menor - TODOS los campos son BLOQUEANTES
            if (selectedSection === "cajaMenor") {
              // Validación de SOLICITUD DE ANTICIPOS - Imagen OBLIGATORIA
              const cajaMenorItems = currentProjectData.cajaMenor || [];
              if (cajaMenorItems.length > 0) {
                const legalizacionData2 = (currentProjectData.legalizacion as LegalizacionItem[]) || [];
                const registrosIncompletos = cajaMenorItems.filter((item: CajaMenorItem) => {
                  const sinValor = !item.valor || item.valor === 0;
                  const sinCategoria = !item.categoria?.trim();
                  const sinConcepto = !item.concepto?.trim();
                  const isAprobado = item.estado === "Aprobado";
                  const linkedLegItem = legalizacionData2.find(l => l.id === `leg-${item.id}`);
                  const legItemEstado = linkedLegItem?.estado as string | undefined;
                  const isLegAprobadaItem = legItemEstado === "Aprobado" || legItemEstado === "Legalizado";
                  // Relación de gastos obligatoria si el anticipo está aprobado pero legalización no aprobada aún
                  const relEntries: RelacionGastoEntry[] = (item as any).relacion_gastos || [];
                  const sinRelacion = isAprobado && !isLegAprobadaItem && relEntries.length === 0;
                  // Cada entrada de relación de gastos debe tener imagen
                  const sinImagenEnRelacion = isAprobado && !isLegAprobadaItem && relEntries.length > 0 && relEntries.some((e: RelacionGastoEntry) => !e.imagen_url);
                  return sinValor || sinCategoria || sinConcepto || sinRelacion || sinImagenEnRelacion;
                });
                
                if (registrosIncompletos.length > 0) {
                  const errores: string[] = [];
                  registrosIncompletos.forEach((item: CajaMenorItem) => {
                    const idx = cajaMenorItems.indexOf(item);
                    const isAprobado = item.estado === "Aprobado";
                    const legalizacionData3 = (currentProjectData.legalizacion as LegalizacionItem[]) || [];
                    const linkedLegItem = legalizacionData3.find(l => l.id === `leg-${item.id}`);
                    const isLegAprobadaItem = (linkedLegItem?.estado as string) === "Aprobado" || (linkedLegItem?.estado as string) === "Legalizado";
                    const faltantes: string[] = [];
                    if (!item.concepto?.trim()) faltantes.push("concepto");
                    if (!item.valor || item.valor === 0) faltantes.push("valor");
                    if (!item.categoria?.trim()) faltantes.push("categoría");
                    const relEntries2: RelacionGastoEntry[] = (item as any).relacion_gastos || [];
                    if (isAprobado && !isLegAprobadaItem && relEntries2.length === 0) faltantes.push("relación de gastos");
                    if (isAprobado && !isLegAprobadaItem && relEntries2.length > 0) {
                      const sinImg = relEntries2.filter((e: RelacionGastoEntry) => !e.imagen_url).length;
                      if (sinImg > 0) faltantes.push(`imagen en ${sinImg} entrada(s) de relación de gastos`);
                    }
                    if (faltantes.length > 0) {
                      errores.push(`Anticipo #${idx + 1}: falta ${faltantes.join(", ")}`);
                    }
                  });
                  setCajaMenorValidationErrors(errores);
                  return; // BLOQUEAR cierre del modal
                }
              }
              
              // Validación de RECURSOS PROPIOS - TODOS los campos obligatorios (sin recursos)
              const legalizacionData = (currentProjectData.legalizacion as LegalizacionItem[]) || [];
              const anticipoIdsSet = new Set((currentProjectData.cajaMenor || []).map((cm: CajaMenorItem) => `leg-${cm.id}`));
              const independentLegData = legalizacionData.filter(l => !anticipoIdsSet.has(l.id));
              
              if (independentLegData.length > 0) {
                const legIncompletos: { item: LegalizacionItem; idx: number }[] = [];
                
                independentLegData.forEach((record, idx) => {
                  const sinImagen = !record.imagenes || record.imagenes.length === 0;
                  const sinValor = !record.valor || record.valor === 0;
                  const sinCategoria = !record.categoria?.trim();
                  const sinConcepto = !record.concepto?.trim();
                  
                  if (sinImagen || sinValor || sinCategoria || sinConcepto) {
                    legIncompletos.push({ item: record, idx });
                  }
                });
                
                if (legIncompletos.length > 0) {
                  const errores: string[] = [];
                  legIncompletos.forEach(({ item, idx }) => {
                    const faltantes: string[] = [];
                    if (!item.concepto?.trim()) faltantes.push("concepto");
                    if (!item.imagenes || item.imagenes.length === 0) faltantes.push("imagen");
                    if (!item.valor || item.valor === 0) faltantes.push("valor");
                    if (!item.categoria?.trim()) faltantes.push("categoría");
                    if (faltantes.length > 0) {
                      errores.push(`Recurso propio #${idx + 1}: falta ${faltantes.join(", ")}`);
                    }
                  });
                  setCajaMenorValidationErrors(errores);
                  return; // BLOQUEAR cierre del modal
                }
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
          // Limpiar errores de validación al cerrar
          setCajaMenorValidationErrors([]);
          setSelectedProject(null);
          setSelectedSection(null);
        }}>
          <DialogContent 
            className="w-[95vw] !max-w-[1400px] sm:!max-w-[1400px] max-h-[90vh] p-0"
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
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <DialogTitle className="flex items-center gap-2 min-w-0 flex-wrap">
                    {selectedProject?.evento}
                    {selectedProject && (
                      operativoReadOnly ? (
                        <Badge variant="outline" className="text-xs">{selectedProject.estado.replace(/_/g, ' ')}</Badge>
                      ) : (
                        <StatusSelect
                          value={selectedProject.estado}
                          onChange={(value) => updateProject(selectedProject.id, "estado", value)}
                        />
                      )
                    )}
                  </DialogTitle>
                  {selectedSection === "plantilla" && currentProjectData && (
                    <div className="self-end sm:self-auto">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            <FileDown className="h-4 w-4 sm:mr-2" />
                            <span className="hidden sm:inline">Exportar</span>
                            <ChevronDown className="h-3 w-3 sm:ml-1" />
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
                    </div>
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
                          {!operativoReadOnly && (
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
                          )}
                        </CardHeader>
                        <CardContent className="pt-0 overflow-hidden">
                          {(currentProjectData.personal || []).length > 0 ? (
                            <MatrixTable
                              data={currentProjectData.personal || []}
                              columns={personalColumns}
                            />
                          ) : (
                            <p className="text-sm text-muted-foreground">No hay personal asignado. Haga clic en "Agregar Personal" para comenzar.</p>
                          )}
                        </CardContent>
                      </Card>

                      {/* Inventario Section */}
                      <Card className="overflow-hidden md:overflow-hidden">
                        <CardHeader className="py-3 flex flex-row items-center justify-between">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            Inventario ({(currentProjectData.inventario || []).length})
                          </CardTitle>
                          {!operativoReadOnly && (
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
                          )}
                        </CardHeader>
                        <CardContent className="pt-0 inventario-mobile-scroll">
                          {(currentProjectData.inventario || []).length > 0 ? (
                            <MatrixTable
                              data={currentProjectData.inventario || []}
                              columns={inventarioColumns}
                            />
                          ) : (
                            <p className="text-sm text-muted-foreground">No hay materiales en inventario. Haga clic en "Agregar Material" para comenzar.</p>
                          )}

                          {/* Responsables del Inventario */}
                          <InventarioResponsablesSelector
                            responsableSalida={{
                              userId: currentProjectData.inventarioResponsableSalidaUserId,
                              nombre: currentProjectData.inventarioResponsableSalidaNombre,
                              timestamp: currentProjectData.inventarioResponsableSalidaTimestamp,
                            }}
                            responsableEntrada={{
                              userId: currentProjectData.inventarioResponsableEntradaUserId,
                              nombre: currentProjectData.inventarioResponsableEntradaNombre,
                              timestamp: currentProjectData.inventarioResponsableEntradaTimestamp,
                            }}
                            responsableEvento={{
                              userId: currentProjectData.inventarioResponsableEventoUserId,
                              nombre: currentProjectData.inventarioResponsableEventoNombre,
                              timestamp: currentProjectData.inventarioResponsableEventoTimestamp,
                            }}
                            onResponsableSalidaChange={async (data) => {
                              try {
                                await contextUpdateProject(currentProjectData.id, 'inventarioResponsableSalidaUserId', data.userId || null);
                                await contextUpdateProject(currentProjectData.id, 'inventarioResponsableSalidaNombre', data.nombre || null);
                                await contextUpdateProject(currentProjectData.id, 'inventarioResponsableSalidaTimestamp', data.timestamp || null);
                              } catch (err) {
                                console.error('[Inventario] Error updating responsable salida:', err);
                                toast.error("Error al actualizar responsable");
                              }
                            }}
                            onResponsableEntradaChange={async (data) => {
                              try {
                                await contextUpdateProject(currentProjectData.id, 'inventarioResponsableEntradaUserId', data.userId || null);
                                await contextUpdateProject(currentProjectData.id, 'inventarioResponsableEntradaNombre', data.nombre || null);
                                await contextUpdateProject(currentProjectData.id, 'inventarioResponsableEntradaTimestamp', data.timestamp || null);
                              } catch (err) {
                                console.error('[Inventario] Error updating responsable entrada:', err);
                                toast.error("Error al actualizar responsable");
                              }
                            }}
                            onResponsableEventoChange={async (data) => {
                              try {
                                await contextUpdateProject(currentProjectData.id, 'inventarioResponsableEventoUserId', data.userId || null);
                                await contextUpdateProject(currentProjectData.id, 'inventarioResponsableEventoNombre', data.nombre || null);
                                await contextUpdateProject(currentProjectData.id, 'inventarioResponsableEventoTimestamp', data.timestamp || null);
                              } catch (err) {
                                console.error('[Inventario] Error updating responsable evento:', err);
                                toast.error("Error al actualizar responsable");
                              }
                            }}
                          />
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
                                disabled={operativoReadOnly || !canEditFeedback()}
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
                                disabled={operativoReadOnly || !canEditFeedback()}
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
                            disabled={operativoReadOnly}
                          />
                        </CardContent>
                      </Card>
                    </>
                  )}

                  {/* Caja Menor Section - Solo cuando selectedSection === "cajaMenor" */}
                  {selectedSection === "cajaMenor" && (
                    <>
                    <Card className="overflow-hidden">
                      <CardHeader className="py-3 flex flex-col gap-2">
                        {/* Mensaje de error inline - VISIBLE EN MÓVIL */}
                        {cajaMenorValidationErrors.length > 0 && (
                          <div className="w-full bg-destructive/15 border border-destructive/50 rounded-lg p-3 mb-2">
                            <div className="flex items-start gap-2">
                              <span className="text-destructive text-lg">⚠️</span>
                              <div className="flex-1">
                                <p className="text-destructive font-semibold text-sm mb-1">
                                  Campos obligatorios incompletos:
                                </p>
                                <ul className="text-destructive text-xs space-y-0.5">
                                  {cajaMenorValidationErrors.slice(0, 5).map((error, idx) => (
                                    <li key={idx}>• {error}</li>
                                  ))}
                                  {cajaMenorValidationErrors.length > 5 && (
                                    <li className="font-medium">...y {cajaMenorValidationErrors.length - 5} más</li>
                                  )}
                                </ul>
                              </div>
                              <button 
                                onClick={() => setCajaMenorValidationErrors([])}
                                className="text-destructive hover:text-destructive/80 text-lg leading-none"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        )}
                        {/* Row 1: Title */}
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Wallet className="h-4 w-4" />
                            SOLICITUD DE ANTICIPOS ({(currentProjectData.cajaMenor || []).length})
                          </CardTitle>
                          {/* Buttons: Export + Add (right side) */}
                          <div className="flex gap-2 flex-wrap">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <FileDown className="h-3 w-3 mr-1" />
                                  EXPORTAR
                                  <ChevronDown className="h-3 w-3 ml-1" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="min-w-[260px]">
                                {(() => {
                                  const cajaMenor = currentProjectData.cajaMenor || [];
                                  const legalizacion = (currentProjectData.legalizacion || []) as LegalizacionItem[];
                                  const hasApprovedLegalizacion = legalizacion.some(l => l.estado === 'Aprobado') ||
                                    cajaMenor.some(cm => {
                                      const legEntry = legalizacion.find(l => l.id === `leg-${cm.id}`);
                                      return legEntry?.estado === 'Aprobado';
                                    });
                                  return (
                                    <>
                                      <DropdownMenuCheckboxItem
                                        checked={includeLegalizacionInExport}
                                        onCheckedChange={setIncludeLegalizacionInExport}
                                        disabled={!hasApprovedLegalizacion}
                                        className={!hasApprovedLegalizacion ? "opacity-50" : ""}
                                      >
                                        Agregar información de Legalización
                                      </DropdownMenuCheckboxItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={async () => {
                                        const num = await getOrAssignSolicitudNum(currentProjectData.id);
                                        printSolicitudPresupuesto(currentProjectData, empleados, includeLegalizacionInExport, num ?? undefined);
                                      }}>
                                        <FileDown className="h-4 w-4 mr-2" />
                                        Descargar PDF
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={async () => {
                                        const num = await getOrAssignSolicitudNum(currentProjectData.id);
                                        await exportSolicitudToExcel(currentProjectData, empleados, includeLegalizacionInExport, num ?? undefined);
                                      }}>
                                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                                        Descargar Excel
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => {
                                        const cajaMenorItems = currentProjectData.cajaMenor || [];
                                        const allImages: PhotoExportItem[] = [];
                                        cajaMenorItems.forEach((cm: CajaMenorItem) => {
                                          const relEntries: RelacionGastoEntry[] = (cm as any).relacion_gastos || [];
                                          relEntries.forEach((entry) => {
                                            if (entry.imagen_url) {
                                              allImages.push({
                                                comercio: entry.comercio || "Sin comercio",
                                                concepto: entry.concepto || cm.concepto || "Sin concepto",
                                                url: entry.imagen_url,
                                              });
                                            }
                                          });
                                        });
                                        if (allImages.length === 0) {
                                          toast.error("No hay imágenes para exportar");
                                          return;
                                        }
                                        const eventoName = currentProjectData.evento || "Evento";
                                        setPhotoExportData({
                                          title: "Registro Fotográfico - Anticipos",
                                          subtitle: `${eventoName} · ${currentProjectData.cliente || ""}`,
                                          photos: allImages,
                                        });
                                        setPhotoExportOpen(true);
                                      }}>
                                        <Image className="h-4 w-4 mr-2" />
                                        Exportar Fotos (PDF)
                                      </DropdownMenuItem>
                                    </>
                                  );
                                })()}
                              </DropdownMenuContent>
                            </DropdownMenu>
                            {(() => {
                              const hasPermission = canCrearAnticipos();
                              if (!hasPermission) return null;
                              
                              const legalizacion = (currentProjectData.legalizacion || []) as LegalizacionItem[];
                              const userEmail = currentUserEmail || "";
                              const userEmpId = currentUserEmpleado?.id || "";
                              const hasPendingLeg = legalizacion.some(l => {
                                const isOwner = (l.empleadoEmail?.toLowerCase() === userEmail) || 
                                  (userEmpId && l.empleadoId === userEmpId);
                                const isPending = l.estado !== "Aprobado" && l.estado !== "No aprobado";
                                return isOwner && isPending;
                              });
                              const isBlocked = hasPendingLeg && !isAdmin;
                              
                              return (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          disabled={isBlocked}
                                          onClick={async () => {
                                            setCajaMenorValidationErrors([]);
                                            const newCajaMenor: CajaMenorItem = {
                                              id: `cm${Date.now()}`,
                                              empleadoId: currentUserEmpleado?.id || "",
                                              empleadoNombre: currentUserEmpleado?.nombre || "",
                                              empleadoEmail: currentUserEmpleado?.correo || currentUserEmail || "",
                                              concepto: "",
                                              imagenes: [],
                                              valor: 0,
                                              categoria: "",
                                              recursos: role?.toLowerCase() === "operativo" ? "Anticipo BBM" : "",
                                              contingencia: "No",
                                              estado: "Pendiente",
                                              createdAt: new Date().toISOString(),
                                            };
                                            try {
                                              const newLeg: LegalizacionItem = {
                                                id: `leg-${newCajaMenor.id}`,
                                                empleadoId: newCajaMenor.empleadoId,
                                                empleadoNombre: newCajaMenor.empleadoNombre,
                                                empleadoEmail: newCajaMenor.empleadoEmail,
                                                concepto: "",
                                                imagenes: [],
                                                valor: 0,
                                                categoria: "Compras",
                                                recursos: "",
                                                contingencia: "No",
                                                estado: "Pendiente",
                                                createdAt: new Date().toISOString(),
                                              };
                                              await updateProjectMultiple(currentProjectData.id, {
                                                cajaMenor: [...(currentProjectData.cajaMenor || []), newCajaMenor],
                                                legalizacion: [...((currentProjectData.legalizacion || []) as LegalizacionItem[]), newLeg],
                                              });
                                              toast.warning("⚠️ Completa: Valor, Categoría y Recurso para poder cerrar.", { duration: 4000 });
                                            } catch (err) {
                                              console.error('[PanelOperaciones] Error adding registro:', err);
                                              toast.error("Error al agregar registro");
                                            }
                                          }}
                                        >
                                          <Plus className="h-3 w-3 sm:mr-1" />
                                          <span className="hidden sm:inline uppercase">AGREGAR REGISTRO</span>
                                          <span className="sm:hidden">Agregar</span>
                                        </Button>
                                      </span>
                                    </TooltipTrigger>
                                    {isBlocked && (
                                      <TooltipContent side="bottom" className="max-w-[250px]">
                                        <p>Debes legalizar tus anticipos pendientes antes de solicitar uno nuevo.</p>
                                      </TooltipContent>
                                    )}
                                  </Tooltip>
                                </TooltipProvider>
                              );
                            })()}
                          </div>
                        </div>
                        {/* Row 2: Employee name */}
                        {(() => {
                          const items = currentProjectData.cajaMenor || [];
                          if (items.length === 0) return null;
                          const firstItem = items[0] as CajaMenorItem;
                          const empleadoNombre = firstItem.empleadoNombre || "Sin asignar";
                          return (
                            <div className="flex items-center gap-1.5">
                              <Users className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">Empleado:</span>
                              <span className="text-xs font-medium">{empleadoNombre}</span>
                            </div>
                          );
                        })()}
                        {/* Row 3: Estados */}
                        {(() => {
                          const items = currentProjectData.cajaMenor || [];
                          if (items.length === 0) return null;

                          const allApproved = items.every((c: CajaMenorItem) => c.estado === "Aprobado");
                          const anyRejected = items.some((c: CajaMenorItem) => c.estado === "No aprobado");
                          const estadoSolicitud = allApproved ? "Aprobado" : anyRejected ? "Rechazado" : "En revisión";
                          const estadoSolicitudClass = estadoSolicitud === "Aprobado" 
                            ? "bg-green-500/20 text-green-400 border-green-500/30" 
                            : estadoSolicitud === "Rechazado" 
                              ? "bg-red-500/20 text-red-400 border-red-500/30" 
                              : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";

                          const legalizacion = (currentProjectData.legalizacion || []) as LegalizacionItem[];
                          const linkedLegs = items.map((cm: CajaMenorItem) => legalizacion.find((l: LegalizacionItem) => l.id === `leg-${cm.id}`)).filter(Boolean) as LegalizacionItem[];
                          let estadoLegalizacion = "Sin legalizar";
                          let estadoLegClass = "bg-muted/30 text-muted-foreground border-border";
                          if (linkedLegs.length > 0) {
                          const isLegEstadoApproved = (estado: string) => estado === "Aprobado" || estado === "Legalizado";
                            const isLegEstadoRejected = (estado: string) => estado === "No aprobado" || estado === "No legalizable" || estado === "Rechazado";
                            const allLegApproved = linkedLegs.every(l => isLegEstadoApproved(l.estado as string));
                            const anyLegRejected = linkedLegs.some(l => isLegEstadoRejected(l.estado as string));
                            if (allLegApproved) {
                              estadoLegalizacion = "Legalizado";
                              estadoLegClass = "bg-green-500/20 text-green-400 border-green-500/30";
                            } else if (anyLegRejected) {
                              estadoLegalizacion = "No legalizable";
                              estadoLegClass = "bg-red-500/20 text-red-400 border-red-500/30";
                            } else if (linkedLegs.length > 0) {
                              estadoLegalizacion = "Revisando";
                              estadoLegClass = "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
                            }
                          }

                          return (
                            <div className="flex items-center gap-3 flex-wrap">
                              {/* Step 1: Solicitud */}
                              <div className="flex items-center gap-2 bg-muted/20 rounded-lg px-3 py-1.5 border border-border/50">
                                <div className={`flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${estadoSolicitud === "Aprobado" ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"}`}>
                                  1
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[10px] text-muted-foreground leading-none mb-0.5">Paso 1 · Solicitud</span>
                                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${estadoSolicitudClass}`}>
                                    {estadoSolicitud}
                                  </span>
                                </div>
                              </div>

                              {/* Arrow */}
                              <span className="text-muted-foreground text-xs">→</span>

                              {/* Step 2: Legalización */}
                              <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 border ${estadoSolicitud === "Aprobado" ? "bg-muted/20 border-border/50" : "bg-muted/10 border-border/30 opacity-50"}`}>
                                <div className={`flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${(estadoLegalizacion === "Legalizado") ? "bg-green-500 text-white" : estadoSolicitud === "Aprobado" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                                  2
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[10px] text-muted-foreground leading-none mb-0.5">Paso 2 · Legalización</span>
                                  {estadoSolicitud !== "Aprobado" ? (
                                    <span className="text-xs text-muted-foreground">Disponible al aprobar</span>
                                  ) : (
                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${estadoLegClass}`}>
                                      {estadoLegalizacion}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </CardHeader>
                      <CardContent className="pt-0 caja-menor-mobile-scroll">
                        {(currentProjectData.cajaMenor || []).length > 0 ? (
                          <div className="overflow-x-auto scrollbar-thin">
                            <table className="matrix-table w-full" style={{ minWidth: '1300px' }}>
                               <thead>
                                <tr>
                                   <th style={{ width: '200px', minWidth: '200px' }}>Concepto solicitud</th>
                                   <th style={{ width: '130px', minWidth: '130px' }}>Categoría *</th>
                                   <th style={{ width: '130px', minWidth: '130px' }}>Valor anticipo *</th>
                                    <th style={{ width: '450px', minWidth: '450px' }}>Relación de Gastos</th>
                                    <th style={{ width: '130px', minWidth: '130px' }}>Valor legalización</th>
                                    <th style={{ width: '130px', minWidth: '130px' }}>Diferencia</th>
                                  <th style={{ width: '50px', minWidth: '50px' }}></th>
                                </tr>
                              </thead>
                              <tbody>
                                {(currentProjectData.cajaMenor || []).map((cm: CajaMenorItem) => {
                                  const legalizacion = (currentProjectData.legalizacion || []) as LegalizacionItem[];
                                  const linkedLeg = legalizacion.find(l => l.id === `leg-${cm.id}`);
                                  const valorAnticipo = cm.valor || 0;
                                  const relGastosEntries: RelacionGastoEntry[] = (cm as any).relacion_gastos || [];
                                  const valorLegalizacion = relGastosEntries.reduce((s: number, e: RelacionGastoEntry) => s + (e.valor || 0), 0);
                                  const diferencia = valorAnticipo - valorLegalizacion;

                                  // Determine editability based on both estados
                                  const isSolicitudAprobada = cm.estado === "Aprobado";
                                  const legEstado = linkedLeg?.estado as string | undefined;
                                  const isLegAprobada = legEstado === "Aprobado" || legEstado === "Legalizado";
                                  // Fully locked: both solicitud AND legalización are approved/legalized
                                  const isFullyLocked = isSolicitudAprobada && isLegAprobada;
                                  // Partially editable: solicitud "Aprobado" but legalización NOT approved yet
                                  // In this state, Relacion de gastos, Imagen, Valor legalización remain editable
                                  const isPartiallyEditable = isSolicitudAprobada && !isLegAprobada;

                                  return (
                                    <tr key={cm.id}>
                                      {/* Concepto solicitud */}
                                      <td>
                                        {(() => {
                                          const canEdit = canEditCajaMenorRecord(cm) && !isSolicitudAprobada;
                                          if (!canEdit) {
                                            return (
                                              <span className="text-sm text-muted-foreground truncate block max-w-[200px]" title={cm.concepto || "-"}>
                                                {cm.concepto || "-"}
                                              </span>
                                            );
                                          }
                                          return (
                                            <EditableCell
                                              value={cm.concepto}
                                              type="text"
                                              placeholder="Concepto..."
                                              onChange={(value) => {
                                                if (currentProjectData?.id) updateCajaMenorItem(currentProjectData.id, cm.id, "concepto", value);
                                              }}
                                            />
                                          );
                                        })()}
                                      </td>
                                      {/* Categoría */}
                                      <td>
                                        <div className={!cm.categoria ? "ring-1 ring-red-500 rounded" : undefined}>
                                          <EditableCell
                                            value={cm.categoria}
                                            type="select"
                                            options={["Transporte", "Alimentación", "Compras"]}
                                            placeholder={!cm.categoria ? "Elegir opción" : "Seleccionar..."}
                                            onChange={(value) => {
                                              if (currentProjectData?.id) updateCajaMenorItem(currentProjectData.id, cm.id, "categoria", value);
                                            }}
                                            className={!cm.categoria ? "text-red-500" : undefined}
                                            disabled={isSolicitudAprobada}
                                          />
                                        </div>
                                      </td>
                                      {/* Valor anticipo */}
                                      <td>
                                        {(() => {
                                          const canEdit = canEditCajaMenorRecord(cm);
                                          const isEmpty = !cm.valor || cm.valor === 0;
                                          if (!canEdit || isSolicitudAprobada) {
                                            return (
                                              <span className={`text-base font-semibold font-mono ${isEmpty ? "text-destructive" : "text-foreground"}`}>
                                                {isEmpty ? "$ 0 (Requerido)" : `$ ${(cm.valor || 0).toLocaleString('es-CO')}`}
                                              </span>
                                            );
                                          }
                                          return (
                                            <div className={isEmpty ? "ring-2 ring-destructive/50 rounded bg-destructive/5" : ""}>
                                              <EditableCell
                                                value={cm.valor}
                                                type="number"
                                                placeholder="0"
                                                onChange={(value) => {
                                                  if (currentProjectData?.id) {
                                                    updateCajaMenorItem(currentProjectData.id, cm.id, "valor", value);
                                                    setCajaMenorValidationErrors([]);
                                                  }
                                                }}
                                                className={`text-base font-semibold ${isEmpty ? "text-destructive" : ""}`}
                                              />
                                            </div>
                                          );
                                        })()}
                                      </td>
                                      {/* Relación de Gastos (with inline image upload) */}
                                      <td>
                                        <div className="flex flex-col gap-1.5">
                                          {!isSolicitudAprobada ? (
                                            <span className="text-sm text-muted-foreground">—</span>
                                          ) : (
                                            <RelacionGastosEditor
                                              entries={(cm as any).relacion_gastos || []}
                                              isFullyLocked={isFullyLocked}
                                              canEdit={!isFullyLocked && isCreatorOfRecord(cm)}
                                              valorAnticipo={cm.valor || 0}
                                              projectId={currentProjectData?.id}
                                              cmId={cm.id}
                                              isSolicitudAprobada={isSolicitudAprobada}
                                              onUpdate={(updated) => {
                                                if (currentProjectData?.id) {
                                                  updateCajaMenorItem(currentProjectData.id, cm.id, "relacion_gastos", updated);
                                                  const newSum = updated.reduce((s: number, e: RelacionGastoEntry) => s + (e.valor || 0), 0);
                                                  updateLegalizacionItem(currentProjectData.id, `leg-${cm.id}`, "valor", newSum);
                                                }
                                              }}
                                            />
                                          )}
                                        </div>
                                      </td>
                                      {/* Valor legalización (read-only: sum of relacion_gastos) */}
                                      <td>
                                        {(() => {
                                          if (!isSolicitudAprobada) {
                                            return <span className="text-sm text-muted-foreground">—</span>;
                                          }
                                          const relEntries: RelacionGastoEntry[] = (cm as any).relacion_gastos || [];
                                          const computedSum = relEntries.reduce((s: number, e: RelacionGastoEntry) => s + (e.valor || 0), 0);
                                          return (
                                            <span className="text-base font-semibold">
                                              {computedSum > 0 ? `$ ${computedSum.toLocaleString("es-CO")}` : <span className="text-muted-foreground">$ 0</span>}
                                            </span>
                                          );
                                        })()}
                                      </td>
                                      {/* Diferencia */}
                                      <td>
                                        {(() => {
                                          if (valorAnticipo === 0 && valorLegalizacion === 0) return <span className="text-muted-foreground">—</span>;
                                          const diff = valorAnticipo - valorLegalizacion;
                                          const absDiff = Math.abs(diff);
                                          const colorClass = diff >= 0 ? "text-green-400" : "text-red-400";
                                          return (
                                            <span className={`text-sm font-mono font-semibold ${colorClass}`}>
                                              $ {absDiff.toLocaleString('es-CO')}
                                            </span>
                                          );
                                        })()}
                                      </td>
                                      <td>{(cajaMenorColumns.find(c => c.key === 'acciones')?.render as any)?.(cm)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No hay registros. Haga clic en "Agregar Registro" para comenzar.</p>
                        )}
                      </CardContent>
                    </Card>

                    {/* Sección de RECURSOS PROPIOS - independiente */}
                    <Card className="overflow-hidden mt-4 border-primary/30">
                      <CardHeader className="py-3 flex flex-col gap-2 bg-primary/5">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex flex-col gap-1.5">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              RECURSOS PROPIOS ({(() => {
                                const anticipoIds = new Set((currentProjectData.cajaMenor || []).map((cm: CajaMenorItem) => `leg-${cm.id}`));
                                return (currentProjectData.legalizacion || []).filter((l: LegalizacionItem) => !anticipoIds.has(l.id)).length;
                              })()})
                          </CardTitle>
                          </div>
                          <div className="flex gap-2 flex-wrap justify-start w-full sm:w-auto">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <FileDown className="h-3 w-3 mr-1" />
                                  EXPORTAR
                                  <ChevronDown className="h-3 w-3 ml-1" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="min-w-[300px]">
                                {(() => {
                                  const hasApprovedSolicitud = (currentProjectData.cajaMenor || []).some(cm => cm.estado === 'Aprobado');
                                  const anticipoIdsExport = new Set((currentProjectData.cajaMenor || []).map((cm: CajaMenorItem) => `leg-${cm.id}`));
                                  const independentLegExport = (currentProjectData.legalizacion || []).filter((l: LegalizacionItem) => !anticipoIdsExport.has(l.id));
                                  const allLegImages = independentLegExport.flatMap((l: LegalizacionItem) =>
                                    (l.imagenes || []).map(img => ({ url: img.url, concepto: l.concepto || "Sin concepto", empleado: l.empleadoNombre || "", bucket: img.bucket, filePath: img.filePath }))
                                  );
                                  const hasImages = allLegImages.length > 0;
                                  return (
                                    <>
                                      <DropdownMenuCheckboxItem
                                        checked={includeSolicitudInExport}
                                        onCheckedChange={setIncludeSolicitudInExport}
                                        disabled={!hasApprovedSolicitud}
                                        className={!hasApprovedSolicitud ? "opacity-50" : ""}
                                      >
                                        Agregar información de Solicitud de Anticipos
                                      </DropdownMenuCheckboxItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => printLegalizacion(currentProjectData, empleados, includeSolicitudInExport)}>
                                        <FileDown className="h-4 w-4 mr-2" />
                                        Descargar PDF
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => exportLegalizacionToExcel(currentProjectData, empleados, includeSolicitudInExport)}>
                                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                                        Descargar Excel
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        disabled={!hasImages}
                                        className={!hasImages ? "opacity-50" : ""}
                                        onClick={() => {
                                          if (!hasImages) return;
                                          const eventoName = currentProjectData.evento || "Evento";
                                          setPhotoExportData({
                                            title: "Registro Fotográfico - Recursos Propios",
                                            subtitle: `${eventoName} · ${currentProjectData.cliente || ""}`,
                                          photos: allLegImages.map(img => ({
                                              comercio: img.empleado || "Sin empleado",
                                              concepto: img.concepto || "Sin concepto",
                                              url: img.url,
                                              bucket: img.bucket,
                                              filePath: img.filePath,
                                            })),
                                          });
                                          setPhotoExportOpen(true);
                                        }}
                                      >
                                        <Image className="h-4 w-4 mr-2" />
                                        Exportar Fotos (PDF)
                                      </DropdownMenuItem>
                                    </>
                                  );
                                })()}
                              </DropdownMenuContent>
                            </DropdownMenu>
                            {(role?.toLowerCase() === "administrador" || role?.toLowerCase() === "operativo") && (
                            <Button 
                              variant="outline"
                              size="sm" 
                              onClick={() => {
                                if (!currentProjectData?.id) return;
                                const newLeg: LegalizacionItem = {
                                  id: `leg-${Date.now()}`,
                                  empleadoId: currentUserEmpleado?.id || "",
                                  empleadoNombre: currentUserEmpleado?.nombre || user?.email || "",
                                  empleadoEmail: user?.email || "",
                                  concepto: "",
                                  imagenes: [],
                                  valor: 0,
                                  categoria: "",
                                  recursos: "",
                                  contingencia: "No",
                                  estado: "Pendiente",
                                  createdAt: new Date().toISOString(),
                                };
                                const updatedLeg = [...(currentProjectData.legalizacion || []), newLeg];
                                contextUpdateProject(currentProjectData.id, 'legalizacion', updatedLeg);
                                toast.success("Registro de recursos propios agregado");
                              }}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              AGREGAR REGISTRO
                            </Button>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-4 caja-menor-mobile-scroll">
                        {(() => {
                          // Filter out legalization items that are linked to anticipos (they appear in Solicitud de Anticipos section)
                          const anticipoIds = new Set((currentProjectData.cajaMenor || []).map((cm: CajaMenorItem) => `leg-${cm.id}`));
                          const independentLeg = (currentProjectData.legalizacion || []).filter((l: LegalizacionItem) => !anticipoIds.has(l.id));
                          
                          return independentLeg.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              No hay registros de recursos propios. Haga clic en "AGREGAR REGISTRO" para comenzar.
                            </p>
                          ) : (
                            <MatrixTable
                              data={independentLeg}
                              columns={legalizacionColumns}
                              getRowClassName={() => ""}
                            />
                          );
                        })()}
                      </CardContent>
                    </Card>

                    {/* Sección de CAJA MENOR - solo lectura */}
                    <Card className="overflow-hidden mt-4 border-muted">
                      <CardHeader className="py-3 bg-muted/30">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Wallet className="h-4 w-4" />
                          CAJA MENOR ({gastosMenoresForProject.length})
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">Registros desde Reporte (Solo lectura)</p>
                      </CardHeader>
                      <CardContent className="pt-2 overflow-x-auto">
                        {gastosMenoresForProject.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-4">No hay registros de caja menor para este centro de costos.</p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Fecha</TableHead>
                                <TableHead className="text-xs">Usuario</TableHead>
                                <TableHead className="text-xs">Concepto</TableHead>
                                <TableHead className="text-xs">Categoría</TableHead>
                                <TableHead className="text-xs">Nombre Comercio</TableHead>
                                <TableHead className="text-xs">NIT/CC</TableHead>
                                <TableHead className="text-xs text-right">Valor</TableHead>
                                <TableHead className="text-xs">Imagen</TableHead>
                                <TableHead className="text-xs">Estado</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {gastosMenoresForProject.map((g) => (
                                <TableRow key={g.id}>
                                  <TableCell className="text-xs whitespace-nowrap">
                                    {format(new Date(g.created_at), "dd/MM/yyyy", { locale: es })}
                                  </TableCell>
                                  <TableCell className="text-xs">{g.usuario_nombre}</TableCell>
                                  <TableCell className="text-xs">{g.concepto}</TableCell>
                                  <TableCell className="text-xs">{g.categoria}</TableCell>
                                  <TableCell className="text-xs">{g.nombre_comercio || "—"}</TableCell>
                                  <TableCell className="text-xs">{g.nit_cc || "—"}</TableCell>
                                  <TableCell className="text-xs text-right font-mono">
                                    $ {g.valor.toLocaleString("es-CO")}
                                  </TableCell>
                                  <TableCell>
                                    {g.imagen_url ? (
                                      <a href={g.imagen_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">Ver</a>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">—</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <CajaMenorEstadoSelect value={g.estado} onChange={() => {}} readOnly />
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </CardContent>
                    </Card>
                    </>
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
          readOnly={!canModifyStructure}
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
      <PhotoExportDialog
        open={photoExportOpen}
        onOpenChange={setPhotoExportOpen}
        title={photoExportData.title}
        subtitle={photoExportData.subtitle}
        photos={photoExportData.photos}
      />
    </Layout>
  );
};

export default PanelOperaciones;
