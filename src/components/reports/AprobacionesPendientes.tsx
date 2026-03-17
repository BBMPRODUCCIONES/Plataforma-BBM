import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useProjects } from "@/contexts/ProjectsContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Project, CajaMenorItem, LegalizacionItem } from "@/types";
import { useGastosMenores, GastoMenor } from "@/hooks/useGastosMenores";
import { supabase } from "@/integrations/supabase/client";

import { format, parseISO, getMonth, getYear, differenceInMinutes, differenceInSeconds, differenceInDays, differenceInHours } from "date-fns";

import { es } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CajaMenorEstadoSelect } from "@/components/CajaMenorEstadoSelect";
import { Search, RotateCcw, History, Clock, AlertTriangle, Globe, Eye } from "lucide-react";

const TruncatedCellWithEye = ({ text, label }: { text: string; label: string }) => {
  if (!text || text === "—") return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-1 max-w-[100px]">
      <span className="truncate text-xs">{text}</span>
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className="shrink-0 focus:outline-none">
            <Eye className="w-3 h-3 text-muted-foreground hover:text-foreground cursor-pointer" />
          </button>
        </PopoverTrigger>
        <PopoverContent side="top" className="text-xs max-w-[280px] p-3">
          <p className="font-semibold mb-1">{label}</p>
          <p className="whitespace-pre-wrap">{text}</p>
        </PopoverContent>
      </Popover>
    </div>
  );
};
import AprobacionesKPIs from "@/components/reports/AprobacionesKPIs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface FlattenedRow {
  projectId: string;
  centroCostos: string;
  evento: string;
  item: CajaMenorItem;
  legalizacionTotal: number;
  legalizacionEstado: string;
  saldoAFavor: number;
  source: 'cajaMenor' | 'gastoMenor';
  gastoMenorId?: string; // DB id for gastos_menores
  fechaDesmontajeFin?: string; // For deadline calculation
}

interface GroupedPendingRow {
  key: string;
  tipo: 'S' | 'R' | 'C';
  centroCostos: string;
  evento: string;
  totalValor: number;
  totalLegalizacion: number;
  totalSaldo: number;
  latestDate: string | undefined;
  rows: FlattenedRow[];
  fechaDesmontajeFin?: string;
}

interface Suggestion {
  type: 'estado' | 'categoria' | 'empleado' | 'evento' | 'cc' | 'legalizacion' | 'tipo' | 'aprobadoPor' | 'estadoLeg';
  label: string;
  value: string;
  displayLabel: string;
}

const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function parseDateSafe(dateStr?: string): Date | null {
  if (!dateStr) return null;
  try {
    return parseISO(dateStr);
  } catch {
    return null;
  }
}

function getLegalizacionForEmployee(
  legalizacion: LegalizacionItem[] | undefined,
  empleadoNombre?: string,
  cajaMenorIds?: Set<string>
): { total: number; estado: string } {
  if (!legalizacion || !empleadoNombre) return { total: 0, estado: "Pendiente" };
  // Only include legalization items linked to an anticipo (leg-xxx), exclude standalone "Recursos propios"
  const matched = legalizacion.filter(
    (l) =>
      l.empleadoNombre?.toLowerCase() === empleadoNombre.toLowerCase() &&
      (cajaMenorIds ? cajaMenorIds.has(l.id) : true)
  );
  const total = matched.reduce((sum, l) => sum + (l.valor || 0), 0);
  const allLegalized = matched.length > 0 && matched.every((l) => (l.estado as string) === "Legalizado");
  const estado = matched.length === 0 ? "Pendiente" : allLegalized ? "Legalizado" : (matched[0]?.estado as string) || "Pendiente";
  return { total, estado };
}

const MONTHS = [
  "Todos", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const LEGALIZACION_ESTADO_OPTIONS = [
  { value: "Pendiente", label: "Pendiente", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  { value: "Aprobado", label: "Aprobado", className: "bg-sky-500/20 text-sky-400 border-sky-500/30" },
  { value: "Contabilizado", label: "Contabilizado", className: "bg-violet-500/20 text-violet-400 border-violet-500/30" },
  { value: "Legalizado", label: "Legalizado", className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
];

const LEGALIZACION_PENDIENTE = { value: "Pendiente", label: "Pendiente", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" };

const KNOWN_ESTADOS = ["Pendiente", "Aprobado", "No aprobado"];
const KNOWN_CATEGORIAS = ["Transporte", "Alimentación", "Compras"];
const KNOWN_LEG_ESTADOS = ["Pendiente", "Aprobado", "Contabilizado", "Legalizado"];
const KNOWN_TIPOS = [
  { value: "S", label: "S - Solicitud de anticipos" },
  { value: "R", label: "R - Recursos propios" },
  { value: "C", label: "C - Caja menor" },
];

export default function AprobacionesPendientes() {
  const { projects, updateProject } = useProjects();
  const { canApproveCajaMenor, canRestaurarSolicitudes, canDesembolsar } = useUserRole();
  const isMobile = useIsMobile();
  const { gastos: gastosMenores, refetch: refetchGastos, deleteGasto } = useGastosMenores();

  // Get current user's employee name and ID for approver tracking
  const [currentUserName, setCurrentUserName] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.rpc("get_my_employee").then(({ data }) => {
      if (data && data.length > 0) setCurrentUserName(data[0].nombre);
    });
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.id) setCurrentUserId(data.user.id);
    });
  }, []);
  
  // Undo log state
  const [undoLog, setUndoLog] = useState<UndoLogEntry[]>([]);
  const [, setUndoTick] = useState(0); // force re-render for countdown

  const fetchUndoLog = useCallback(async () => {
    const { data } = await supabase
      .from("aprobacion_undo_log")
      .select("*")
      .eq("undone", false)
      .gte("expires_at", new Date().toISOString())
      .order("changed_at", { ascending: false });
    setUndoLog((data as UndoLogEntry[]) || []);
  }, []);

  useEffect(() => {
    fetchUndoLog();
  }, [fetchUndoLog]);

  // Realtime subscription for undo log so other users see changes immediately
  useEffect(() => {
    const channel = supabase
      .channel("aprobaciones_undo_log_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "aprobacion_undo_log" }, () => {
        fetchUndoLog();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchUndoLog]);

  // Tick every 30s to update countdown badges
  useEffect(() => {
    const interval = setInterval(() => {
      setUndoTick(t => t + 1);
      // Also prune expired entries
      setUndoLog(prev => prev.filter(e => new Date(e.expires_at) > new Date()));
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const getUndoEntryForGroup = useCallback((groupKey: string, groupRows: FlattenedRow[]) => {
    // Find the most recent non-expired undo entry for any item in this group (including legalization undos)
    // Only match entries where the NEW estado is not "Pendiente" (timer only for Aprobado/Rechazado changes)
    // Also verify the item's CURRENT estado matches the undo entry's new_estado to avoid stale timers
    const itemIds = new Set<string>();
    groupRows.forEach(r => {
      itemIds.add(r.item.id);
      itemIds.add(`leg-${r.item.id}`);
    });
    return undoLog.find(entry => {
      if (!itemIds.has(entry.item_id) || entry.undone || new Date(entry.expires_at) <= new Date() || entry.new_estado === "Pendiente") return false;
      // Check that the current estado of the matching row actually matches the undo entry's new_estado
      const matchingRow = groupRows.find(r => r.item.id === entry.item_id || `leg-${r.item.id}` === entry.item_id);
      if (!matchingRow) return false;
      // For legalization entries, check legalizacionEstado
      if (entry.item_id.startsWith('leg-')) {
        return matchingRow.legalizacionEstado === entry.new_estado;
      }
      // For regular entries, check item estado
      return matchingRow.item.estado === entry.new_estado;
    });
  }, [undoLog]);

  const formatTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const mins = differenceInMinutes(expires, now);
    if (mins <= 0) return null;
    const hours = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return hours > 0 ? `${hours}h ${remainMins}m` : `${remainMins}m`;
  };

  const [mesFilter, setMesFilter] = useState("Todos");
  const [anioFilter, setAnioFilter] = useState("Todos");
  const [estadoFilter, setEstadoFilter] = useState("Todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Restore functionality state
  const [selectedForRestore, setSelectedForRestore] = useState<Set<string>>(new Set());
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [restoreReasonInput, setRestoreReasonInput] = useState("");
  const [isRestoring, setIsRestoring] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [globalSearch, setGlobalSearch] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("S");

  // Clear stale selections when history dialog opens or resolved rows change
  const openHistoryDialog = useCallback(() => {
    setSelectedForRestore(new Set());
    setShowHistoryDialog(true);
  }, []);

  // Unique values for autocomplete suggestions
  const uniqueEmpleados = useMemo(() => {
    const set = new Set<string>();
    projects.forEach(p => {
      if (p.isDeleted) return;
      (p.cajaMenor || []).forEach(item => {
        if (item.empleadoNombre) set.add(item.empleadoNombre);
      });
    });
    return Array.from(set).sort();
  }, [projects]);

  const uniqueEventos = useMemo(() => {
    const set = new Set<string>();
    projects.forEach(p => {
      if (p.isDeleted) return;
      if ((p.cajaMenor || []).length > 0 && p.evento) set.add(p.evento);
    });
    return Array.from(set).sort();
  }, [projects]);

  const uniqueCCs = useMemo(() => {
    const set = new Set<string>();
    projects.forEach(p => {
      if (p.isDeleted) return;
      if ((p.cajaMenor || []).length > 0 && p.centroCostos) set.add(p.centroCostos);
    });
    return Array.from(set).sort();
  }, [projects]);

  const uniqueAprobadoPor = useMemo(() => {
    const set = new Set<string>();
    projects.forEach(p => {
      if (p.isDeleted) return;
      (p.cajaMenor || []).forEach(item => {
        if (item.revisadoPor) set.add(item.revisadoPor);
      });
      (p.legalizacion || []).forEach(l => {
        if (l.revisadoPor) set.add(l.revisadoPor);
      });
    });
    gastosMenores.forEach(g => {
      if (g.aprobado_por_nombre) set.add(g.aprobado_por_nombre);
    });
    return Array.from(set).sort();
  }, [projects, gastosMenores]);

  // Current token being typed (after last comma)
  const currentToken = useMemo(() => {
    const parts = searchQuery.split(',');
    return parts[parts.length - 1].trim().toLowerCase();
  }, [searchQuery]);

  // Generate autocomplete suggestions
  const suggestions = useMemo((): Suggestion[] => {
    if (currentToken.length < 1) return [];
    const results: Suggestion[] = [];
    const normalizedToken = normalize(currentToken);

    // Tipo suggestions
    KNOWN_TIPOS.filter(t => normalize(t.value).includes(normalizedToken) || normalize(t.label).includes(normalizedToken)).forEach(t => {
      results.push({ type: 'tipo', label: 'Tipo', value: t.value, displayLabel: t.label });
    });

    // Estado solicitud suggestions
    KNOWN_ESTADOS.filter(e => normalize(e).includes(normalizedToken)).forEach(e => {
      results.push({ type: 'estado', label: 'Estado Sol.', value: e, displayLabel: e });
    });

    // Categoría suggestions
    KNOWN_CATEGORIAS.filter(c => normalize(c).includes(normalizedToken)).forEach(c => {
      results.push({ type: 'categoria', label: 'Categoría', value: c, displayLabel: c });
    });

    // Estado legalización suggestions
    KNOWN_LEG_ESTADOS.filter(l => normalize(l).includes(normalizedToken)).forEach(l => {
      results.push({ type: 'estadoLeg', label: 'Estado Leg.', value: l, displayLabel: l });
    });

    // Empleado suggestions
    uniqueEmpleados.filter(e => normalize(e).includes(normalizedToken)).slice(0, 5).forEach(e => {
      results.push({ type: 'empleado', label: 'Empleado', value: e, displayLabel: e });
    });

    // Aprobado por suggestions
    uniqueAprobadoPor.filter(a => normalize(a).includes(normalizedToken)).slice(0, 5).forEach(a => {
      results.push({ type: 'aprobadoPor', label: 'Aprobado por', value: a, displayLabel: a });
    });

    // CC suggestions
    uniqueCCs.filter(c => normalize(c).includes(normalizedToken)).slice(0, 5).forEach(c => {
      results.push({ type: 'cc', label: 'CC', value: c, displayLabel: c });
    });

    return results.slice(0, 12);
  }, [currentToken, uniqueEmpleados, uniqueEventos, uniqueCCs, uniqueAprobadoPor]);

  // Handle suggestion selection
  const handleSelectSuggestion = useCallback((suggestion: Suggestion) => {
    const parts = searchQuery.split(',');
    parts.pop();
    const newValue = parts.length > 0
      ? parts.map(p => p.trim()).join(', ') + ', ' + suggestion.value
      : suggestion.value;
    setSearchQuery(newValue + ', ');
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    inputRef.current?.focus();
  }, [searchQuery]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
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

  // Close suggestions on outside click
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

  // Show suggestions when typing
  useEffect(() => {
    if (suggestions.length > 0 && currentToken.length >= 2) {
      setShowSuggestions(true);
      setSelectedSuggestionIndex(-1);
    } else {
      setShowSuggestions(false);
    }
  }, [suggestions, currentToken]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    projects.forEach((p) => {
      if (p.isDeleted) return;
      (p.cajaMenor || []).forEach((item) => {
        const d = parseDateSafe(item.createdAt);
        if (d) years.add(getYear(d));
      });
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [projects]);

  const rows: FlattenedRow[] = useMemo(() => {
    const result: FlattenedRow[] = [];
    // cajaMenor items from projects (Solicitud de anticipos)
    projects.forEach((project) => {
      if (project.isDeleted) return;
      // Build set of legalization IDs linked to anticipos
      const linkedLegIds = new Set((project.cajaMenor || []).map((cm) => `leg-${cm.id}`));
      (project.cajaMenor || []).forEach((item) => {
        const leg = getLegalizacionForEmployee(project.legalizacion, item.empleadoNombre, linkedLegIds);
        result.push({
          projectId: project.id,
          centroCostos: project.centroCostos || "",
          evento: project.evento || "",
          item,
          legalizacionTotal: leg.total,
          legalizacionEstado: leg.estado,
          saldoAFavor: (item.valor || 0) - leg.total,
          source: 'cajaMenor',
          fechaDesmontajeFin: project.fechaDesmontajeFin,
        });
      });
      // Recursos propios: legalizacion items NOT linked to an anticipo
      (project.legalizacion || []).forEach((leg) => {
        if (linkedLegIds.has(leg.id)) return; // skip legalizations linked to anticipos
         const legEstado = leg.estado as string;
        // Map legalization estados to solicitud estados properly
        const normalizedEstado = ["Pendiente", "Aprobado", "No aprobado"].includes(legEstado)
          ? legEstado
          : legEstado === "Legalizado" ? "Aprobado"
          : legEstado === "Rechazado" || legEstado === "No legalizable" ? "No aprobado"
          : "Pendiente";
        const fakeItem: CajaMenorItem = {
          id: leg.id,
          empleadoId: leg.empleadoId,
          empleadoNombre: leg.empleadoNombre,
          empleadoEmail: leg.empleadoEmail,
          concepto: leg.concepto,
          valor: leg.valor,
          categoria: leg.categoria as CajaMenorItem["categoria"],
          recursos: "Recursos propios",
          contingencia: leg.contingencia || "No",
          estado: normalizedEstado as CajaMenorItem["estado"],
          imagenes: leg.imagenes,
          createdAt: leg.createdAt,
          revisadoPor: leg.revisadoPor,
           restaurada: leg.restaurada,
           restauradaPor: leg.restauradaPor,
           restauradaEn: leg.restauradaEn,
           restauradaRazon: leg.restauradaRazon,
        };
        result.push({
          projectId: project.id,
          centroCostos: project.centroCostos || "",
          evento: project.evento || "",
          item: fakeItem,
          legalizacionTotal: 0,
          legalizacionEstado: "",
          saldoAFavor: leg.valor,
          source: 'cajaMenor',
          fechaDesmontajeFin: project.fechaDesmontajeFin,
        });
      });
    });
    // gastos_menores from DB (Caja menor - "C")
    gastosMenores.forEach((g) => {
      const fakeItem: CajaMenorItem = {
        id: `gm-${g.id}`,
        empleadoNombre: g.usuario_nombre,
        concepto: g.concepto,
        valor: g.valor,
        categoria: g.categoria as CajaMenorItem["categoria"],
        recursos: "BBM",
        contingencia: "No",
        estado: g.estado as CajaMenorItem["estado"],
        restaurada: (g as any).restaurada === true,
        restauradaPor: (g as any).restaurada_por || "",
        restauradaEn: (g as any).restaurada_en || "",
        restauradaRazon: (g as any).restaurada_razon || "",
        imagenes: g.imagen_url ? [{ id: "img", name: "imagen", url: g.imagen_url, type: "image", uploadedAt: g.created_at }] : [],
        createdAt: g.created_at,
      };
      result.push({
        projectId: "",
        centroCostos: g.centro_costos || "",
        evento: "",
        item: fakeItem,
        legalizacionTotal: 0,
        legalizacionEstado: "",
        saldoAFavor: g.valor,
        source: 'gastoMenor',
        gastoMenorId: g.id,
      });
    });
    // Sort: Pendiente first, then Aprobado, then No aprobado; within each group by date desc
    const estadoOrder: Record<string, number> = { "Pendiente": 0, "Aprobado": 1, "No aprobado": 2 };
    result.sort((a, b) => {
      const orderA = estadoOrder[a.item.estado] ?? 1;
      const orderB = estadoOrder[b.item.estado] ?? 1;
      if (orderA !== orderB) return orderA - orderB;
      const da = parseDateSafe(a.item.createdAt)?.getTime() || 0;
      const db = parseDateSafe(b.item.createdAt)?.getTime() || 0;
      return db - da;
    });
    return result;
  }, [projects, gastosMenores]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const d = parseDateSafe(row.item.createdAt);
      if (mesFilter !== "Todos" && d) {
        const monthIndex = MONTHS.indexOf(mesFilter) - 1;
        if (getMonth(d) !== monthIndex) return false;
      }
      if (anioFilter !== "Todos" && d) {
        if (getYear(d) !== parseInt(anioFilter)) return false;
      }
      if (estadoFilter !== "Todos" && row.item.estado !== estadoFilter) return false;
      if (searchQuery.trim()) {
        const terms = searchQuery.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
        // Determine tipo label
        const recursos = row.item.recursos || "";
        const tipo = recursos === "Recursos propios" ? "r" : recursos === "BBM" ? "c" : "s";
        // Aprobado por
        const aprobadoPor = row.item.revisadoPor || (row.source === 'gastoMenor' ? (gastosMenores.find(g => g.id === row.gastoMenorId)?.aprobado_por_nombre || "") : "");
        // Valor and saldo as formatted strings for search
        const valorStr = (row.item.valor || 0).toLocaleString("es-CO");
        const legTotal = row.legalizacionTotal > 0 ? row.legalizacionTotal.toLocaleString("es-CO") : "";
        const saldoStr = row.saldoAFavor !== 0 ? row.saldoAFavor.toLocaleString("es-CO") : "";
        
        // Known tipo codes for exact matching
        const tipoCodes = new Set(["s", "r", "c"]);
        
        const searchable = normalize([
          row.item.empleadoNombre, d ? format(d, "dd/MM/yyyy") : "",
          row.centroCostos, row.item.categoria, valorStr,
          row.item.estado, aprobadoPor,
          legTotal, row.legalizacionEstado, saldoStr,
          row.evento,
        ].filter(Boolean).join(" "));
        
        const matches = terms.every(term => {
          // If the term is exactly a tipo code, match only against tipo
          if (tipoCodes.has(term)) {
            return tipo === term;
          }
          return searchable.includes(normalize(term));
        });
        if (!matches) return false;
      }
      return true;
    });
  }, [rows, mesFilter, anioFilter, estadoFilter, searchQuery]);

  // Split into pending and resolved
  // Pending: "Pendiente" OR (Aprobado type S with legalization not yet complete)
  // All R, C, and S with estado "Pendiente" stay pending
  // S "Aprobado" stays pending until legalization is "Legalizado"
  // Helper: check if item has active undo entry
  const hasActiveUndo = useCallback((itemId: string) => {
    return undoLog.some(e => e.item_id === itemId && !e.undone && new Date(e.expires_at) > new Date() && e.new_estado !== "Pendiente");
  }, [undoLog]);

  const pendingRows = useMemo(() => filteredRows.filter(r => {
    const estado = r.item.estado as string;
    if (estado === "Pendiente") return true;
    if (estado === "No aprobado") {
      return hasActiveUndo(r.item.id);
    }
    if (estado === "Aprobado") {
      const recursos = (r.item.recursos as string) || "";
      const isTypeS = recursos !== "Recursos propios" && recursos !== "BBM";
      const isTypeR = recursos === "Recursos propios";
      if (isTypeS) {
        if (r.legalizacionEstado !== "Legalizado") return true;
        const legUndoId = `leg-${r.item.id}`;
        if (hasActiveUndo(legUndoId)) return true;
      }
      if (isTypeR) return true;
      if (!isTypeS && !isTypeR) return hasActiveUndo(r.item.id);
    }
    if (estado === "Legalizado") {
      const recursos = (r.item.recursos as string) || "";
      if (recursos === "Recursos propios") return true;
    }
    if (estado === "Desembolsado") {
      return hasActiveUndo(r.item.id);
    }
    return false;
  }), [filteredRows, hasActiveUndo]);
  const resolvedRows = useMemo(() => filteredRows.filter(r => {
    const estado = r.item.estado as string;
    if (estado === "No aprobado") {
      return !hasActiveUndo(r.item.id);
    }
    if (estado === "Reembolsado") return true;
    if (estado === "Desembolsado") {
      return !hasActiveUndo(r.item.id);
    }
    if (estado === "Aprobado") {
      const recursos = (r.item.recursos as string) || "";
      const isTypeS = recursos !== "Recursos propios" && recursos !== "BBM";
      const isTypeR = recursos === "Recursos propios";
      if (isTypeS) {
        const legResolved = r.legalizacionEstado === "Legalizado";
        if (!legResolved) return false;
        const legUndoId = `leg-${r.item.id}`;
        return !hasActiveUndo(legUndoId);
      }
      if (isTypeR) return false;
      return !hasActiveUndo(r.item.id);
    }
    return false;
  }), [filteredRows, hasActiveUndo]);

  // Group pending rows by (centroCostos, tipo)
  const groupedPendingRows = useMemo((): GroupedPendingRow[] => {
    const groups = new Map<string, GroupedPendingRow>();
    pendingRows.forEach(row => {
      const r = (row.item.recursos as string) || "";
      const tipo: 'S' | 'R' | 'C' = r === "Recursos propios" ? "R" : r === "BBM" ? "C" : "S";
      // For tipo C (Caja menor), each row is individual (not grouped by CC)
      const key = tipo === "C" ? `gm-individual-${row.item.id}` : `${row.centroCostos || "sin-cc"}-${tipo}`;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          tipo,
          centroCostos: row.centroCostos,
          evento: row.evento,
          totalValor: 0,
          totalLegalizacion: 0,
          totalSaldo: 0,
          latestDate: undefined,
          rows: [],
        });
      }
      const group = groups.get(key)!;
      group.totalValor += (row.item.valor || 0);
      group.totalLegalizacion += row.legalizacionTotal;
      group.totalSaldo += row.saldoAFavor;
      group.rows.push(row);
      if (!group.fechaDesmontajeFin && row.fechaDesmontajeFin) {
        group.fechaDesmontajeFin = row.fechaDesmontajeFin;
      }
      const d = parseDateSafe(row.item.createdAt);
      if (d) {
        const currentLatest = group.latestDate ? parseDateSafe(group.latestDate) : null;
        if (!currentLatest || d > currentLatest) {
          group.latestDate = row.item.createdAt;
        }
      }
      if (!group.evento && row.evento) group.evento = row.evento;
    });
    // Sort: Pendiente groups first, then Aprobado; within same estado by date desc
    const result = Array.from(groups.values());
    const estadoOrder: Record<string, number> = { "Pendiente": 0, "Aprobado": 1, "No aprobado": 2 };
    result.sort((a, b) => {
      const allEstadosA = [...new Set(a.rows.map(r => r.item.estado))];
      const allEstadosB = [...new Set(b.rows.map(r => r.item.estado))];
      const commonA = allEstadosA.length === 1 ? allEstadosA[0] : "Pendiente";
      const commonB = allEstadosB.length === 1 ? allEstadosB[0] : "Pendiente";
      const orderA = estadoOrder[commonA] ?? 1;
      const orderB = estadoOrder[commonB] ?? 1;
      if (orderA !== orderB) return orderA - orderB;
      const da = a.latestDate ? parseDateSafe(a.latestDate)?.getTime() || 0 : 0;
      const db = b.latestDate ? parseDateSafe(b.latestDate)?.getTime() || 0 : 0;
      return db - da;
    });
    return result;
  }, [pendingRows]);

  // Group resolved rows by (centroCostos, tipo) - same as pending
  const groupedResolvedRows = useMemo((): GroupedPendingRow[] => {
    const groups = new Map<string, GroupedPendingRow>();
    resolvedRows.forEach(row => {
      const r = (row.item.recursos as string) || "";
      const tipo: 'S' | 'R' | 'C' = r === "Recursos propios" ? "R" : r === "BBM" ? "C" : "S";
      const key = tipo === "C" ? `gm-individual-${row.item.id}` : `${row.centroCostos || "sin-cc"}-${tipo}`;
      if (!groups.has(key)) {
        groups.set(key, { key, tipo, centroCostos: row.centroCostos, evento: row.evento, totalValor: 0, totalLegalizacion: 0, totalSaldo: 0, latestDate: undefined, rows: [] });
      }
      const group = groups.get(key)!;
      group.totalValor += (row.item.valor || 0);
      group.totalLegalizacion += row.legalizacionTotal;
      group.totalSaldo += row.saldoAFavor;
      group.rows.push(row);
      const d = parseDateSafe(row.item.createdAt);
      if (d) {
        const currentLatest = group.latestDate ? parseDateSafe(group.latestDate) : null;
        if (!currentLatest || d > currentLatest) group.latestDate = row.item.createdAt;
      }
      if (!group.evento && row.evento) group.evento = row.evento;
    });
    return Array.from(groups.values());
  }, [resolvedRows]);

  // Pending rows split by type for tabs
  const pendingByType = useMemo(() => ({
    S: groupedPendingRows.filter(g => g.tipo === 'S'),
    R: groupedPendingRows.filter(g => g.tipo === 'R'),
    C: groupedPendingRows.filter(g => g.tipo === 'C'),
  }), [groupedPendingRows]);

  const pendingCountByType = useMemo(() => ({
    S: pendingByType.S.reduce((sum, g) => sum + g.rows.length, 0),
    R: pendingByType.R.reduce((sum, g) => sum + g.rows.length, 0),
    C: pendingByType.C.reduce((sum, g) => sum + g.rows.length, 0),
  }), [pendingByType]);

  // Auto-switch tab when global search is active and current tab has no results
  useEffect(() => {
    if (!globalSearch || !searchQuery.trim()) return;
    const currentType = activeTab as 'S' | 'R' | 'C';
    if (pendingByType[currentType].length > 0) return;
    // Find first tab with results
    const order: ('S' | 'R' | 'C')[] = ['S', 'R', 'C'];
    const found = order.find(t => pendingByType[t].length > 0);
    if (found) setActiveTab(found);
  }, [globalSearch, searchQuery, pendingByType, activeTab]);

  // Log a change to the undo log
  const logUndoEntry = async (row: FlattenedRow, previousEstado: string, newEstado: string, previousRevisadoPor: string) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user?.id) return;
    const source = row.source === 'gastoMenor' ? 'gastoMenor' : (row.item.recursos as string) === "Recursos propios" ? 'legalizacion' : 'cajaMenor';

    // If reverting to Pendiente, mark all active undo entries for this item as undone instead of creating a new one
    if (newEstado === "Pendiente") {
      await supabase
        .from("aprobacion_undo_log")
        .update({ undone: true } as any)
        .eq("item_id", row.item.id)
        .eq("undone", false);
      // Also mark legalization undo entries
      await supabase
        .from("aprobacion_undo_log")
        .update({ undone: true } as any)
        .eq("item_id", `leg-${row.item.id}`)
        .eq("undone", false);
      await fetchUndoLog();
      return;
    }

    await supabase.from("aprobacion_undo_log").insert({
      project_id: row.projectId || null,
      item_id: row.item.id,
      source,
      previous_estado: previousEstado,
      new_estado: newEstado,
      previous_revisado_por: previousRevisadoPor,
      changed_by: userData.user.id,
    } as any);
    await fetchUndoLog();
  };

  // Undo a change from the undo log
  const handleUndoFromLog = async (entry: UndoLogEntry) => {
    try {
      if (entry.source === 'gastoMenor') {
        const dbId = entry.item_id.replace('gm-', '');
        const revertData = entry.previous_estado === "Pendiente"
          ? { estado: entry.previous_estado, aprobado_por_id: null, aprobado_por_nombre: "" }
          : { estado: entry.previous_estado, aprobado_por_nombre: entry.previous_revisado_por };
        await supabase.from("gastos_menores").update(revertData as any).eq("id", dbId);
        refetchGastos();
      } else {
        const proj = projects.find(p => p.id === entry.project_id);
        if (!proj) { toast.error("Proyecto no encontrado"); return; }
        if (entry.source === 'legalizacion') {
          const revertedLeg = (proj.legalizacion || []).map(l =>
            l.id === entry.item_id ? { ...l, estado: entry.previous_estado, revisadoPor: entry.previous_revisado_por } : l
          );
          await updateProject(entry.project_id!, "legalizacion", revertedLeg);
        } else {
          const revertedCM = (proj.cajaMenor || []).map(item =>
            item.id === entry.item_id ? { ...item, estado: entry.previous_estado, revisadoPor: entry.previous_revisado_por } : item
          );
          await updateProject(entry.project_id!, "cajaMenor", revertedCM);
        }
      }
      await supabase.from("aprobacion_undo_log").update({ undone: true } as any).eq("id", entry.id);
      await fetchUndoLog();
      toast.success("Cambio deshecho exitosamente");
    } catch (err) {
      toast.error("Error al deshacer el cambio");
    }
  };

  // Undo all entries for a group
  const handleUndoGroup = async (groupRows: FlattenedRow[]) => {
    const itemIds = new Set<string>();
    groupRows.forEach(r => {
      itemIds.add(r.item.id);
      itemIds.add(`leg-${r.item.id}`);
    });
    const entries = undoLog.filter(e => itemIds.has(e.item_id) && !e.undone && new Date(e.expires_at) > new Date());
    for (const entry of entries) {
      await handleUndoFromLog(entry);
    }
  };

  const handleEstadoChange = async (row: FlattenedRow, newEstado: string) => {
    if (!canApproveCajaMenor()) {
      toast.error("No tienes permisos para cambiar el estado");
      return;
    }

    const previousEstado = row.item.estado;
    const previousRevisadoPor = row.item.revisadoPor || "";

    if (row.source === 'gastoMenor' && row.gastoMenorId) {
      const { data: userData } = await supabase.auth.getUser();
      const updateData = newEstado === "Pendiente"
        ? { estado: newEstado, aprobado_por_id: null, aprobado_por_nombre: "" }
        : { estado: newEstado, aprobado_por_id: userData?.user?.id || null, aprobado_por_nombre: currentUserName || "Admin" };
      const { error } = await supabase
        .from("gastos_menores")
        .update(updateData as any)
        .eq("id", row.gastoMenorId);
      if (error) {
        toast.error("Error al actualizar estado: " + error.message);
        return;
      }
      refetchGastos();
      await logUndoEntry(row, previousEstado, newEstado, previousRevisadoPor);
      toast.success(`Estado actualizado a "${newEstado}"`);
      return;
    }

    const project = projects.find((p) => p.id === row.projectId);
    if (!project) return;

    const isRecursosPropios = (row.item.recursos as string) === "Recursos propios";
    if (isRecursosPropios) {
      const updatedLegalizacion = (project.legalizacion || []).map((l) =>
        l.id === row.item.id
          ? { ...l, estado: newEstado, revisadoPor: newEstado === "Pendiente" ? "" : currentUserName || "Admin" }
          : l
      );
      await updateProject(row.projectId, "legalizacion", updatedLegalizacion);
      await logUndoEntry(row, previousEstado, newEstado, previousRevisadoPor);
      toast.success(`Estado actualizado a "${newEstado}"`);
      return;
    }

    const updatedCajaMenor = (project.cajaMenor || []).map((item) =>
      item.id === row.item.id
        ? { ...item, estado: newEstado, revisadoPor: newEstado === "Pendiente" ? "" : currentUserName || "Admin" }
        : item
    );
    await updateProject(row.projectId, "cajaMenor", updatedCajaMenor);


    await logUndoEntry(row, previousEstado, newEstado, previousRevisadoPor);
    toast.success(`Estado de solicitud actualizado a "${newEstado}"`);
  };

  // Batch estado change for grouped rows
  const handleGroupedEstadoChange = async (group: GroupedPendingRow, newEstado: string) => {
    if (!canApproveCajaMenor()) {
      toast.error("No tienes permisos para cambiar el estado");
      return;
    }

    // Handle gastos_menores rows
    const gastoRows = group.rows.filter(r => r.source === 'gastoMenor' && r.gastoMenorId);
    for (const row of gastoRows) {
      const { data: userData } = await supabase.auth.getUser();
      const previousEstado = row.item.estado;
      const previousRevisadoPor = row.item.revisadoPor || "";
      const updateData = newEstado === "Pendiente"
        ? { estado: newEstado, aprobado_por_id: null, aprobado_por_nombre: "" }
        : { estado: newEstado, aprobado_por_id: userData?.user?.id || null, aprobado_por_nombre: currentUserName || "Admin" };
      await supabase.from("gastos_menores").update(updateData as any).eq("id", row.gastoMenorId!);
      await logUndoEntry(row, previousEstado, newEstado, previousRevisadoPor);
    }
    if (gastoRows.length > 0) refetchGastos();

    // Group project rows by projectId to batch updates
    const projectGroups = new Map<string, FlattenedRow[]>();
    group.rows.filter(r => !(r.source === 'gastoMenor' && r.gastoMenorId)).forEach(row => {
      const existing = projectGroups.get(row.projectId) || [];
      existing.push(row);
      projectGroups.set(row.projectId, existing);
    });

    for (const [projectId, pRows] of projectGroups) {
      const project = projects.find(p => p.id === projectId);
      if (!project) continue;

      const cajaMenorRows = pRows.filter(r => (r.item.recursos as string) !== "Recursos propios");
      const recursosPropiosRows = pRows.filter(r => (r.item.recursos as string) === "Recursos propios");

      if (cajaMenorRows.length > 0) {
        const ids = new Set(cajaMenorRows.map(r => r.item.id));
        const updatedCajaMenor = (project.cajaMenor || []).map(item =>
          ids.has(item.id)
            ? { ...item, estado: newEstado, revisadoPor: newEstado === "Pendiente" ? "" : currentUserName || "Admin" }
            : item
        );
        await updateProject(projectId, "cajaMenor", updatedCajaMenor);

      }

      if (recursosPropiosRows.length > 0) {
        const ids = new Set(recursosPropiosRows.map(r => r.item.id));
        const updatedLeg = (project.legalizacion || []).map(l =>
          ids.has(l.id)
            ? { ...l, estado: newEstado, revisadoPor: newEstado === "Pendiente" ? "" : currentUserName || "Admin" }
            : l
        );
        await updateProject(projectId, "legalizacion", updatedLeg);
      }
      // Log undo entries for each row in this project group
      for (const row of pRows) {
        await logUndoEntry(row, row.item.estado, newEstado, row.item.revisadoPor || "");
      }
    }

    toast.success(`Estado actualizado a "${newEstado}" para ${group.rows.length} solicitud(es)`);
  };

  // Handle legalizacion estado change
  const handleLegalizacionEstadoChange = async (row: FlattenedRow, newEstado: string) => {
    if (!canApproveCajaMenor()) {
      toast.error("No tienes permisos para cambiar el estado");
      return;
    }
    const project = projects.find((p) => p.id === row.projectId);
    if (!project) return;

    const currentLeg = project.legalizacion || [];
    const linkedLegId = `leg-${row.item.id}`;
    const hasMatch = currentLeg.some((l) => l.id === linkedLegId);

    let updatedLegalizacion;
    if (hasMatch) {
      updatedLegalizacion = currentLeg.map((l) => {
        if (l.id === linkedLegId) {
          return {
            ...l,
            estado: newEstado,
            revisadoPor: newEstado === "Pendiente" ? "" : currentUserName || "Admin",
          };
        }
        return l;
      });
    } else {
      // Create a legalizacion record linked to this cajaMenor item
      const newLeg: LegalizacionItem = {
        id: linkedLegId,
        empleadoId: row.item.empleadoId,
        empleadoNombre: row.item.empleadoNombre,
        empleadoEmail: row.item.empleadoEmail,
        concepto: row.item.concepto || "",
        valor: 0,
        categoria: (row.item.categoria === "Anticipo" ? "" : row.item.categoria || "") as LegalizacionItem["categoria"],
        recursos: row.item.recursos || "",
        contingencia: "No",
        estado: newEstado as any,
        createdAt: new Date().toISOString(),
        revisadoPor: newEstado === "Pendiente" ? "" : currentUserName || "Admin",
      };
      updatedLegalizacion = [...currentLeg, newLeg];
    }

    await updateProject(row.projectId, "legalizacion", updatedLegalizacion);

    // Log undo entry for legalization estado changes (non-Pendiente)
    if (newEstado !== "Pendiente") {
      const previousLegEstado = row.legalizacionEstado || "Pendiente";
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user?.id) {
        await supabase.from("aprobacion_undo_log").insert({
          project_id: row.projectId || null,
          item_id: `leg-${row.item.id}`,
          source: "legalizacion",
          previous_estado: previousLegEstado,
          new_estado: newEstado,
          previous_revisado_por: "",
          changed_by: userData.user.id,
        } as any);
        await fetchUndoLog();
      }
    }

    toast.success(`Estado de legalización actualizado a "${newEstado}"`);
  };

  // Handle grouped legalization estado change - updates all items in a group
  const handleGroupedLegalizacionChange = async (group: GroupedPendingRow, newEstado: string) => {
    if (!canApproveCajaMenor()) {
      toast.error("No tienes permisos para cambiar el estado de legalización");
      return;
    }
    // Update each row's legalization individually
    for (const row of group.rows) {
      if (row.item.estado !== "Aprobado") continue; // Only update legalization for approved items
      await handleLegalizacionEstadoChange(row, newEstado);
    }
  };

  // Handle delete
  const handleDelete = async (row: FlattenedRow) => {
    if (!canApproveCajaMenor()) {
      toast.error("No tienes permisos para eliminar solicitudes");
      return;
    }
    if (!confirm("¿Estás seguro de que deseas eliminar esta solicitud?")) return;

    if (row.source === 'gastoMenor' && row.gastoMenorId) {
      await deleteGasto(row.gastoMenorId);
      return;
    }

    const project = projects.find((p) => p.id === row.projectId);
    if (!project) return;

    const isRecursosPropios = (row.item.recursos as string) === "Recursos propios";
    if (isRecursosPropios) {
      const updatedLegalizacion = (project.legalizacion || []).filter((l) => l.id !== row.item.id);
      await updateProject(row.projectId, "legalizacion", updatedLegalizacion);
    } else {
      const updatedCajaMenor = (project.cajaMenor || []).filter((item) => item.id !== row.item.id);
      await updateProject(row.projectId, "cajaMenor", updatedCajaMenor);
      // Also remove linked legalizacion
      const updatedLegalizacion = (project.legalizacion || []).filter((l) => l.id !== `leg-${row.item.id}`);
      await updateProject(row.projectId, "legalizacion", updatedLegalizacion);
    }
    toast.success("Solicitud eliminada");
  };

  // Restore selected solicitudes back to "Pendiente"
  const handleRestoreSelected = async () => {
    if (selectedForRestore.size === 0) {
      toast.error("Selecciona al menos una solicitud para restaurar");
      return;
    }
    setShowPasswordDialog(true);
  };

  const confirmRestore = async () => {
    if (!passwordInput) {
      toast.error("Ingresa tu contraseña");
      return;
    }
    setIsRestoring(true);
    try {
      // Verify password by re-authenticating
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user?.email) {
        toast.error("No se pudo verificar el usuario");
        setIsRestoring(false);
        return;
      }
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: userData.user.email,
        password: passwordInput,
      });
      if (authError) {
        toast.error("Contraseña incorrecta");
        setIsRestoring(false);
        return;
      }

      // Match selected rows - selections can be group keys (from history dialog) or individual row keys
      const rowsToRestore: FlattenedRow[] = [];
      const selectedKeys = selectedForRestore;
      
      // Check if selections are group keys (from grouped history view)
      for (const group of groupedResolvedRows) {
        if (selectedKeys.has(group.key)) {
          rowsToRestore.push(...group.rows);
        }
      }
      
      // Also check individual row keys (projectId-itemId) as fallback
      if (rowsToRestore.length === 0) {
        rows.forEach(r => {
          const rowKey = `${r.projectId}-${r.item.id}`;
          if (selectedKeys.has(rowKey)) rowsToRestore.push(r);
        });
      }

      if (rowsToRestore.length === 0) {
        toast.error("No se encontraron solicitudes para restaurar");
        setIsRestoring(false);
        setShowPasswordDialog(false);
        setPasswordInput("");
        setRestoreReasonInput("");
        return;
      }
      
      // Group rows by projectId to batch updates
      const gastoMenorRows = rowsToRestore.filter(r => r.source === 'gastoMenor' && r.gastoMenorId);
      const projectRows = rowsToRestore.filter(r => !(r.source === 'gastoMenor' && r.gastoMenorId));
      
      const restoreTimestamp = new Date().toISOString();
      const restoreBy = currentUserName || "Administrador";

      // Handle gastos_menores (DB rows)
      for (const row of gastoMenorRows) {
        await supabase
          .from("gastos_menores")
          .update({ estado: "Pendiente", aprobado_por_id: null, aprobado_por_nombre: "", restaurada: true, restaurada_por: restoreBy, restaurada_en: restoreTimestamp, restaurada_razon: restoreReasonInput } as any)
          .eq("id", row.gastoMenorId!);
        toast.info(`Solicitud de caja menor restaurada a Pendiente`);
      }
      
      // Group project rows by projectId
      const byProject = new Map<string, FlattenedRow[]>();
      for (const row of projectRows) {
        const existing = byProject.get(row.projectId) || [];
        existing.push(row);
        byProject.set(row.projectId, existing);
      }
      
      // Apply all changes per project in one batch
      for (const [projectId, rows] of byProject) {
        const project = projects.find(p => p.id === projectId);
        if (!project) continue;
        
        const cajaMenorIdsToRestore = new Set(
          rows.filter(r => (r.item.recursos as string) !== "Recursos propios").map(r => r.item.id)
        );
        const legIdsToRestore = new Set(
          rows.filter(r => (r.item.recursos as string) === "Recursos propios").map(r => r.item.id)
        );
        
        if (cajaMenorIdsToRestore.size > 0) {
          // Reset estado to "Pendiente" and mark as restaurada
          const updatedCajaMenor = (project.cajaMenor || []).map(item =>
            cajaMenorIdsToRestore.has(item.id)
              ? { ...item, estado: "Pendiente", revisadoPor: "", restaurada: true, restauradaPor: restoreBy, restauradaEn: restoreTimestamp, restauradaRazon: restoreReasonInput }
              : item
          );
          await updateProject(projectId, "cajaMenor", updatedCajaMenor);
          
          // Reset linked legalization items to "Pendiente" for type S
          const legIdsLinkedToCajaMenor = new Set(
            (project.legalizacion || [])
              .filter(l => l.id && cajaMenorIdsToRestore.has(l.id.replace("leg-", "")))
              .map(l => l.id)
          );
          if (legIdsLinkedToCajaMenor.size > 0) {
            const updatedLegForS = (project.legalizacion || []).map(l =>
              legIdsLinkedToCajaMenor.has(l.id)
                ? { ...l, estado: "Pendiente" }
                : l
            );
            await updateProject(projectId, "legalizacion", updatedLegForS);
          }
          
          cajaMenorIdsToRestore.forEach(() => toast.info("Solicitud de anticipo restaurada con legalización en Pendiente"));
        }
        
        if (legIdsToRestore.size > 0) {
          const updatedLeg = (project.legalizacion || []).map(l =>
            legIdsToRestore.has(l.id)
              ? { ...l, estado: "Pendiente", revisadoPor: "", restaurada: true, restauradaPor: restoreBy, restauradaEn: restoreTimestamp, restauradaRazon: restoreReasonInput }
              : l
          );
          await updateProject(projectId, "legalizacion", updatedLeg);
          legIdsToRestore.forEach(() => toast.info("Solicitud de recursos propios restaurada a Pendiente"));
        }
      }

      refetchGastos();
      toast.success(`✅ ${rowsToRestore.length} solicitud(es) restaurada(s) a Pendiente`);
      setSelectedForRestore(new Set());
      setShowPasswordDialog(false);
      setPasswordInput("");
      setRestoreReasonInput("");
    } catch (err) {
      toast.error("Error al restaurar solicitudes");
    } finally {
      setIsRestoring(false);
    }
  };

  const toggleSelectForRestore = (key: string) => {
    setSelectedForRestore(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelectAll = (rows: FlattenedRow[]) => {
    const keys = rows.map(r => `${r.projectId}-${r.item.id}`);
    const allSelected = keys.every(k => selectedForRestore.has(k));
    setSelectedForRestore(prev => {
      const next = new Set(prev);
      if (allSelected) {
        keys.forEach(k => next.delete(k));
      } else {
        keys.forEach(k => next.add(k));
      }
      return next;
    });
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(value);

  const renderRow = (row: FlattenedRow, showCheckbox: boolean, readOnly: boolean = false) => {
    const d = parseDateSafe(row.item.createdAt);
    const rowKey = `${row.projectId}-${row.item.id}`;
    const isRestored = row.item.restaurada === true;
    return (
      <TableRow key={rowKey}>
        {showCheckbox && canRestaurarSolicitudes() && (
          <TableCell className="text-xs">
            <Checkbox
              checked={selectedForRestore.has(rowKey)}
              onCheckedChange={() => toggleSelectForRestore(rowKey)}
              className="h-4 w-4"
            />
          </TableCell>
        )}
        <TableCell className="text-xs text-center">
          <div className="flex items-center gap-1 justify-center">
            {isRestored && (
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className="focus:outline-none">
                    <RotateCcw className="w-3 h-3 text-cyan-400 shrink-0 cursor-pointer" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" className="text-xs max-w-[240px] p-3">
                  <p className="font-semibold">Restaurada</p>
                  {row.item.restauradaPor && (
                    <p>Por: {row.item.restauradaPor}</p>
                  )}
                  {row.item.restauradaEn && (
                    <p>{format(parseISO(row.item.restauradaEn), "dd/MM/yyyy hh:mm a", { locale: es })}</p>
                  )}
                  {row.item.restauradaRazon && (
                    <p className="mt-1 italic">Razón: {row.item.restauradaRazon}</p>
                  )}
                </PopoverContent>
              </Popover>
            )}
            {(() => {
              const r = (row.item.recursos as string) || "";
              const tipo = r === "Recursos propios" ? "R" : r === "BBM" ? "C" : "S";
              const colorClass =
                tipo === "S" ? "bg-blue-500/20 text-blue-400 border-blue-500/40" :
                tipo === "R" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" :
                "bg-amber-500/20 text-amber-400 border-amber-500/40";
              return (
                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-md border font-bold text-sm ${colorClass}`}>
                  {tipo}
                </span>
              );
            })()}
          </div>
        </TableCell>
        <TableCell className="text-xs whitespace-nowrap">
          {d ? format(d, "dd/MM/yyyy") : "—"}
        </TableCell>
        <TableCell className="text-xs">{row.centroCostos || "—"}</TableCell>
        <TableCell className="text-xs">{row.evento || "—"}</TableCell>
        <TableCell className="text-xs text-right font-medium">
          {formatCurrency(row.item.valor || 0)}
        </TableCell>
        <TableCell className="text-xs">
          {(() => {
            const r = (row.item.recursos as string) || "";
            const tipo = r === "Recursos propios" ? "R" : r === "BBM" ? "C" : "S";
            const isTypeSAndDecided = tipo === "S" && row.item.estado !== "Pendiente";
            
            // Determine allowed values based on type
            let estadoAllowed = ["Pendiente", "Aprobado", "No aprobado"];
            if (tipo === "R") {
              estadoAllowed = canDesembolsar()
                ? ["Pendiente", "Aprobado", "No aprobado", "Legalizado", "Desembolsado"]
                : ["Pendiente", "Aprobado", "No aprobado", "Legalizado"];
            }
            
            if (canApproveCajaMenor() && !readOnly && !isTypeSAndDecided) {
              return (
                <CajaMenorEstadoSelect
                  value={row.item.estado}
                  onChange={(v) => handleEstadoChange(row, v)}
                  allowedValues={estadoAllowed}
                />
              );
            }
            return (
              <CajaMenorEstadoSelect
                value={row.item.estado}
                onChange={() => {}}
                readOnly
              />
            );
          })()}
        </TableCell>
        <TableCell className="text-xs text-right">
          {(() => {
            const r = (row.item.recursos as string) || "";
            const isR = r === "Recursos propios";
            if (row.source === 'gastoMenor' || isR) return "—";
            return formatCurrency(row.legalizacionTotal);
          })()}
        </TableCell>
        <TableCell className="text-xs">
          {(() => {
            const r = (row.item.recursos as string) || "";
            const isR = r === "Recursos propios";
            if (row.source === 'gastoMenor' || isR) {
              return <span className="text-xs text-muted-foreground">—</span>;
            }
            if (row.item.estado === "Pendiente") {
              return (
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${LEGALIZACION_PENDIENTE.className}`}>
                  {LEGALIZACION_PENDIENTE.label}
                </span>
              );
            }
            if (row.item.estado === "No aprobado") {
              return (
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${LEGALIZACION_PENDIENTE.className}`}>
                  {LEGALIZACION_PENDIENTE.label}
                </span>
              );
            }
            if (canApproveCajaMenor() && row.item.estado === "Aprobado" && !readOnly) {
              return (
                <Select
                  value={row.legalizacionEstado || "Pendiente"}
                  onValueChange={(v) => handleLegalizacionEstadoChange(row, v)}
                >
                  <SelectTrigger
                    className={`h-7 text-xs w-full border font-medium ${
                      LEGALIZACION_ESTADO_OPTIONS.find(o => o.value === (row.legalizacionEstado || "Pendiente"))?.className || LEGALIZACION_PENDIENTE.className
                    }`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span>{LEGALIZACION_ESTADO_OPTIONS.find(o => o.value === (row.legalizacionEstado || "Pendiente"))?.label || "Pendiente"}</span>
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border z-[9999]">
                    {LEGALIZACION_ESTADO_OPTIONS.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        className={`text-xs font-medium ${option.className}`}
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              );
            }
            return (
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                LEGALIZACION_ESTADO_OPTIONS.find(o => o.value === row.legalizacionEstado)?.className || LEGALIZACION_PENDIENTE.className
              }`}>
                {row.legalizacionEstado || "Pendiente"}
              </span>
            );
          })()}
        </TableCell>
        <TableCell className={`text-xs text-right font-medium ${
          (() => {
            const r = (row.item.recursos as string) || "";
            const isR = r === "Recursos propios";
            if (row.source === 'gastoMenor' || isR) return "";
            return row.saldoAFavor > 0 ? "text-green-400" : row.saldoAFavor < 0 ? "text-red-400" : "";
          })()
        }`}>
          {(() => {
            const r = (row.item.recursos as string) || "";
            const isR = r === "Recursos propios";
            if (row.source === 'gastoMenor' || isR) return "—";
            return formatCurrency(Math.abs(row.saldoAFavor));
          })()}
        </TableCell>
        <TableCell className="text-xs">
          {(() => {
            // Don't show approver name when estado is Pendiente
            if (row.item.estado === "Pendiente") return <span className="text-muted-foreground">—</span>;
            const r = (row.item.recursos as string) || "";
            const tipo = r === "Recursos propios" ? "R" : r === "BBM" ? "C" : "S";
            const solApprover = (() => {
              if (tipo === "C") {
                const gm = gastosMenores.find(g => g.id === row.gastoMenorId);
                return gm?.aprobado_por_nombre || "";
              }
              return row.item.revisadoPor || "";
            })();
            // Get legalization approver for type S
            const legApprover = tipo === "S" ? (() => {
              const proj = projects.find(p => p.id === row.projectId);
              const leg = (proj?.legalizacion || []).find(l => l.id === `leg-${row.item.id}`);
              return leg?.revisadoPor || "";
            })() : "";
            const displayText = solApprover || "—";
            return (
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className="flex items-center gap-1 max-w-[120px] focus:outline-none">
                    <span className="truncate text-xs">{displayText}</span>
                    <Eye className="w-3 h-3 text-muted-foreground hover:text-foreground cursor-pointer shrink-0" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" className="text-xs max-w-[320px] p-3 space-y-2">
                  <p className="font-semibold mb-2">Responsables de aprobaciones</p>
                  <div className="space-y-1.5">
                    <div className="flex items-start gap-2">
                      <span className="font-medium text-blue-400 whitespace-nowrap">📋 Solicitud:</span>
                      <span>{solApprover || "Sin aprobar"}</span>
                    </div>
                    {tipo === "S" && (
                      <div className="flex items-start gap-2">
                        <span className="font-medium text-emerald-400 whitespace-nowrap">📄 Legalización:</span>
                        <span>{legApprover || "Sin aprobar"}</span>
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            );
          })()}
        </TableCell>
        <TableCell className={`text-xs text-right font-medium ${
          (() => {
            const r = (row.item.recursos as string) || "";
            const isR = r === "Recursos propios";
            if (row.source === 'gastoMenor' || isR) return "";
            return row.saldoAFavor > 0 ? "text-green-400" : row.saldoAFavor < 0 ? "text-red-400" : "";
          })()
        }`}>
          {(() => {
            const r = (row.item.recursos as string) || "";
            const isR = r === "Recursos propios";
            if (row.source === 'gastoMenor' || isR) return "—";
            return formatCurrency(Math.abs(row.saldoAFavor));
          })()}
        </TableCell>
        <TableCell>
          {row.projectId && (
            <Button
              variant="link"
              size="sm"
              className="h-7 px-1 text-xs text-primary underline"
              onClick={(e) => {
                e.stopPropagation();
                const params = new URLSearchParams({
                  eventId: row.projectId,
                  eventName: row.evento,
                  source: "aprobaciones",
                  section: "cajaMenor",
                });
                window.open(`/panel-operaciones?${params.toString()}`, "_blank");
              }}
            >
              Ver más
            </Button>
          )}
        </TableCell>
      </TableRow>
    );
  };

  // Sticky scrollbar refs and sync for pending tables
  const pendingTableScrollRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const pendingStickyScrollRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const pendingSyncingRef = useRef(false);
  const [pendingContentWidths, setPendingContentWidths] = useState<Record<string, number>>({});

  const syncPendingScroll = useCallback((tipo: string, source: "table" | "sticky") => {
    if (pendingSyncingRef.current) return;
    pendingSyncingRef.current = true;
    const from = source === "table" ? pendingTableScrollRefs.current[tipo] : pendingStickyScrollRefs.current[tipo];
    const to = source === "table" ? pendingStickyScrollRefs.current[tipo] : pendingTableScrollRefs.current[tipo];
    if (from && to) {
      to.scrollLeft = from.scrollLeft;
    }
    requestAnimationFrame(() => { pendingSyncingRef.current = false; });
  }, []);

  // Measure content widths for each tab's table
  useEffect(() => {
    if (isMobile) return;
    const observers: ResizeObserver[] = [];
    (['S', 'R', 'C'] as const).forEach(tipo => {
      const el = pendingTableScrollRefs.current[tipo];
      if (!el) return;
      const observer = new ResizeObserver(() => {
        setPendingContentWidths(prev => {
          const newW = el.scrollWidth;
          if (prev[tipo] === newW) return prev;
          return { ...prev, [tipo]: newW };
        });
      });
      observer.observe(el);
      const table = el.querySelector("table");
      if (table) observer.observe(table);
      observers.push(observer);
    });
    return () => observers.forEach(o => o.disconnect());
  }, [isMobile, pendingByType]);

  const renderPendingTable = (tipo: 'S' | 'R' | 'C', groups: GroupedPendingRow[]) => {
    const showLeg = tipo === 'S';
    const colCount = showLeg ? 14 : 10;
    const contentWidth = pendingContentWidths[tipo] || 0;

    return (
      <div className="matrix-table-sticky-wrapper border rounded-md">
        <div
          ref={(el) => { pendingTableScrollRefs.current[tipo] = el; }}
          className="matrix-table-main-scroll"
          style={{
            maxHeight: "clamp(280px, 50vh, 600px)",
          }}
          onScroll={() => syncPendingScroll(tipo, "table")}
        >
        <Table>
          <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
            <TableRow>
              <TableHead className="text-xs w-[30px]"></TableHead>
              <TableHead className="text-xs">Fecha</TableHead>
              <TableHead className="text-xs">Solicitante</TableHead>
              <TableHead className="text-xs">CC</TableHead>
              <TableHead className="text-xs">Eventos</TableHead>
              <TableHead className="text-xs text-right">Valor Total</TableHead>
              <TableHead className="text-xs w-[140px]">Estado Solicitud</TableHead>
              {showLeg && <TableHead className="text-xs text-right">Legalización</TableHead>}
              {showLeg && <TableHead className="text-xs w-[140px]">Estado Legaliz.</TableHead>}
              {showLeg && <TableHead className="text-xs text-right">Saldo</TableHead>}
              <TableHead className="text-xs">Resp. aprobaciones</TableHead>
              {showLeg && <TableHead className="text-xs w-[130px]">Plazo Leg.</TableHead>}
              <TableHead className="text-xs w-[100px]">Deshacer</TableHead>
              <TableHead className="text-xs w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount} className="text-center text-muted-foreground py-8 text-sm">
                  No hay solicitudes pendientes
                </TableCell>
              </TableRow>
            ) : (
              groups.map((group) => {
                const d = group.latestDate ? parseDateSafe(group.latestDate) : null;
                const colorClass =
                  group.tipo === "S" ? "bg-blue-500/20 text-blue-400 border-blue-500/40" :
                  group.tipo === "R" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" :
                  "bg-amber-500/20 text-amber-400 border-amber-500/40";
                const firstProjectRow = group.rows.find(r => r.projectId);
                const isTypeS = group.tipo === "S";

                const allEstados = [...new Set(group.rows.map(r => r.item.estado))];
                const commonEstado = allEstados.length === 1 ? allEstados[0] : "Pendiente";

                const aprobadores = [...new Set(group.rows
                  .filter(r => r.item.estado !== "Pendiente")
                  .map(r => {
                    if (r.source === 'gastoMenor') {
                      const gm = gastosMenores.find(g => g.id === r.gastoMenorId);
                      return gm?.aprobado_por_nombre || "";
                    }
                    return r.item.revisadoPor || "";
                  })
                  .filter(Boolean)
                )];
                const aprobadoPorDisplay = commonEstado === "Pendiente" ? "—" : (aprobadores.length === 1 ? aprobadores[0] : aprobadores.length > 1 ? aprobadores.join(", ") : "—");

                const legEstados = isTypeS ? [...new Set(group.rows.map(r => r.legalizacionEstado || "Pendiente"))] : [];
                const commonLegEstado = legEstados.length === 1 ? legEstados[0] : legEstados.length > 1 ? "Mixto" : "";
                const hasRestoredRows = group.rows.some(r => r.item.restaurada === true);

                return (
                  <TableRow key={group.key}>
                    <TableCell className="text-xs text-center">
                      <div className="flex items-center gap-1 justify-center">
                        {hasRestoredRows && (() => {
                          const restoredRow = group.rows.find(r => r.item.restaurada && r.item.restauradaPor);
                          return (
                            <Popover>
                              <PopoverTrigger asChild>
                                <button type="button" className="focus:outline-none">
                                  <RotateCcw className="w-3 h-3 text-cyan-400 shrink-0 cursor-pointer" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent side="top" className="text-xs max-w-[240px] p-3">
                                   <p className="font-semibold">Restaurada</p>
                                   {restoredRow?.item.restauradaPor && (
                                     <p>Por: {restoredRow.item.restauradaPor}</p>
                                   )}
                                   {restoredRow?.item.restauradaEn && (
                                     <p>{format(parseISO(restoredRow.item.restauradaEn), "dd/MM/yyyy hh:mm a", { locale: es })}</p>
                                   )}
                                   {restoredRow?.item.restauradaRazon && (
                                     <p className="mt-1 italic">Razón: {restoredRow.item.restauradaRazon}</p>
                                   )}
                              </PopoverContent>
                            </Popover>
                          );
                        })()}
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-md border font-bold text-sm ${colorClass}`}>
                          {group.tipo}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {d ? format(d, "dd/MM/yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      <TruncatedCellWithEye
                        text={(() => {
                          const names = [...new Set(group.rows.map(r => r.item.empleadoNombre).filter(Boolean))];
                          return names.length > 0 ? names.join(", ") : "—";
                        })()}
                        label="Solicitante"
                      />
                    </TableCell>
                    <TableCell className="text-xs">{group.centroCostos || "—"}</TableCell>
                    <TableCell className="text-xs">{group.evento || "—"}</TableCell>
                    <TableCell className="text-xs text-right font-medium">
                      {formatCurrency(group.totalValor)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {(() => {
                        const isTypeSAndDecided = isTypeS && commonEstado !== "Pendiente";
                        // Check if another user has an active undo — lock editing
                        const undoEntry = getUndoEntryForGroup(group.key, group.rows);
                        const otherUserUndo = undoEntry && currentUserId && undoEntry.changed_by !== currentUserId;
                        
                        // Determine allowed values based on type
                        let estadoAllowed = ["Pendiente", "Aprobado", "No aprobado"];
                        if (group.tipo === "R") {
                          estadoAllowed = canDesembolsar()
                            ? ["Pendiente", "Aprobado", "No aprobado", "Legalizado", "Desembolsado"]
                            : ["Pendiente", "Aprobado", "No aprobado", "Legalizado"];
                        }
                        
                        if (canApproveCajaMenor() && !isTypeSAndDecided && !otherUserUndo) {
                          return (
                            <CajaMenorEstadoSelect
                              value={commonEstado}
                              onChange={(v) => handleGroupedEstadoChange(group, v)}
                              allowedValues={estadoAllowed}
                            />
                          );
                        }
                        return (
                          <CajaMenorEstadoSelect value={commonEstado} onChange={() => {}} readOnly />
                        );
                      })()}
                    </TableCell>
                    {showLeg && (
                      <TableCell className="text-xs text-right">
                        {formatCurrency(group.totalLegalizacion)}
                      </TableCell>
                    )}
                    {showLeg && (
                      <TableCell className="text-xs">
                        {(() => {
                          if (commonEstado === "Pendiente") {
                            return (
                              <span className={`text-xs font-medium px-2 py-0.5 rounded ${LEGALIZACION_PENDIENTE.className}`}>
                                {LEGALIZACION_PENDIENTE.label}
                              </span>
                            );
                          }
                          if (commonEstado === "No aprobado") {
                            return (
                              <span className={`text-xs font-medium px-2 py-0.5 rounded ${LEGALIZACION_PENDIENTE.className}`}>
                                {LEGALIZACION_PENDIENTE.label}
                              </span>
                            );
                          }
                          const hasApproved = group.rows.some(r => r.item.estado === "Aprobado");
                          const legUndoEntry = undoLog.find(e => group.rows.some(r => e.item_id === `leg-${r.item.id}`) && !e.undone && new Date(e.expires_at) > new Date() && e.new_estado !== "Pendiente");
                          const legOtherUserUndo = legUndoEntry && currentUserId && legUndoEntry.changed_by !== currentUserId;
                          if (canApproveCajaMenor() && hasApproved && !legOtherUserUndo) {
                            return (
                              <Select
                                value={commonLegEstado === "Mixto" ? "Pendiente" : (commonLegEstado || "Pendiente")}
                                onValueChange={(v) => handleGroupedLegalizacionChange(group, v)}
                              >
                                <SelectTrigger
                                  className={`h-7 text-xs w-full border font-medium ${
                                    LEGALIZACION_ESTADO_OPTIONS.find(o => o.value === (commonLegEstado === "Mixto" ? "Pendiente" : commonLegEstado || "Pendiente"))?.className || LEGALIZACION_PENDIENTE.className
                                  }`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <span>{commonLegEstado === "Mixto" ? "Mixto" : (LEGALIZACION_ESTADO_OPTIONS.find(o => o.value === (commonLegEstado || "Pendiente"))?.label || "Pendiente")}</span>
                                </SelectTrigger>
                                <SelectContent className="bg-popover border-border z-[9999]">
                                  {LEGALIZACION_ESTADO_OPTIONS.map((option) => (
                                    <SelectItem
                                      key={option.value}
                                      value={option.value}
                                      className={`text-xs font-medium ${option.className}`}
                                    >
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            );
                          }
                          const legOption = LEGALIZACION_ESTADO_OPTIONS.find(o => o.value === commonLegEstado);
                          return (
                            <span className={`text-xs font-medium px-2 py-0.5 rounded ${legOption?.className || LEGALIZACION_PENDIENTE.className}`}>
                              {commonLegEstado || "Pendiente"}
                            </span>
                          );
                        })()}
                      </TableCell>
                    )}
                    {showLeg && (
                      <TableCell className={`text-xs text-right font-medium ${
                        group.totalSaldo > 0 ? "text-green-400" : group.totalSaldo < 0 ? "text-red-400" : ""
                      }`}>
                        {formatCurrency(Math.abs(group.totalSaldo))}
                      </TableCell>
                    )}
                    <TableCell className="text-xs">
                      {(() => {
                        if (commonEstado === "Pendiente") return <span className="text-muted-foreground">—</span>;
                        // Get solicitud approvers
                        const solApprovers = [...new Set(group.rows
                          .filter(r => r.item.estado !== "Pendiente")
                          .map(r => {
                            if (r.source === 'gastoMenor') {
                              const gm = gastosMenores.find(g => g.id === r.gastoMenorId);
                              return gm?.aprobado_por_nombre || "";
                            }
                            return r.item.revisadoPor || "";
                          })
                          .filter(Boolean)
                        )];
                        // Get legalization approvers for type S
                        const legApprovers = isTypeS ? [...new Set(group.rows.map(r => {
                          const proj = projects.find(p => p.id === r.projectId);
                          const leg = (proj?.legalizacion || []).find(l => l.id === `leg-${r.item.id}`);
                          return leg?.revisadoPor || "";
                        }).filter(Boolean))] : [];

                        // Get dates from undo log
                        const solUndoEntry = undoLog.find(e =>
                          group.rows.some(r => e.item_id === r.item.id) &&
                          e.source !== 'legalizacion' && !e.undone
                        );
                        const legUndoEntryForDate = undoLog.find(e =>
                          group.rows.some(r => e.item_id === `leg-${r.item.id}`) &&
                          e.source === 'legalizacion' && !e.undone
                        );

                        const displayText = solApprovers.length > 0 ? solApprovers[0] : "—";
                        const hasInfo = solApprovers.length > 0 || legApprovers.length > 0;
                        if (!hasInfo) return <span className="text-muted-foreground">—</span>;

                        return (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button type="button" className="flex items-center gap-1 max-w-[120px] focus:outline-none">
                                <span className="truncate text-xs">{displayText}</span>
                                <Eye className="w-3 h-3 text-muted-foreground hover:text-foreground cursor-pointer shrink-0" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent side="top" className="text-xs max-w-[320px] p-3 space-y-2">
                              <p className="font-semibold mb-2">Responsables de aprobaciones</p>
                              <div className="space-y-1.5">
                                <div>
                                  <span className="font-medium text-blue-400">📋 Solicitud:</span>
                                  <p className="ml-5">{solApprovers.length > 0 ? solApprovers.join(", ") : "Sin aprobar"}</p>
                                  {solUndoEntry && (
                                    <p className="ml-5 text-muted-foreground">{format(parseISO(solUndoEntry.changed_at), "dd/MM/yyyy hh:mm a", { locale: es })}</p>
                                  )}
                                </div>
                                {isTypeS && (
                                  <div>
                                    <span className="font-medium text-emerald-400">📄 Legalización:</span>
                                    <p className="ml-5">{legApprovers.length > 0 ? legApprovers.join(", ") : "Sin aprobar"}</p>
                                    {legUndoEntryForDate && (
                                      <p className="ml-5 text-muted-foreground">{format(parseISO(legUndoEntryForDate.changed_at), "dd/MM/yyyy hh:mm a", { locale: es })}</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
                        );
                      })()}
                    </TableCell>
                    {showLeg && (
                      <TableCell className="text-xs">
                        {(() => {
                          if (commonEstado === "Pendiente") return <span className="text-muted-foreground">—</span>;
                          if (!group.fechaDesmontajeFin) return <span className="text-muted-foreground text-[10px]">Sin fecha desm.</span>;
                          try {
                            const desmFin = parseISO(group.fechaDesmontajeFin);
                            const deadline = new Date(desmFin.getTime() + 2 * 24 * 60 * 60 * 1000);
                            const now = new Date();
                            const diffMs = deadline.getTime() - now.getTime();
                            const isLate = diffMs <= 0;
                            if (isLate) {
                              const daysLate = Math.ceil(Math.abs(diffMs) / (1000 * 60 * 60 * 24));
                              return (
                                <div className="flex items-center gap-1">
                                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                                  <span className="text-[10px] font-semibold text-red-400 leading-tight">
                                    Tardía ({daysLate}d vencido)
                                  </span>
                                </div>
                              );
                            } else {
                              const daysLeft = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                              const hoursLeft = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                              return (
                                <div className="flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-green-400 shrink-0" />
                                  <span className="text-[10px] font-medium text-green-400 leading-tight">
                                    {daysLeft > 0 ? `${daysLeft}d ${hoursLeft}h` : `${hoursLeft}h`}
                                  </span>
                                </div>
                              );
                            }
                          } catch {
                            return <span className="text-muted-foreground">—</span>;
                          }
                        })()}
                      </TableCell>
                    )}
                    <TableCell className="text-xs">
                      {(() => {
                        const undoEntry = getUndoEntryForGroup(group.key, group.rows);
                        if (!undoEntry) return null;
                        const timeLeft = formatTimeRemaining(undoEntry.expires_at);
                        if (!timeLeft) return null;
                        const isOwnChange = currentUserId && undoEntry.changed_by === currentUserId;
                        if (isOwnChange) {
                          return (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1 text-xs border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUndoGroup(group.rows);
                              }}
                            >
                              <Undo2 className="w-3 h-3" />
                              {timeLeft}
                            </Button>
                          );
                        }
                        // Read-only badge for other users
                        return (
                          <Badge variant="outline" className="h-7 gap-1 text-xs border-muted-foreground/30 text-muted-foreground cursor-default">
                            <Lock className="w-3 h-3" />
                            {timeLeft}
                          </Badge>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      {firstProjectRow && (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-7 px-1 text-xs text-primary underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            const params = new URLSearchParams({
                              eventId: firstProjectRow.projectId,
                              eventName: firstProjectRow.evento,
                              source: "aprobaciones",
                              section: "cajaMenor",
                            });
                            window.open(`/panel-operaciones?${params.toString()}`, "_blank");
                          }}
                        >
                          Ver más
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        </div>

        {/* Sticky horizontal scrollbar */}
        {!isMobile && contentWidth > 0 && (
          <div
            ref={(el) => { pendingStickyScrollRefs.current[tipo] = el; }}
            className="matrix-table-sticky-scrollbar"
            onScroll={() => syncPendingScroll(tipo, "sticky")}
          >
            <div style={{ width: contentWidth, height: 1 }} />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Filters */}
      <div className={`flex ${isMobile ? "flex-col" : "flex-row"} gap-3 items-end flex-shrink-0`}>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Mes</label>
          <Select value={mesFilter} onValueChange={setMesFilter}>
            <SelectTrigger className="w-[130px] h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => (
                <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Año</label>
          <Select value={anioFilter} onValueChange={setAnioFilter}>
            <SelectTrigger className="w-[100px] h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos" className="text-xs">Todos</SelectItem>
              {availableYears.map((y) => (
                <SelectItem key={y} value={String(y)} className="text-xs">{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Estado Presupuesto</label>
          <Select value={estadoFilter} onValueChange={setEstadoFilter}>
            <SelectTrigger className="w-[150px] h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos" className="text-xs">Todos</SelectItem>
              <SelectItem value="Pendiente" className="text-xs">Pendiente</SelectItem>
              <SelectItem value="Aprobado" className="text-xs">Aprobado</SelectItem>
              <SelectItem value="No aprobado" className="text-xs">No aprobado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1 flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-muted-foreground">Buscar</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground z-10" />
            <Input
              ref={inputRef}
              placeholder="Buscar por tipo, empleado, fecha, CC, categoría, valor, estado, aprobado por... (usa comas)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              className={`pl-9 ${globalSearch ? 'pr-28' : 'pr-3'} h-9 text-xs`}
              autoComplete="off"
              name="aprobaciones-search-nofill"
              data-form-type="other"
              data-lpignore="true"
            />
            <Button
              type="button"
              variant={globalSearch ? "default" : "outline"}
              size="sm"
              className={`absolute right-1 top-1 h-7 text-[10px] gap-1 px-2 ${globalSearch ? '' : 'opacity-70'}`}
              onClick={() => setGlobalSearch(g => !g)}
              title={globalSearch ? "Búsqueda global activa: busca en todas las pestañas" : "Activar búsqueda global"}
            >
              <Globe className="w-3 h-3" />
              Global
            </Button>
            {/* Autocomplete Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div
                ref={suggestionsRef}
                className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto"
              >
                {suggestions.map((suggestion, index) => (
                  <button
                    key={`${suggestion.type}-${suggestion.value}-${index}`}
                    type="button"
                    onClick={() => handleSelectSuggestion(suggestion)}
                    className={`w-full px-4 py-2 text-left text-xs flex items-center gap-3 transition-colors ${
                      index === selectedSuggestionIndex
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <Badge
                      variant="outline"
                      className={`text-[10px] shrink-0 ${
                        suggestion.type === 'estado' ? 'bg-green-500/10 text-green-600 border-green-500/30' :
                        suggestion.type === 'categoria' ? 'bg-orange-500/10 text-orange-600 border-orange-500/30' :
                        suggestion.type === 'empleado' ? 'bg-blue-500/10 text-blue-600 border-blue-500/30' :
                        suggestion.type === 'evento' ? 'bg-purple-500/10 text-purple-600 border-purple-500/30' :
                        suggestion.type === 'cc' ? 'bg-gray-500/10 text-gray-600 border-gray-500/30' :
                        'bg-amber-500/10 text-amber-600 border-amber-500/30'
                      }`}
                    >
                      {suggestion.type === 'estado' ? 'Estado' :
                       suggestion.type === 'categoria' ? 'Cat.' :
                       suggestion.type === 'empleado' ? 'Emp.' :
                       suggestion.type === 'evento' ? 'Evento' :
                       suggestion.type === 'cc' ? 'CC' : 'Legaliz.'}
                    </Badge>
                    <span className="truncate">{suggestion.displayLabel}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs by type */}
      {globalSearch && searchQuery.trim() ? (
        /* Global search mode: show all types stacked */
        <div className="flex-1 min-h-0 space-y-4">
          <div className="flex items-center justify-between flex-shrink-0 gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Globe className="w-3.5 h-3.5 text-primary" />
              Búsqueda global activa — mostrando resultados de todas las categorías
            </div>
            {resolvedRows.length > 0 && (
              <Button variant="outline" size="sm" className="gap-2 text-xs shrink-0" onClick={openHistoryDialog}>
                <History className="w-3.5 h-3.5" />
                Historial ({groupedResolvedRows.length})
              </Button>
            )}
          </div>
          {(['S', 'R', 'C'] as const).map(tipo => {
            const groups = pendingByType[tipo];
            const count = pendingCountByType[tipo];
            if (groups.length === 0) return null;
            const labels = { S: 'Solicitud de anticipos', R: 'Recursos propios', C: 'Caja menor' };
            const colors = { S: 'bg-blue-500/20 text-blue-400 border-blue-500/40', R: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40', C: 'bg-amber-500/20 text-amber-400 border-amber-500/40' };
            return (
              <div key={tipo} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center justify-center w-5 h-5 rounded border font-bold text-[10px] ${colors[tipo]}`}>{tipo}</span>
                  <span className="text-xs font-medium text-foreground">{labels[tipo]}</span>
                  <Badge variant="outline" className="text-[10px]">{count}</Badge>
                  <span className="text-xs text-muted-foreground">
                    ({groups.length} grupo{groups.length !== 1 ? "s" : ""})
                  </span>
                </div>
                {renderPendingTable(tipo, groups)}
              </div>
            );
          })}
          {pendingByType.S.length === 0 && pendingByType.R.length === 0 && pendingByType.C.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No se encontraron resultados para "{searchQuery.trim()}"
            </div>
          )}
        </div>
      ) : (
        /* Normal tab mode */
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between flex-shrink-0 gap-2">
            <TabsList className="h-auto p-1 flex-wrap">
              <TabsTrigger value="S" className="gap-1.5 text-xs px-3 py-1.5">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded border font-bold text-[10px] bg-blue-500/20 text-blue-400 border-blue-500/40">S</span>
                Solicitud de anticipos
                <Badge variant="outline" className="text-[10px] ml-1">{pendingCountByType.S}</Badge>
              </TabsTrigger>
              <TabsTrigger value="R" className="gap-1.5 text-xs px-3 py-1.5">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded border font-bold text-[10px] bg-emerald-500/20 text-emerald-400 border-emerald-500/40">R</span>
                Recursos propios
                <Badge variant="outline" className="text-[10px] ml-1">{pendingCountByType.R}</Badge>
              </TabsTrigger>
              <TabsTrigger value="C" className="gap-1.5 text-xs px-3 py-1.5">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded border font-bold text-[10px] bg-amber-500/20 text-amber-400 border-amber-500/40">C</span>
                Caja menor
                <Badge variant="outline" className="text-[10px] ml-1">{pendingCountByType.C}</Badge>
              </TabsTrigger>
            </TabsList>
            {resolvedRows.length > 0 && (
              <Button variant="outline" size="sm" className="gap-2 text-xs shrink-0" onClick={openHistoryDialog}>
                <History className="w-3.5 h-3.5" />
                Historial ({groupedResolvedRows.length})
              </Button>
            )}
          </div>

          <TabsContent value="S" className="flex-1 min-h-0 mt-3">
            <div className="text-xs text-muted-foreground mb-2">
              {pendingByType.S.length} grupo{pendingByType.S.length !== 1 ? "s" : ""} ({pendingCountByType.S} solicitud{pendingCountByType.S !== 1 ? "es" : ""})
            </div>
            {renderPendingTable('S', pendingByType.S)}
          </TabsContent>

          <TabsContent value="R" className="flex-1 min-h-0 mt-3">
            <div className="text-xs text-muted-foreground mb-2">
              {pendingByType.R.length} grupo{pendingByType.R.length !== 1 ? "s" : ""} ({pendingCountByType.R} solicitud{pendingCountByType.R !== 1 ? "es" : ""})
            </div>
            {renderPendingTable('R', pendingByType.R)}
          </TabsContent>

          <TabsContent value="C" className="flex-1 min-h-0 mt-3">
            <div className="text-xs text-muted-foreground mb-2">
              {pendingByType.C.length} grupo{pendingByType.C.length !== 1 ? "s" : ""} ({pendingCountByType.C} solicitud{pendingCountByType.C !== 1 ? "es" : ""})
            </div>
            {renderPendingTable('C', pendingByType.C)}
          </TabsContent>
        </Tabs>
      )}

      {/* History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="sm:max-w-[90vw] max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              Historial de Solicitudes ({groupedResolvedRows.length})
            </DialogTitle>
            <DialogDescription>
              Solicitudes aprobadas y rechazadas
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-end gap-2">
            {canRestaurarSolicitudes() && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-xs"
                onClick={handleRestoreSelected}
                disabled={selectedForRestore.size === 0}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restaurar seleccionados ({selectedForRestore.size})
              </Button>
            )}
          </div>
          <div
            className="border rounded-md overflow-auto flex-1"
            style={{
              scrollbarWidth: "auto",
              scrollbarColor: "hsl(var(--muted-foreground) / 0.3) transparent",
            }}
          >
            <Table>
              <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                <TableRow>
                   {canRestaurarSolicitudes() && (
                    <TableHead className="text-xs w-[40px]">
                      <Checkbox
                        checked={groupedResolvedRows.length > 0 && groupedResolvedRows.every(g => selectedForRestore.has(g.key))}
                        onCheckedChange={() => {
                          const keys = groupedResolvedRows.map(g => g.key);
                          const allSelected = keys.every(k => selectedForRestore.has(k));
                          setSelectedForRestore(prev => {
                            const next = new Set(prev);
                            if (allSelected) keys.forEach(k => next.delete(k));
                            else keys.forEach(k => next.add(k));
                            return next;
                          });
                        }}
                        className="h-4 w-4"
                      />
                    </TableHead>
                  )}
                  <TableHead className="text-xs w-[40px]">Tipo</TableHead>
                  <TableHead className="text-xs">Fecha</TableHead>
                  <TableHead className="text-xs">Solicitante</TableHead>
                  <TableHead className="text-xs">CC</TableHead>
                  <TableHead className="text-xs">Relación de eventos</TableHead>
                  <TableHead className="text-xs text-right">Valor Total</TableHead>
                  <TableHead className="text-xs text-center">Cant.</TableHead>
                  <TableHead className="text-xs w-[140px]">Estado Solicitud</TableHead>
                  <TableHead className="text-xs">Aprobado por</TableHead>
                  <TableHead className="text-xs text-right">Legalización</TableHead>
                  <TableHead className="text-xs w-[140px]">Estado Legaliz.</TableHead>
                  <TableHead className="text-xs text-right">Saldo</TableHead>
                  <TableHead className="text-xs w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedResolvedRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={14} className="text-center text-muted-foreground py-8 text-sm">
                      No hay solicitudes en el historial
                    </TableCell>
                  </TableRow>
                ) : (
                  groupedResolvedRows.map((group) => {
                    const d = group.latestDate ? parseDateSafe(group.latestDate) : null;
                    const colorClass =
                      group.tipo === "S" ? "bg-blue-500/20 text-blue-400 border-blue-500/40" :
                      group.tipo === "R" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" :
                      "bg-amber-500/20 text-amber-400 border-amber-500/40";
                    const isTypeS = group.tipo === "S";
                    const firstProjectRow = group.rows.find(r => r.projectId);

                    const allEstados = [...new Set(group.rows.map(r => r.item.estado))];
                    const commonEstado = allEstados.length === 1 ? allEstados[0] : "Mixto";

                    const aprobadores = [...new Set(group.rows
                      .filter(r => r.item.estado !== "Pendiente")
                      .map(r => {
                        if (r.source === 'gastoMenor') {
                          const gm = gastosMenores.find(g => g.id === r.gastoMenorId);
                          return gm?.aprobado_por_nombre || "";
                        }
                        return r.item.revisadoPor || "";
                      })
                      .filter(Boolean)
                    )];
                    const aprobadoPorDisplay = commonEstado === "Pendiente" ? "—" : (aprobadores.length === 1 ? aprobadores[0] : aprobadores.length > 1 ? aprobadores.join(", ") : "—");

                    const legEstados = isTypeS ? [...new Set(group.rows.map(r => r.legalizacionEstado || "Pendiente"))] : [];
                    const commonLegEstado = legEstados.length === 1 ? legEstados[0] : legEstados.length > 1 ? "Mixto" : "";

                    const hasRestoredRows = group.rows.some(r => r.item.restaurada === true);
                    const restoredRow = hasRestoredRows ? group.rows.find(r => r.item.restaurada && r.item.restauradaPor) : null;

                    return (
                      <TableRow key={group.key}>
                        {canRestaurarSolicitudes() && (
                          <TableCell className="text-xs">
                            <Checkbox
                              checked={selectedForRestore.has(group.key)}
                              onCheckedChange={() => {
                                setSelectedForRestore(prev => {
                                  const next = new Set(prev);
                                  if (next.has(group.key)) next.delete(group.key);
                                  else next.add(group.key);
                                  return next;
                                });
                              }}
                              className="h-4 w-4"
                            />
                          </TableCell>
                        )}
                        <TableCell className="text-xs text-center">
                          <div className="flex items-center gap-1 justify-center">
                            {hasRestoredRows && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button type="button" className="focus:outline-none">
                                    <RotateCcw className="w-3 h-3 text-cyan-400 shrink-0 cursor-pointer" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent side="top" className="text-xs max-w-[240px] p-3">
                                     <p className="font-semibold">Restaurada</p>
                                     {restoredRow?.item.restauradaPor && (
                                       <p>Por: {restoredRow.item.restauradaPor}</p>
                                     )}
                                     {restoredRow?.item.restauradaEn && (
                                       <p>{format(parseISO(restoredRow.item.restauradaEn), "dd/MM/yyyy hh:mm a", { locale: es })}</p>
                                     )}
                                     {restoredRow?.item.restauradaRazon && (
                                       <p className="mt-1 italic">Razón: {restoredRow.item.restauradaRazon}</p>
                                     )}
                                </PopoverContent>
                              </Popover>
                            )}
                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-md border font-bold text-sm ${colorClass}`}>
                              {group.tipo}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {d ? format(d, "dd/MM/yyyy") : "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          <TruncatedCellWithEye
                            text={(() => {
                              const names = [...new Set(group.rows.map(r => r.item.empleadoNombre).filter(Boolean))];
                              return names.length > 0 ? names.join(", ") : "—";
                            })()}
                            label="Solicitante"
                          />
                        </TableCell>
                        <TableCell className="text-xs">{group.centroCostos || "—"}</TableCell>
                        <TableCell className="text-xs">{group.evento || "—"}</TableCell>
                        <TableCell className="text-xs text-right font-medium">
                          {formatCurrency(group.totalValor)}
                        </TableCell>
                        <TableCell className="text-xs text-center">
                          <Badge variant="outline" className="text-[10px]">
                            {group.rows.length}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          <CajaMenorEstadoSelect value={commonEstado} onChange={() => {}} readOnly />
                        </TableCell>
                        <TableCell className="text-xs">
                          <TruncatedCellWithEye text={aprobadoPorDisplay} label="Aprobado por" />
                        </TableCell>
                        <TableCell className="text-xs text-right">
                          {isTypeS ? formatCurrency(group.totalLegalizacion) : "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {isTypeS ? (
                            <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                              LEGALIZACION_ESTADO_OPTIONS.find(o => o.value === commonLegEstado)?.className || LEGALIZACION_PENDIENTE.className
                            }`}>
                              {commonLegEstado || "Pendiente"}
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className={`text-xs text-right font-medium ${
                          isTypeS ? (group.totalSaldo > 0 ? "text-green-400" : group.totalSaldo < 0 ? "text-red-400" : "") : ""
                        }`}>
                          {isTypeS ? formatCurrency(Math.abs(group.totalSaldo)) : "—"}
                        </TableCell>
                        <TableCell>
                          {firstProjectRow && (
                            <Button
                              variant="link"
                              size="sm"
                              className="h-7 px-1 text-xs text-primary underline"
                              onClick={(e) => {
                                e.stopPropagation();
                                const params = new URLSearchParams({
                                  eventId: firstProjectRow.projectId,
                                  eventName: firstProjectRow.evento,
                                  source: "aprobaciones",
                                  section: "cajaMenor",
                                });
                                window.open(`/panel-operaciones?${params.toString()}`, "_blank");
                              }}
                            >
                              Ver más
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Password Confirmation Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={(open) => { if (!open) { setShowPasswordDialog(false); setPasswordInput(""); setRestoreReasonInput(""); } }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              Confirmar Restauración
            </DialogTitle>
            <DialogDescription>
              Por seguridad, ingresa tu contraseña para restaurar {selectedForRestore.size} solicitud{selectedForRestore.size !== 1 ? "es" : ""} a estado Pendiente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {/* Hidden dummy field to prevent username autofill */}
            <input type="text" name="dummy-user-nofill" autoComplete="username" style={{ position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none' }} tabIndex={-1} />
            <Input
              type="password"
              placeholder="Contraseña"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              autoComplete="new-password"
              name="restore-password-nofill"
              data-form-type="other"
              data-lpignore="true"
              autoFocus
            />
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">¿Por qué quieres realizar la restauración? <span className="text-destructive">*</span></label>
              <Textarea
                placeholder="Escribe la razón de la restauración..."
                value={restoreReasonInput}
                onChange={(e) => setRestoreReasonInput(e.target.value)}
                className="min-h-[80px] resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowPasswordDialog(false); setPasswordInput(""); setRestoreReasonInput(""); }} disabled={isRestoring}>
              Cancelar
            </Button>
            <Button onClick={confirmRestore} disabled={isRestoring || !passwordInput || !restoreReasonInput.trim()}>
              {isRestoring ? "Restaurando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom scrollbar styles */}
      <style>{`
        .flex-1.overflow-auto::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        .flex-1.overflow-auto::-webkit-scrollbar-track {
          background: transparent;
        }
        .flex-1.overflow-auto::-webkit-scrollbar-thumb {
          background: hsl(var(--muted-foreground) / 0.3);
          border-radius: 5px;
        }
        .flex-1.overflow-auto::-webkit-scrollbar-thumb:hover {
          background: hsl(var(--muted-foreground) / 0.5);
        }
      `}</style>
    </div>
  );
}
