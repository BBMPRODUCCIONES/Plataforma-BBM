import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useProjects } from "@/contexts/ProjectsContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Project, CajaMenorItem, LegalizacionItem } from "@/types";
import { useGastosMenores, GastoMenor } from "@/hooks/useGastosMenores";
import { supabase } from "@/integrations/supabase/client";

import { format, parseISO, getMonth, getYear } from "date-fns";
import { es } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { CajaMenorEstadoSelect } from "@/components/CajaMenorEstadoSelect";
import { Search } from "lucide-react";
import AprobacionesKPIs from "@/components/reports/AprobacionesKPIs";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

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
}

interface Suggestion {
  type: 'estado' | 'categoria' | 'empleado' | 'evento' | 'cc' | 'legalizacion';
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
  empleadoNombre?: string
): { total: number; estado: string } {
  if (!legalizacion || !empleadoNombre) return { total: 0, estado: "Pendiente" };
  const matched = legalizacion.filter(
    (l) => l.empleadoNombre?.toLowerCase() === empleadoNombre.toLowerCase()
  );
  const total = matched.reduce((sum, l) => sum + (l.valor || 0), 0);
  const allApproved = matched.length > 0 && matched.every((l) => l.estado === "Aprobado");
  const estado = matched.length === 0 ? "Revisando" : allApproved ? "Legalizado" : "Revisando";
  return { total, estado };
}

const MONTHS = [
  "Todos", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const LEGALIZACION_ESTADO_OPTIONS = [
  { value: "Revisando", label: "Revisando", className: "bg-yellow-500/20 text-yellow-400" },
  { value: "Legalizado", label: "Legalizado", className: "bg-green-500/20 text-green-400" },
  { value: "Rechazado", label: "Rechazado", className: "bg-red-500/20 text-red-400" },
];

const LEGALIZACION_NO_APROBADO = { value: "No legalizable", label: "No legalizable", className: "bg-red-500/20 text-red-400" };

const KNOWN_ESTADOS = ["Pendiente", "Aprobado", "No aprobado"];
const KNOWN_CATEGORIAS = ["Transporte", "Alimentación", "Compras"];
const KNOWN_LEG_ESTADOS = ["Revisando", "Legalizado", "No legalizable"];

export default function AprobacionesPendientes() {
  const { projects, updateProject } = useProjects();
  const { canApproveCajaMenor } = useUserRole();
  const isMobile = useIsMobile();
  const { gastos: gastosMenores, refetch: refetchGastos, deleteGasto } = useGastosMenores();

  // Get current user's employee name for approver tracking
  const [currentUserName, setCurrentUserName] = useState("");
  useEffect(() => {
    supabase.rpc("get_my_employee").then(({ data }) => {
      if (data && data.length > 0) setCurrentUserName(data[0].nombre);
    });
  }, []);
  

  const [mesFilter, setMesFilter] = useState("Todos");
  const [anioFilter, setAnioFilter] = useState("Todos");
  const [estadoFilter, setEstadoFilter] = useState("Todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

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

  // Current token being typed (after last comma)
  const currentToken = useMemo(() => {
    const parts = searchQuery.split(',');
    return parts[parts.length - 1].trim().toLowerCase();
  }, [searchQuery]);

  // Generate autocomplete suggestions
  const suggestions = useMemo((): Suggestion[] => {
    if (currentToken.length < 2) return [];
    const results: Suggestion[] = [];
    const normalizedToken = normalize(currentToken);

    // Estado suggestions
    KNOWN_ESTADOS.filter(e => normalize(e).includes(normalizedToken)).forEach(e => {
      results.push({ type: 'estado', label: 'Estado', value: e, displayLabel: e });
    });

    // Categoría suggestions
    KNOWN_CATEGORIAS.filter(c => normalize(c).includes(normalizedToken)).forEach(c => {
      results.push({ type: 'categoria', label: 'Categoría', value: c, displayLabel: c });
    });

    // Legalización estado suggestions
    KNOWN_LEG_ESTADOS.filter(l => normalize(l).includes(normalizedToken)).forEach(l => {
      results.push({ type: 'legalizacion', label: 'Legaliz.', value: l, displayLabel: l });
    });

    // Empleado suggestions
    uniqueEmpleados.filter(e => normalize(e).includes(normalizedToken)).slice(0, 5).forEach(e => {
      results.push({ type: 'empleado', label: 'Empleado', value: e, displayLabel: e });
    });

    // Evento suggestions
    uniqueEventos.filter(e => normalize(e).includes(normalizedToken)).slice(0, 5).forEach(e => {
      results.push({ type: 'evento', label: 'Evento', value: e, displayLabel: e });
    });

    // CC suggestions
    uniqueCCs.filter(c => normalize(c).includes(normalizedToken)).slice(0, 5).forEach(c => {
      results.push({ type: 'cc', label: 'CC', value: c, displayLabel: c });
    });

    return results.slice(0, 10);
  }, [currentToken, uniqueEmpleados, uniqueEventos, uniqueCCs]);

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
      (project.cajaMenor || []).forEach((item) => {
        const leg = getLegalizacionForEmployee(project.legalizacion, item.empleadoNombre);
        result.push({
          projectId: project.id,
          centroCostos: project.centroCostos || "",
          evento: project.evento || "",
          item,
          legalizacionTotal: leg.total,
          legalizacionEstado: leg.estado,
          saldoAFavor: (item.valor || 0) - leg.total,
          source: 'cajaMenor',
        });
      });
      // Recursos propios: legalizacion items NOT linked to an anticipo
      const anticipoIds = new Set((project.cajaMenor || []).map((cm) => `leg-${cm.id}`));
      (project.legalizacion || []).forEach((leg) => {
        if (anticipoIds.has(leg.id)) return; // skip legalizations linked to anticipos
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
          estado: leg.estado as CajaMenorItem["estado"],
          imagenes: leg.imagenes,
          createdAt: leg.createdAt,
        };
        result.push({
          projectId: project.id,
          centroCostos: project.centroCostos || "",
          evento: project.evento || "",
          item: fakeItem,
          legalizacionTotal: 0,
          legalizacionEstado: "",
          saldoAFavor: leg.valor,
          source: 'cajaMenor', // use cajaMenor source so estado changes update legalizacion array
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
        // Multi-term search separated by commas (like Caja Menor report)
        const terms = searchQuery.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
        const searchable = [
          row.item.empleadoNombre, row.centroCostos, row.item.concepto,
          row.evento, row.item.categoria, row.item.estado,
          row.legalizacionEstado,
          d ? format(d, "dd/MM/yyyy") : "",
        ].filter(Boolean).join(" ").toLowerCase();
        // ALL terms must match
        if (!terms.every(term => searchable.includes(term))) return false;
      }
      return true;
    });
  }, [rows, mesFilter, anioFilter, estadoFilter, searchQuery]);

  // Handle solicitud estado change
  const handleEstadoChange = async (row: FlattenedRow, newEstado: string) => {
    if (!canApproveCajaMenor()) {
      toast.error("No tienes permisos para cambiar el estado");
      return;
    }

    // For gastos_menores (source: gastoMenor), update DB directly
    if (row.source === 'gastoMenor' && row.gastoMenorId) {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("gastos_menores")
        .update({
          estado: newEstado,
          aprobado_por_id: userData?.user?.id || null,
          aprobado_por_nombre: currentUserName || "Admin",
        } as any)
        .eq("id", row.gastoMenorId);
      if (error) {
        toast.error("Error al actualizar estado: " + error.message);
        return;
      }
      toast.success(`Estado actualizado a "${newEstado}"`);
      return;
    }

    const project = projects.find((p) => p.id === row.projectId);
    if (!project) return;

    // Check if this is a "Recursos propios" item (lives in legalizacion array)
    const isRecursosPropios = (row.item.recursos as string) === "Recursos propios";
    if (isRecursosPropios) {
      const updatedLegalizacion = (project.legalizacion || []).map((l) =>
        l.id === row.item.id ? { ...l, estado: newEstado } : l
      );
      await updateProject(row.projectId, "legalizacion", updatedLegalizacion);
      toast.success(`Estado actualizado a "${newEstado}"`);
      return;
    }

    const updatedCajaMenor = (project.cajaMenor || []).map((item) =>
      item.id === row.item.id ? { ...item, estado: newEstado } : item
    );
    await updateProject(row.projectId, "cajaMenor", updatedCajaMenor);

    // If "No aprobado", auto-set legalizacion to "No legalizable"
    if (newEstado === "No aprobado") {
      const updatedLegalizacion = (project.legalizacion || []).map((l) => {
        if (l.empleadoNombre?.toLowerCase() === row.item.empleadoNombre?.toLowerCase()) {
          return { ...l, estado: "No legalizable" };
        }
        return l;
      });
      await updateProject(row.projectId, "legalizacion", updatedLegalizacion);
    }

    toast.success(`Estado de solicitud actualizado a "${newEstado}"`);
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
    const hasMatch = currentLeg.some(
      (l) => l.empleadoNombre?.toLowerCase() === row.item.empleadoNombre?.toLowerCase()
    );

    let updatedLegalizacion;
    if (hasMatch) {
      updatedLegalizacion = currentLeg.map((l) => {
        if (l.empleadoNombre?.toLowerCase() === row.item.empleadoNombre?.toLowerCase()) {
          return { ...l, estado: newEstado };
        }
        return l;
      });
    } else {
      // Create a legalizacion record linked to this cajaMenor item
      const newLeg: LegalizacionItem = {
        id: `leg-${row.item.id}`,
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
      };
      updatedLegalizacion = [...currentLeg, newLeg];
    }

    await updateProject(row.projectId, "legalizacion", updatedLegalizacion);
    toast.success(`Estado de legalización actualizado a "${newEstado}"`);
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

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(value);

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
              placeholder="Buscar por empleado, evento, categoría, estado... (usa comas)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              className="pl-9 h-9 text-xs"
            />
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

      {/* KPIs */}
      <AprobacionesKPIs rows={filteredRows} />

      <div className="text-xs text-muted-foreground flex-shrink-0">
        {filteredRows.length} solicitud{filteredRows.length !== 1 ? "es" : ""} encontrada{filteredRows.length !== 1 ? "s" : ""}
      </div>

      {/* Table with visible scrollbar */}
      <div
        className="flex-1 min-h-0 border rounded-md overflow-auto"
        style={{
          maxHeight: "clamp(360px, 50vh, 600px)",
          scrollbarWidth: "auto",
          scrollbarColor: "hsl(var(--muted-foreground) / 0.3) transparent",
        }}
      >
        <Table>
          <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
            <TableRow>
              <TableHead className="text-xs w-[40px]">Tipo</TableHead>
              <TableHead className="text-xs">Fecha</TableHead>
              <TableHead className="text-xs">CC</TableHead>
              <TableHead className="text-xs">Categoría</TableHead>
              <TableHead className="text-xs text-right">Valor</TableHead>
              <TableHead className="text-xs w-[140px]">Estado Solicitud</TableHead>
              <TableHead className="text-xs">Aprobado por</TableHead>
              <TableHead className="text-xs text-right">Legalización</TableHead>
              <TableHead className="text-xs w-[140px]">Estado Legaliz.</TableHead>
              <TableHead className="text-xs text-right">Saldo</TableHead>
              <TableHead className="text-xs w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground py-8 text-sm">
                  No se encontraron solicitudes
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.map((row) => {
                const d = parseDateSafe(row.item.createdAt);
                return (
                  <TableRow key={`${row.projectId}-${row.item.id}`}>
                    <TableCell className="text-xs text-center">
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
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {d ? format(d, "dd/MM/yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{row.centroCostos || "—"}</TableCell>
                    <TableCell className="text-xs">{row.item.categoria || "—"}</TableCell>
                    <TableCell className="text-xs text-right font-medium">
                      {formatCurrency(row.item.valor || 0)}
                    </TableCell>
                    {/* Estado Solicitud - editable for admin */}
                    <TableCell className="text-xs">
                      {canApproveCajaMenor() ? (
                        <CajaMenorEstadoSelect
                          value={row.item.estado}
                          onChange={(v) => handleEstadoChange(row, v)}
                        />
                      ) : (
                        <CajaMenorEstadoSelect
                          value={row.item.estado}
                          onChange={() => {}}
                          readOnly
                        />
                      )}
                    </TableCell>
                    {/* Aprobado por */}
                    <TableCell className="text-xs whitespace-nowrap">
                      {row.source === 'gastoMenor' ? (
                        (() => {
                          const gm = gastosMenores.find(g => g.id === row.gastoMenorId);
                          return gm?.aprobado_por_nombre || "—";
                        })()
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-right">
                      {row.source === 'gastoMenor' ? "—" : formatCurrency(row.legalizacionTotal)}
                    </TableCell>
                    {/* Estado Legalización - editable only after solicitud is Aprobado */}
                    <TableCell className="text-xs">
                      {row.source === 'gastoMenor' ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : row.item.estado === "No aprobado" ? (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${LEGALIZACION_NO_APROBADO.className}`}>
                          {LEGALIZACION_NO_APROBADO.label}
                        </span>
                      ) : canApproveCajaMenor() && row.item.estado === "Aprobado" ? (
                        <Select
                          value={row.legalizacionEstado}
                          onValueChange={(v) => handleLegalizacionEstadoChange(row, v)}
                        >
                          <SelectTrigger
                            className={`h-7 text-xs w-full border font-medium ${
                              LEGALIZACION_ESTADO_OPTIONS.find(o => o.value === row.legalizacionEstado)?.className || ""
                            }`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-popover border-border z-50">
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
                      ) : (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                          LEGALIZACION_ESTADO_OPTIONS.find(o => o.value === row.legalizacionEstado)?.className || "bg-yellow-500/20 text-yellow-400"
                        }`}>
                          {row.legalizacionEstado || "Revisando"}
                        </span>
                      )}
                    </TableCell>
                    {/* Saldo: green if positive (a favor), red if negative (en contra) */}
                    <TableCell className={`text-xs text-right font-medium ${
                      row.source === 'gastoMenor' ? "" :
                      row.saldoAFavor > 0 ? "text-green-400" : row.saldoAFavor < 0 ? "text-red-400" : ""
                    }`}>
                      {row.source === 'gastoMenor' ? "—" : formatCurrency(Math.abs(row.saldoAFavor))}
                    </TableCell>
                    <TableCell>
                      {row.source !== 'gastoMenor' && (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-7 px-1 text-xs text-primary underline"
                          onClick={() => {
                            window.open(`/?proyecto=${row.projectId}&seccion=gastos&evento=${encodeURIComponent(row.evento)}`, "_blank");
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
