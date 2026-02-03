import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useProjects } from "@/contexts/ProjectsContext";
import { useDateRange } from "@/contexts/DateRangeContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Download, Image as ImageIcon, Loader2, Eye, DownloadIcon } from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";
import * as XLSX from "xlsx";
import { CajaMenorItem, Project, Attachment } from "@/types";
import CajaMenorDashboard from "./CajaMenorDashboard";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EventLink } from "@/components/EventLink";
import { CalendarFilter } from "@/components/CalendarFilter";

interface FlattenedCajaMenorItem extends CajaMenorItem {
  eventoId: string;
  eventoNombre: string;
  recibo: string;
  fecha: string;
}

// Known categories for classification
const KNOWN_CATEGORIAS = ["compras", "alimentación", "alimentacion", "transporte", "servicios", "materiales", "equipos", "otros"];
const KNOWN_ESTADOS = ["aprobado", "no aprobado", "pendiente", "rechazado"];
const KNOWN_RECURSOS = ["caja menor", "anticipos", "reembolso"];
const KNOWN_PROCESO_PAGO = ["pagado", "no pagado"];

// Normalize text for comparison (remove accents, lowercase)
const normalize = (text: string): string => {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
};

// Token classification types
interface ClassifiedTokens {
  categorias: string[];
  empleados: string[];
  eventos: string[];
  estados: string[];
  contingencias: string[];
  recibos: string[];
  recursos: string[];
  procesoPago: string[];
  textoLibre: string[];
}

// Suggestion types for autocomplete
interface Suggestion {
  type: 'contingencia' | 'estado' | 'procesoPago' | 'categoria' | 'empleado' | 'evento' | 'recibo' | 'recursos';
  label: string;
  value: string;
  displayLabel: string;
}

const ReporteCajaMenor = () => {
  const { projects, updateProjectMultiple } = useProjects();
  const { 
    globalDateRange, 
    setGlobalDateRange, 
    globalViewMode, 
    setGlobalViewMode, 
    globalSelectedDate, 
    setGlobalSelectedDate 
  } = useDateRange();

  // Smart search state (single input for all filters)
  const [smartSearch, setSmartSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Image gallery states
  const [selectedImages, setSelectedImages] = useState<Attachment[]>([]);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [loadingImages, setLoadingImages] = useState(false);

  const safeLower = (value?: string | null) => (value ?? "").toLowerCase();

  const safeDate = (value?: string | null) => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  // Backfill createdAt for old Caja Menor items (IDs like: cm1700000000000)
  const inferCajaMenorCreatedAtFromId = (id?: unknown): string | null => {
    if (typeof id !== "string") return null;
    const match = id.match(/^cm(\d{10,})$/);
    if (!match) return null;

    const ms = Number(match[1]);
    if (!Number.isFinite(ms)) return null;

    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return null;

    const min = new Date("2010-01-01T00:00:00.000Z").getTime();
    const max = new Date("2100-01-01T00:00:00.000Z").getTime();
    const t = d.getTime();
    if (t < min || t > max) return null;

    return d.toISOString();
  };

  const formatDateDisplay = (value?: string | null) => {
    const d = safeDate(value);
    return d ? format(d, "dd/MM/yyyy", { locale: es }) : "-";
  };

  const formatDateExport = (value?: string | null) => {
    const d = safeDate(value);
    return d ? format(d, "dd/MM/yyyy", { locale: es }) : "";
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Flatten all caja menor items from all projects
  const allCajaMenorItems = useMemo((): FlattenedCajaMenorItem[] => {
    const items: FlattenedCajaMenorItem[] = [];

    // Filter out deleted projects - they should not appear in reports
    const activeProjects = projects.filter((p: Project) => !p.isDeleted);

    // Sequential counter starting from 100000
    let receiptCounter = 100000;

    activeProjects.forEach((project: Project) => {
      const caja = Array.isArray(project.cajaMenor) ? project.cajaMenor : [];
      if (caja.length === 0) return;

      caja.forEach((item) => {
        // Generate sequential receipt number starting from 100,000
        const reciboNum = String(receiptCounter).padStart(6, "0");
        receiptCounter++;

        const fechaCuentaCobro =
          item.createdAt ||
          inferCajaMenorCreatedAtFromId((item as any).id) ||
          project.createdAt ||
          "";

        items.push({
          ...item,
          eventoId: project.id,
          eventoNombre: project.evento || "Sin nombre",
          recibo: `RCM-${reciboNum}`,
          fecha: fechaCuentaCobro,
        });
      });
    });

    // Sort by date descending (invalid dates go last)
    return items.sort((a, b) => {
      const tb = safeDate(b.fecha)?.getTime() ?? 0;
      const ta = safeDate(a.fecha)?.getTime() ?? 0;
      return tb - ta;
    });
  }, [projects]);

  // Get unique values for classification
  const uniqueEmpleados = useMemo(() => {
    const set = new Set<string>();
    allCajaMenorItems.forEach(item => {
      if (item.empleadoNombre) set.add(normalize(item.empleadoNombre));
    });
    return Array.from(set);
  }, [allCajaMenorItems]);

  const uniqueEventos = useMemo(() => {
    const set = new Set<string>();
    allCajaMenorItems.forEach(item => {
      if (item.eventoNombre) set.add(normalize(item.eventoNombre));
    });
    return Array.from(set);
  }, [allCajaMenorItems]);

  // Get unique empleados with original names for display
  const uniqueEmpleadosDisplay = useMemo(() => {
    const map = new Map<string, string>();
    allCajaMenorItems.forEach(item => {
      if (item.empleadoNombre) {
        map.set(normalize(item.empleadoNombre), item.empleadoNombre);
      }
    });
    return Array.from(map.entries());
  }, [allCajaMenorItems]);

  // Get unique eventos with original names for display
  const uniqueEventosDisplay = useMemo(() => {
    const map = new Map<string, string>();
    allCajaMenorItems.forEach(item => {
      if (item.eventoNombre) {
        map.set(normalize(item.eventoNombre), item.eventoNombre);
      }
    });
    return Array.from(map.entries());
  }, [allCajaMenorItems]);

  // Get unique recibos for suggestions
  const uniqueRecibos = useMemo(() => {
    const set = new Set<string>();
    allCajaMenorItems.forEach(item => {
      if (item.recibo) set.add(item.recibo);
    });
    return Array.from(set);
  }, [allCajaMenorItems]);

  // Get the current token being typed (after last comma)
  const currentToken = useMemo(() => {
    const parts = smartSearch.split(',');
    return parts[parts.length - 1].trim().toLowerCase();
  }, [smartSearch]);

  // Generate autocomplete suggestions based on current input
  const suggestions = useMemo((): Suggestion[] => {
    if (currentToken.length < 2) return [];
    
    const results: Suggestion[] = [];
    const normalizedToken = normalize(currentToken);
    
    // Contingencia suggestions
    if ("contingencia".includes(normalizedToken) || normalizedToken.includes("cont")) {
      results.push(
        { type: 'contingencia', label: 'Contingencia: Sí', value: 'contingencia:si', displayLabel: 'Contingencia: Sí' },
        { type: 'contingencia', label: 'Contingencia: No', value: 'contingencia:no', displayLabel: 'Contingencia: No' }
      );
    }

    // Estado suggestions
    if ("estado".includes(normalizedToken) || normalizedToken.includes("estado")) {
      results.push(
        { type: 'estado', label: 'Estado: Aprobado', value: 'estado:aprobado', displayLabel: 'Estado: Aprobado' },
        { type: 'estado', label: 'Estado: No aprobado', value: 'estado:no aprobado', displayLabel: 'Estado: No aprobado' }
      );
    }

    // Proceso de pago suggestions
    if ("pago".includes(normalizedToken) || "proceso".includes(normalizedToken) || normalizedToken.includes("pago") || normalizedToken.includes("proceso")) {
      results.push(
        { type: 'procesoPago', label: 'Proceso de pago: Pagado', value: 'pago:pagado', displayLabel: 'Proceso de pago: Pagado' },
        { type: 'procesoPago', label: 'Proceso de pago: No pagado', value: 'pago:no pagado', displayLabel: 'Proceso de pago: No pagado' }
      );
    }

    // Categoría suggestions
    if ("categoria".includes(normalizedToken) || "cat".includes(normalizedToken)) {
      KNOWN_CATEGORIAS.filter(c => c !== 'alimentacion').forEach(cat => {
        const displayCat = cat.charAt(0).toUpperCase() + cat.slice(1);
        results.push({ type: 'categoria', label: displayCat, value: cat, displayLabel: `Categoría: ${displayCat}` });
      });
    } else {
      // Also suggest categories that match the token
      KNOWN_CATEGORIAS.filter(c => c !== 'alimentacion').forEach(cat => {
        if (normalize(cat).includes(normalizedToken) || normalizedToken.includes(normalize(cat).slice(0, 3))) {
          const displayCat = cat.charAt(0).toUpperCase() + cat.slice(1);
          if (!results.find(r => r.value === cat)) {
            results.push({ type: 'categoria', label: displayCat, value: cat, displayLabel: `Categoría: ${displayCat}` });
          }
        }
      });
    }

    // Empleado suggestions (show matching employees)
    if ("empleado".includes(normalizedToken) || "emp".includes(normalizedToken)) {
      uniqueEmpleadosDisplay.slice(0, 8).forEach(([_, displayName]) => {
        results.push({ type: 'empleado', label: displayName, value: displayName, displayLabel: `Empleado: ${displayName}` });
      });
    } else {
      // Match against actual employee names
      uniqueEmpleadosDisplay
        .filter(([normalized]) => normalized.includes(normalizedToken))
        .slice(0, 8)
        .forEach(([_, displayName]) => {
          if (!results.find(r => r.type === 'empleado' && r.value === displayName)) {
            results.push({ type: 'empleado', label: displayName, value: displayName, displayLabel: `Empleado: ${displayName}` });
          }
        });
    }

    // Evento suggestions (show matching events)
    if ("evento".includes(normalizedToken) || "ev".includes(normalizedToken)) {
      uniqueEventosDisplay.slice(0, 8).forEach(([_, displayName]) => {
        results.push({ type: 'evento', label: displayName, value: displayName, displayLabel: `Evento: ${displayName}` });
      });
    } else {
      // Match against actual event names
      uniqueEventosDisplay
        .filter(([normalized]) => normalized.includes(normalizedToken))
        .slice(0, 8)
        .forEach(([_, displayName]) => {
          if (!results.find(r => r.type === 'evento' && r.value === displayName)) {
            results.push({ type: 'evento', label: displayName, value: displayName, displayLabel: `Evento: ${displayName}` });
          }
        });
    }

    // Recibo suggestions
    if (normalizedToken.includes("rcm") || /^\d+$/.test(normalizedToken)) {
      uniqueRecibos
        .filter(r => normalize(r).includes(normalizedToken))
        .slice(0, 8)
        .forEach(recibo => {
          results.push({ type: 'recibo', label: recibo, value: recibo, displayLabel: `Recibo: ${recibo}` });
        });
    }

    // Recursos suggestions
    if ("recursos".includes(normalizedToken) || normalizedToken.includes("rec")) {
      KNOWN_RECURSOS.forEach(rec => {
        const displayRec = rec.charAt(0).toUpperCase() + rec.slice(1);
        results.push({ type: 'recursos', label: displayRec, value: rec, displayLabel: `Recursos: ${displayRec}` });
      });
    }

    return results.slice(0, 10); // Limit to 10 suggestions
  }, [currentToken, uniqueEmpleadosDisplay, uniqueEventosDisplay, uniqueRecibos]);

  // Handle suggestion selection
  const handleSelectSuggestion = useCallback((suggestion: Suggestion) => {
    const parts = smartSearch.split(',');
    parts.pop(); // Remove current incomplete token
    const newValue = parts.length > 0 
      ? parts.map(p => p.trim()).join(', ') + ', ' + suggestion.value
      : suggestion.value;
    setSmartSearch(newValue + ', ');
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    inputRef.current?.focus();
  }, [smartSearch]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => 
        prev < suggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => 
        prev > 0 ? prev - 1 : suggestions.length - 1
      );
    } else if (e.key === 'Enter' && selectedSuggestionIndex >= 0) {
      e.preventDefault();
      handleSelectSuggestion(suggestions[selectedSuggestionIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
    }
  }, [showSuggestions, suggestions, selectedSuggestionIndex, handleSelectSuggestion]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current && 
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
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

  // Classify tokens into types
  const classifiedTokens = useMemo((): ClassifiedTokens => {
    const result: ClassifiedTokens = {
      categorias: [],
      empleados: [],
      eventos: [],
      estados: [],
      contingencias: [],
      recibos: [],
      recursos: [],
      procesoPago: [],
      textoLibre: []
    };

    if (!smartSearch.trim()) return result;

    const tokens = smartSearch
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    tokens.forEach(token => {
      const normalized = normalize(token);
      let classified = false;

      // Priority 1: Recibo (RCM-XXXX pattern)
      if (/^rcm-?\d+$/i.test(normalized) || /^\d{4,}$/.test(normalized)) {
        result.recibos.push(token);
        classified = true;
      }
      // Priority 2: Contingencia (format: "contingencia:si" or "contingencia sí")
      else if (normalized.includes("contingencia") || normalized.startsWith("contingencia:")) {
        if (normalized.includes("si") || normalized.includes("sí") || normalized.includes("yes")) {
          result.contingencias.push("Sí");
        } else if (normalized.includes("no")) {
          result.contingencias.push("No");
        }
        classified = true;
      }
      // Priority 3: Proceso de pago (format: "pago:pagado" or "proceso de pago")
      else if (normalized.includes("pago:") || (normalized.includes("pago") && (normalized.includes("pagado") || normalized.includes("no pagado")))) {
        if (normalized.includes("no pagado") || normalized === "pago:no pagado") {
          result.procesoPago.push("No pagado");
        } else if (normalized.includes("pagado")) {
          result.procesoPago.push("Pagado");
        }
        classified = true;
      }
      // Priority 4: Estado (format: "estado:aprobado")
      else if (normalized.includes("estado:") || KNOWN_ESTADOS.some(e => normalized === e || normalized.includes(e))) {
        result.estados.push(token.replace(/estado:/i, '').trim());
        classified = true;
      }
      // Priority 5: Categoría
      else if (KNOWN_CATEGORIAS.some(c => normalize(c) === normalized || normalized.includes(normalize(c)))) {
        result.categorias.push(token);
        classified = true;
      }
      // Priority 6: Recursos
      else if (KNOWN_RECURSOS.some(r => normalize(r) === normalized || normalized.includes(normalize(r)))) {
        result.recursos.push(token);
        classified = true;
      }
      // Priority 7: Empleado (partial match against known employees)
      else if (uniqueEmpleados.some(emp => emp.includes(normalized) || normalized.includes(emp.split(' ')[0]))) {
        result.empleados.push(token);
        classified = true;
      }
      // Priority 8: Evento (partial match against known events)
      else if (uniqueEventos.some(ev => ev.includes(normalized) || normalized.split(' ').some(word => ev.includes(word) && word.length > 3))) {
        result.eventos.push(token);
        classified = true;
      }

      // If not classified, add to texto libre
      if (!classified) {
        result.textoLibre.push(token);
      }
    });

    return result;
  }, [smartSearch, uniqueEmpleados, uniqueEventos]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return Object.values(classifiedTokens).some(arr => arr.length > 0);
  }, [classifiedTokens]);

  // Smart filtering logic with OR within types, AND between types
  const filteredItems = useMemo(() => {
    return allCajaMenorItems.filter((item) => {
      // STEP 1: Date range filter (if defined)
      if (globalDateRange?.from || globalDateRange?.to) {
        const itemDate = safeDate(item.fecha);
        if (!itemDate) return false;

        if (globalDateRange.from && itemDate < startOfDay(globalDateRange.from)) return false;
        if (globalDateRange.to && itemDate > endOfDay(globalDateRange.to)) return false;
      }

      // STEP 2: If no search, return all
      if (!hasActiveFilters) return true;

      const { categorias, empleados, eventos, estados, contingencias, recibos, recursos, procesoPago, textoLibre } = classifiedTokens;

      // Helper to check if any token matches a field (OR logic)
      const matchesAny = (tokens: string[], fieldValue: string | undefined | null): boolean => {
        if (tokens.length === 0) return true; // No filter for this type
        if (!fieldValue) return false;
        const normalizedField = normalize(fieldValue);
        return tokens.some(token => normalizedField.includes(normalize(token)));
      };

      // Check each type (AND between types)
      
      // Categorías (OR)
      if (categorias.length > 0 && !matchesAny(categorias, item.categoria)) return false;

      // Empleados (OR)
      if (empleados.length > 0 && !matchesAny(empleados, item.empleadoNombre)) return false;

      // Eventos (OR)
      if (eventos.length > 0 && !matchesAny(eventos, item.eventoNombre)) return false;

      // Estados (OR)
      if (estados.length > 0 && !matchesAny(estados, item.estado)) return false;

      // Contingencias (OR)
      if (contingencias.length > 0 && !matchesAny(contingencias, item.contingencia || "No")) return false;

      // Recibos (OR)
      if (recibos.length > 0 && !matchesAny(recibos, item.recibo)) return false;

      // Recursos (OR)
      if (recursos.length > 0 && !matchesAny(recursos, item.recursos)) return false;

      // Proceso de pago (OR)
      if (procesoPago.length > 0 && !matchesAny(procesoPago, item.procesoPago || "No pagado")) return false;

      // Texto libre (OR across all fields)
      if (textoLibre.length > 0) {
        const allText = [
          item.recibo,
          item.eventoNombre,
          item.empleadoNombre,
          item.concepto,
          item.categoria,
          item.recursos,
          item.estado,
          item.contingencia,
          item.procesoPago
        ].filter(Boolean).map(v => normalize(v!)).join(' ');

        const matchesTextoLibre = textoLibre.some(token => allText.includes(normalize(token)));
        if (!matchesTextoLibre) return false;
      }

      return true;
    });
  }, [allCajaMenorItems, globalDateRange, classifiedTokens, hasActiveFilters]);

  // Handle proceso pago change
  const handleProcesoPagoChange = useCallback(async (
    eventoId: string,
    itemId: string,
    newValue: 'Pago' | 'No pago'
  ) => {
    const project = projects.find(p => p.id === eventoId);
    if (!project) return;

    const cajaMenor = Array.isArray(project.cajaMenor) ? [...project.cajaMenor] : [];
    const itemIndex = cajaMenor.findIndex(item => item.id === itemId);
    if (itemIndex === -1) return;

    // Update the procesoPago field
    cajaMenor[itemIndex] = {
      ...cajaMenor[itemIndex],
      procesoPago: newValue === 'Pago' ? 'Pagado' : 'No pagado'
    };

    try {
      await updateProjectMultiple(eventoId, { cajaMenor });
      toast.success(`Estado de pago actualizado a "${newValue}"`);
    } catch (error) {
      toast.error("Error al actualizar el estado de pago");
      console.error(error);
    }
  }, [projects, updateProjectMultiple]);

  // Get signed URL for an attachment
  const getSignedUrl = async (attachment: Attachment): Promise<string | null> => {
    // If we already have a direct URL, use it
    if (attachment.url && attachment.url.startsWith('http')) {
      return attachment.url;
    }
    
    // Otherwise, get a signed URL from the edge function
    if (!attachment.filePath || !attachment.bucket) return null;
    
    try {
      const { data, error } = await supabase.functions.invoke("get-signed-url", {
        body: { 
          bucket: attachment.bucket, 
          path: attachment.filePath, 
          expiresIn: 3600 
        },
      });
      
      if (error || !data?.signedUrl) {
        console.error("Error getting signed URL:", error);
        return null;
      }
      return data.signedUrl;
    } catch (err) {
      console.error("Error invoking get-signed-url:", err);
      return null;
    }
  };

  // Handler to open image gallery
  const handleOpenImages = async (imagenes: Attachment[]) => {
    setSelectedImages(imagenes);
    setImageDialogOpen(true);
    setLoadingImages(true);
    setImageUrls({});
    
    // Load all signed URLs
    const urls: Record<string, string> = {};
    for (const img of imagenes) {
      const url = await getSignedUrl(img);
      if (url) urls[img.id] = url;
    }
    setImageUrls(urls);
    setLoadingImages(false);
  };

  // Download image
  const handleDownloadImage = async (url: string, name: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Error downloading image:", err);
      toast.error("Error al descargar la imagen");
    }
  };

  // Export to Excel
  const handleExport = () => {
    const exportData = filteredItems.map((item) => ({
      "# RECIBO": item.recibo,
      FECHA: formatDateExport(item.fecha),
      EMPLEADO: item.empleadoNombre || "",
      EVENTO: item.eventoNombre,
      CONCEPTO: item.concepto || "",
      IMÁGENES: item.imagenes?.length || 0,
      CATEGORÍA: item.categoria || "",
      RECURSOS: item.recursos || "",
      CONTINGENCIA: item.contingencia || "No",
      "VALOR (COP)": item.valor,
      ESTADO: item.estado || "",
      "PROCESO DE PAGO": item.procesoPago === "Pagado" ? "Pagado" : "No pagado",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Gastos de Eventos");

    // Auto-size columns
    const colWidths = [
      { wch: 14 }, // # RECIBO
      { wch: 12 }, // FECHA
      { wch: 25 }, // EMPLEADO
      { wch: 25 }, // EVENTO
      { wch: 30 }, // CONCEPTO
      { wch: 10 }, // IMÁGENES
      { wch: 14 }, // CATEGORÍA
      { wch: 16 }, // RECURSOS
      { wch: 12 }, // CONTINGENCIA
      { wch: 15 }, // VALOR
      { wch: 12 }, // ESTADO
      { wch: 16 }, // PROCESO DE PAGO
    ];
    ws["!cols"] = colWidths;

    XLSX.writeFile(wb, `Reporte_Caja_Menor_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Financial Dashboard with Donut Charts - fixed height */}
      <div className="flex-shrink-0">
        <CajaMenorDashboard items={filteredItems} />
      </div>

      {/* Filters Section - fixed height */}
      <Card className="flex-shrink-0">
        <CardContent className="p-4 space-y-4">
          {/* CalendarFilter - Same as Panel de Operaciones/Directivo */}
          <CalendarFilter
            viewMode={globalViewMode}
            selectedDate={globalSelectedDate}
            dateRange={globalDateRange ? { start: globalDateRange.from!, end: globalDateRange.to } : undefined}
            statusFilter="todos"
            onViewModeChange={setGlobalViewMode}
            onDateChange={setGlobalSelectedDate}
            onDateRangeChange={(range) => {
              range ? setGlobalDateRange({ from: range.start, to: range.end }) : setGlobalDateRange(undefined);
            }}
            onStatusChange={() => {}} // Not used in reports
          />

          {/* Smart Search with Autocomplete */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
              <Input
                ref={inputRef}
                placeholder="Buscar por empleado, evento, categoría, contingencia, estado, proceso de pago... (usa comas)"
                value={smartSearch}
                onChange={(e) => setSmartSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                className="pl-10 h-11"
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
                      className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 transition-colors ${
                        index === selectedSuggestionIndex 
                          ? 'bg-accent text-accent-foreground' 
                          : 'hover:bg-muted'
                      }`}
                    >
                      <Badge 
                        variant="outline" 
                        className={`text-[10px] shrink-0 ${
                          suggestion.type === 'contingencia' ? 'bg-amber-500/10 text-amber-600 border-amber-500/30' :
                          suggestion.type === 'estado' ? 'bg-green-500/10 text-green-600 border-green-500/30' :
                          suggestion.type === 'procesoPago' ? 'bg-rose-500/10 text-rose-600 border-rose-500/30' :
                          suggestion.type === 'categoria' ? 'bg-orange-500/10 text-orange-600 border-orange-500/30' :
                          suggestion.type === 'empleado' ? 'bg-blue-500/10 text-blue-600 border-blue-500/30' :
                          suggestion.type === 'evento' ? 'bg-purple-500/10 text-purple-600 border-purple-500/30' :
                          suggestion.type === 'recibo' ? 'bg-gray-500/10 text-gray-600 border-gray-500/30' :
                          'bg-teal-500/10 text-teal-600 border-teal-500/30'
                        }`}
                      >
                        {suggestion.type === 'contingencia' ? 'Cont.' :
                         suggestion.type === 'estado' ? 'Estado' :
                         suggestion.type === 'procesoPago' ? 'Pago' :
                         suggestion.type === 'categoria' ? 'Cat.' :
                         suggestion.type === 'empleado' ? 'Emp.' :
                         suggestion.type === 'evento' ? 'Evento' :
                         suggestion.type === 'recibo' ? 'Recibo' : 'Rec.'}
                      </Badge>
                      <span className="truncate">{suggestion.displayLabel}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Filter Summary - Shows detected filter groups */}
            {hasActiveFilters && (
              <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg border border-border/50">
                {classifiedTokens.empleados.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Empleados:</span>
                    {classifiedTokens.empleados.map((emp, i) => (
                      <Badge key={i} variant="secondary" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/20">
                        {emp}
                      </Badge>
                    ))}
                  </div>
                )}
                {classifiedTokens.eventos.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Eventos:</span>
                    {classifiedTokens.eventos.map((ev, i) => (
                      <Badge key={i} variant="secondary" className="text-xs bg-purple-500/10 text-purple-600 border-purple-500/20">
                        {ev}
                      </Badge>
                    ))}
                  </div>
                )}
                {classifiedTokens.categorias.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Categorías:</span>
                    {classifiedTokens.categorias.map((cat, i) => (
                      <Badge key={i} variant="secondary" className="text-xs bg-orange-500/10 text-orange-600 border-orange-500/20">
                        {cat}
                      </Badge>
                    ))}
                  </div>
                )}
                {classifiedTokens.estados.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Estados:</span>
                    {classifiedTokens.estados.map((est, i) => (
                      <Badge key={i} variant="secondary" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
                        {est}
                      </Badge>
                    ))}
                  </div>
                )}
                {classifiedTokens.contingencias.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Contingencia:</span>
                    {classifiedTokens.contingencias.map((cont, i) => (
                      <Badge key={i} variant="secondary" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/20">
                        {cont}
                      </Badge>
                    ))}
                  </div>
                )}
                {classifiedTokens.procesoPago.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Proceso de pago:</span>
                    {classifiedTokens.procesoPago.map((pago, i) => (
                      <Badge key={i} variant="secondary" className="text-xs bg-rose-500/10 text-rose-600 border-rose-500/20">
                        {pago}
                      </Badge>
                    ))}
                  </div>
                )}
                {classifiedTokens.recursos.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Recursos:</span>
                    {classifiedTokens.recursos.map((rec, i) => (
                      <Badge key={i} variant="secondary" className="text-xs bg-teal-500/10 text-teal-600 border-teal-500/20">
                        {rec}
                      </Badge>
                    ))}
                  </div>
                )}
                {classifiedTokens.recibos.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Recibos:</span>
                    {classifiedTokens.recibos.map((rec, i) => (
                      <Badge key={i} variant="secondary" className="text-xs bg-gray-500/10 text-gray-600 border-gray-500/20">
                        {rec}
                      </Badge>
                    ))}
                  </div>
                )}
                {classifiedTokens.textoLibre.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Búsqueda:</span>
                    {classifiedTokens.textoLibre.map((txt, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {txt}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Export Button */}
          <div className="flex justify-end">
            <Button onClick={handleExport} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Exportar Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Table - viewport with internal dual scroll (scroll occurs HERE) */}
      <Card className="flex-shrink-0">
        <CardContent className="p-0">
          {/* RED BOX viewport: height clamp ensures min 360px, adapts to screen, max 600px */}
          <div 
            className="reportes-scroll-container"
            style={{ 
              width: '100%',
              maxWidth: '100%',
              height: 'clamp(360px, calc(100dvh - 320px), 600px)',
              overflowX: 'auto',
              overflowY: 'auto'
            }}
          >
            <table className="w-full min-w-[1400px] caption-bottom text-sm reportes-table">
              <thead className="[&_tr]:border-b">
                <tr className="bg-[hsl(var(--table-header))] border-b transition-colors">
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap"># RECIBO</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">FECHA</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">EMPLEADO</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">EVENTO</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">CONCEPTO</th>
                  <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground whitespace-nowrap">IMÁGENES</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">CATEGORÍA</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">RECURSOS</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">CONTINGENCIA</th>
                  <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground whitespace-nowrap">VALOR (COP)</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">ESTADO</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap">PROCESO DE PAGO</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {filteredItems.length === 0 ? (
                  <tr className="border-b transition-colors hover:bg-muted/50">
                    <td colSpan={12} className="p-4 align-middle text-center py-8 text-muted-foreground">
                      No hay registros de gastos de eventos
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={`${item.eventoId}-${item.id}`} className="border-b transition-colors hover:bg-muted/50">
                      {/* # RECIBO */}
                      <td className="p-4 align-middle whitespace-nowrap font-mono text-xs">{item.recibo}</td>
                      {/* FECHA */}
                      <td className="p-4 align-middle whitespace-nowrap">{formatDateDisplay(item.fecha)}</td>
                      {/* EMPLEADO */}
                      <td className="p-4 align-middle max-w-[150px] truncate">{item.empleadoNombre || "-"}</td>
                      {/* EVENTO */}
                      <td className="p-4 align-middle max-w-[200px]">
                        <EventLink
                          eventId={item.eventoId}
                          eventName={item.eventoNombre}
                          variant="text"
                          source="reportes"
                        />
                      </td>
                      {/* CONCEPTO */}
                      <td className="p-4 align-middle max-w-[200px] truncate">{item.concepto || "-"}</td>
                      {/* IMÁGENES */}
                      <td className="p-4 align-middle text-center">
                        {item.imagenes && item.imagenes.length > 0 ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 h-7 px-2"
                            onClick={() => handleOpenImages(item.imagenes!)}
                          >
                            <ImageIcon className="h-3 w-3" />
                            {item.imagenes.length}
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      {/* CATEGORÍA */}
                      <td className="p-4 align-middle">
                        <Badge
                          variant="outline"
                          className={
                            item.categoria === "Transporte"
                              ? "border-blue-500/50 text-blue-500"
                              : item.categoria === "Alimentación"
                                ? "border-orange-500/50 text-orange-500"
                                : "border-purple-500/50 text-purple-500"
                          }
                        >
                          {item.categoria || "-"}
                        </Badge>
                      </td>
                      {/* RECURSOS */}
                      <td className="p-4 align-middle">
                        <Badge variant="secondary" className="text-xs">
                          {item.recursos || "-"}
                        </Badge>
                      </td>
                      {/* CONTINGENCIA */}
                      <td className="p-4 align-middle">
                        {item.contingencia === "Sí" ? (
                          <Badge
                            variant="destructive"
                            className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/20"
                          >
                            Sí
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">No</span>
                        )}
                      </td>
                      {/* VALOR (COP) */}
                      <td className="p-4 align-middle text-right font-medium whitespace-nowrap">
                        {formatCurrency(Number(item.valor || 0))}
                      </td>
                      {/* ESTADO */}
                      <td className="p-4 align-middle">
                        <Badge
                          variant={item.estado === "Aprobado" ? "default" : "destructive"}
                          className={
                            item.estado === "Aprobado"
                              ? "bg-green-500/10 text-green-500 hover:bg-green-500/20"
                              : "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                          }
                        >
                          {item.estado || "-"}
                        </Badge>
                      </td>
                      {/* PROCESO DE PAGO - Dropdown editable */}
                      <td className="p-4 align-middle">
                        <Select
                          value={item.procesoPago === "Pagado" ? "Pago" : "No pago"}
                          onValueChange={(value: 'Pago' | 'No pago') => handleProcesoPagoChange(item.eventoId, item.id, value)}
                        >
                          <SelectTrigger 
                            className={`h-8 w-[120px] text-xs font-medium border-2 ${
                              item.procesoPago === "Pagado"
                                ? "bg-green-500/20 border-green-500 text-green-600 dark:text-green-400"
                                : "bg-red-500/20 border-red-500 text-red-600 dark:text-red-400"
                            }`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Pago" className="text-green-600 dark:text-green-400 font-medium">
                              Pago
                            </SelectItem>
                            <SelectItem value="No pago" className="text-red-600 dark:text-red-400 font-medium">
                              No pago
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
        
        {/* Results count - always visible at bottom outside scroll */}
        <div className="px-4 py-2 border-t text-sm text-muted-foreground bg-card">
          Mostrando {filteredItems.length} de {allCajaMenorItems.length} registros
        </div>
      </Card>

      {/* Image Gallery Dialog */}
      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Imágenes del registro ({selectedImages.length})
            </DialogTitle>
          </DialogHeader>
          
          {loadingImages ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="mt-3 text-muted-foreground">Cargando imágenes...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-4">
              {selectedImages.map((img) => {
                const url = imageUrls[img.id];
                return (
                  <div 
                    key={img.id} 
                    className="relative group rounded-lg overflow-hidden border bg-muted/30"
                  >
                    {url ? (
                      <>
                        <img
                          src={url}
                          alt={img.name}
                          className="w-full h-40 object-cover transition-transform group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Button 
                            size="icon" 
                            variant="secondary" 
                            className="h-9 w-9"
                            onClick={() => window.open(url, "_blank")}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="secondary" 
                            className="h-9 w-9"
                            onClick={() => handleDownloadImage(url, img.name)}
                          >
                            <DownloadIcon className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2 truncate">
                          {img.name}
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-40 flex items-center justify-center text-muted-foreground">
                        <span className="text-sm">Error al cargar</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReporteCajaMenor;
