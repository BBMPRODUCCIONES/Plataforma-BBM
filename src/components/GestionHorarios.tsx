import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useHorarios, Horario } from '@/contexts/HorariosContext';
import { useEmpleados } from '@/contexts/EmpleadosContext';
import { useProjects } from '@/contexts/ProjectsContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { Search, Plus, CalendarIcon, Pencil, Trash2, ChevronLeft, ChevronRight, User, AlertCircle, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';
import { Project, PersonalItem } from '@/types';
import { EmpleadoAutocomplete } from '@/components/EmpleadoAutocomplete';
import { HorarioFormDialog } from '@/components/HorarioFormDialog';
import { DateRange } from 'react-day-picker';

type ViewMode = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  day: 'Día',
  week: 'Semana',
  month: 'Mes',
  quarter: 'Trimestre',
  year: 'Año',
  custom: 'Rango'
};

interface EventoAsignado {
  projectId: string;
  evento: string;
  cargo: string;
  fechaMontajeInicio: string;
  fechaMontajeFin: string;
  fechaEjecucionInicio: string;
  fechaEjecucionFin: string;
  tipoPersonal: string;
}

export const GestionHorarios = () => {
  const { horarios, loading, deleteHorario, refetch } = useHorarios();
  const { empleados } = useEmpleados();
  const { projects } = useProjects();
  
  // Filters
  const [selectedEmpleadoId, setSelectedEmpleadoId] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date } | undefined>();
  const [tempRange, setTempRange] = useState<DateRange | undefined>();
  const [isRangePopoverOpen, setIsRangePopoverOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingHorario, setEditingHorario] = useState<Horario | null>(null);

  // Force refetch on mount and when component becomes visible
  useEffect(() => {
    console.log('[GestionHorarios] Component mounted, forcing refetch...');
    refetch();
  }, [refetch]);

  // Log horarios state changes
  useEffect(() => {
    console.log('[GestionHorarios] Horarios updated:', horarios.length, 'records');
    if (horarios.length > 0) {
      console.log('[GestionHorarios] Sample horario:', horarios[0]);
    }
  }, [horarios]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    console.log('[GestionHorarios] Manual refresh triggered');
    await refetch();
    setIsRefreshing(false);
    toast.success('Datos actualizados');
  };

  // Get date range based on view mode
  const getDateRange = useCallback((): { start: Date; end: Date } | null => {
    if (viewMode === 'custom' && dateRange) {
      return { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to) };
    }
    
    switch (viewMode) {
      case 'day':
        return { start: startOfDay(selectedDate), end: endOfDay(selectedDate) };
      case 'week':
        return { start: startOfWeek(selectedDate, { locale: es }), end: endOfWeek(selectedDate, { locale: es }) };
      case 'month':
        return { start: startOfMonth(selectedDate), end: endOfMonth(selectedDate) };
      case 'quarter':
        return { start: startOfQuarter(selectedDate), end: endOfQuarter(selectedDate) };
      case 'year':
        return { start: startOfYear(selectedDate), end: endOfYear(selectedDate) };
      default:
        return null;
    }
  }, [viewMode, dateRange, selectedDate]);

  // Get eventos asignados for selected employee from Panel Operativo
  const eventosAsignados = useMemo((): EventoAsignado[] => {
    if (!selectedEmpleadoId) return [];
    
    const range = getDateRange();
    const eventos: EventoAsignado[] = [];

    projects.forEach(project => {
      const personal = project.personal as PersonalItem[] | undefined;
      if (!personal || !Array.isArray(personal)) return;

      // Find if employee is assigned to this project
      const empleadoAsignacion = personal.find(p => p.empleadoId === selectedEmpleadoId);
      if (!empleadoAsignacion) return;

      // Check if project falls within date range
      if (range) {
        const montajeInicio = project.fechaMontajeInicio ? parseISO(project.fechaMontajeInicio) : null;
        const montajeFin = project.fechaMontajeFin ? parseISO(project.fechaMontajeFin) : null;
        const ejecucionInicio = project.fechaEjecucionInicio ? parseISO(project.fechaEjecucionInicio) : null;
        const ejecucionFin = project.fechaEjecucionFin ? parseISO(project.fechaEjecucionFin) : null;

        const enMontaje = montajeInicio && montajeFin && (
          isWithinInterval(montajeInicio, { start: range.start, end: range.end }) ||
          isWithinInterval(montajeFin, { start: range.start, end: range.end }) ||
          isWithinInterval(range.start, { start: montajeInicio, end: montajeFin })
        );

        const enEjecucion = ejecucionInicio && ejecucionFin && (
          isWithinInterval(ejecucionInicio, { start: range.start, end: range.end }) ||
          isWithinInterval(ejecucionFin, { start: range.start, end: range.end }) ||
          isWithinInterval(range.start, { start: ejecucionInicio, end: ejecucionFin })
        );

        if (!enMontaje && !enEjecucion) return;
      }

      eventos.push({
        projectId: project.id,
        evento: project.evento,
        cargo: empleadoAsignacion.cargo || '',
        fechaMontajeInicio: project.fechaMontajeInicio,
        fechaMontajeFin: project.fechaMontajeFin,
        fechaEjecucionInicio: project.fechaEjecucionInicio,
        fechaEjecucionFin: project.fechaEjecucionFin,
        tipoPersonal: empleadoAsignacion.tipoPersonal || 'BBM'
      });
    });

    return eventos;
  }, [selectedEmpleadoId, projects, getDateRange]);

  // Grouped horarios - one row per day (grouped by empleado_id + fecha)
  interface GroupedHorario {
    id: string; // Use first horario id for the group
    empleado_id: string;
    dia: string;
    displayNombre: string;
    displayCargo: string;
    displayCategoria: string; // Combined: "Oficina + EVENTO1 + EVENTO2"
    llegada: string;
    ubicacion_llegada: string;
    salida: string;
    ubicacion_salida: string;
    // New: Salida de contingencia
    salidaEmergencia?: {
      hora: string;
      ubicacion: string;
      maps_url?: string;
    };
    // For expand functionality
    eventos: string[];
    hasOficina: boolean;
    originalHorarios: Horario[];
    empleado_deleted?: boolean;
  }

  // Filter horarios by selected employee and date range, then GROUP BY DAY
  const filteredHorarios = useMemo((): GroupedHorario[] => {
    console.log('[GestionHorarios] === FILTERING HORARIOS ===');
    console.log('[GestionHorarios] Total horarios from context:', horarios.length);
    console.log('[GestionHorarios] Selected empleado ID:', selectedEmpleadoId);
    
    if (horarios.length > 0) {
      console.log('[GestionHorarios] Sample horarios empleado_ids:', horarios.slice(0, 5).map(h => ({
        id: h.id,
        empleado_id: h.empleado_id,
        dia: h.dia,
        categoria: h.categoria,
        evento_nombre: h.evento_nombre
      })));
    }
    
    let filtered = [...horarios];

    // Filter by selected employee (if one is selected)
    if (selectedEmpleadoId) {
      filtered = filtered.filter(h => {
        const match = h.empleado_id === selectedEmpleadoId;
        if (!match && h.empleado_id) {
          console.log('[GestionHorarios] ID mismatch:', h.empleado_id, 'vs', selectedEmpleadoId);
        }
        return match;
      });
      console.log('[GestionHorarios] After employee filter:', filtered.length, 'records');
    }

    // Filter by date range
    const range = getDateRange();
    if (range) {
      console.log('[GestionHorarios] Date range:', format(range.start, 'yyyy-MM-dd'), 'to', format(range.end, 'yyyy-MM-dd'));
      filtered = filtered.filter(h => {
        try {
          const horarioDate = parseISO(h.dia);
          const inRange = isWithinInterval(horarioDate, { start: range.start, end: range.end });
          return inRange;
        } catch (e) {
          console.error('[GestionHorarios] Date parse error for:', h.dia, e);
          return false;
        }
      });
      console.log('[GestionHorarios] After date filter:', filtered.length, 'records');
    }

    // GROUP BY employee_id + dia (1 row per day)
    const grouped = new Map<string, GroupedHorario>();
    
    filtered.forEach(horario => {
      const key = `${horario.empleado_id}-${horario.dia}`;
      
      // Get employee data
      const empleado = empleados.find(e => e.id === horario.empleado_id);
      const displayNombre = empleado?.nombre || horario.empleado_nombre || '-';
      const displayCargo = empleado?.cargo || horario.cargo || '-';
      
      // Parse evento_nombre for events
      const eventoNombre = horario.evento_nombre || '';
      const parts = eventoNombre.split(' + ').map(p => p.trim()).filter(Boolean);
      
      // Check for oficina
      const categoria = horario.categoria || '';
      const hasOficina = categoria.toLowerCase() === 'oficina' || parts.some(p => p.toLowerCase() === 'oficina');
      const eventParts = parts.filter(p => p.toLowerCase() !== 'oficina');
      
      if (grouped.has(key)) {
        // Merge with existing group
        const existing = grouped.get(key)!;
        
        // Add new events
        eventParts.forEach(event => {
          if (!existing.eventos.includes(event)) {
            existing.eventos.push(event);
          }
        });
        
        // Update oficina flag
        if (hasOficina) {
          existing.hasOficina = true;
        }
        
        // Keep earliest llegada and latest salida
        if (horario.llegada && (!existing.llegada || horario.llegada < existing.llegada)) {
          existing.llegada = horario.llegada;
          existing.ubicacion_llegada = horario.ubicacion_llegada;
        }
        if (horario.salida && (!existing.salida || horario.salida > existing.salida)) {
          existing.salida = horario.salida;
          existing.ubicacion_salida = horario.ubicacion_salida;
        }
        
        // Merge contingency data if exists
        if (horario.contingencia_hora && !existing.salidaEmergencia) {
          existing.salidaEmergencia = {
            hora: horario.contingencia_hora,
            ubicacion: horario.contingencia_ubicacion || '',
            maps_url: horario.contingencia_maps_url || '',
          };
        }
        
        // Store original horarios for expansion
        existing.originalHorarios.push(horario);
        
      } else {
        // Create new group
        // Check for contingency data in this horario
        const salidaEmergenciaData = horario.contingencia_hora ? {
          hora: horario.contingencia_hora,
          ubicacion: horario.contingencia_ubicacion || '',
          maps_url: horario.contingencia_maps_url || '',
        } : undefined;
        
        grouped.set(key, {
          id: horario.id,
          empleado_id: horario.empleado_id || '',
          dia: horario.dia,
          displayNombre,
          displayCargo,
          displayCategoria: '', // Will be computed below
          llegada: horario.llegada || '',
          ubicacion_llegada: horario.ubicacion_llegada || '',
          salida: horario.salida || '',
          ubicacion_salida: horario.ubicacion_salida || '',
          salidaEmergencia: salidaEmergenciaData,
          eventos: eventParts,
          hasOficina,
          originalHorarios: [horario],
          empleado_deleted: horario.empleado_deleted || false,
        });
      }
    });

    // Now compute displayCategoria for each group (including contingency context)
    const result: GroupedHorario[] = [];
    grouped.forEach(group => {
      // Build category display: "Oficina + EVENTO1 + EVENTO2 + [contingencia context]"
      const parts: string[] = [];
      if (group.hasOficina) {
        parts.push('Oficina');
      }
      parts.push(...group.eventos);
      
      // Include contingency context if exists
      group.originalHorarios.forEach(horario => {
        if (horario.contingencia_contexto) {
          let contexto: { oficina?: boolean; casa?: boolean; eventos?: string[] } | null = null;
          
          // Parse contingencia_contexto
          if (typeof horario.contingencia_contexto === 'string') {
            try {
              contexto = JSON.parse(horario.contingencia_contexto);
            } catch (e) {
              console.error('[GestionHorarios] Error parsing contingencia_contexto:', e);
            }
          } else if (typeof horario.contingencia_contexto === 'object') {
            contexto = horario.contingencia_contexto as { oficina?: boolean; casa?: boolean; eventos?: string[] };
          }
          
          if (contexto) {
            // Add contingency Casa if not already present
            if (contexto.casa && !parts.some(p => p.toLowerCase() === 'casa')) {
              parts.push('Casa');
            }
            // Add contingency Oficina if not already present
            if (contexto.oficina && !parts.some(p => p.toLowerCase() === 'oficina')) {
              parts.push('Oficina');
            }
            // Add contingency eventos if not already present
            if (contexto.eventos && Array.isArray(contexto.eventos)) {
              contexto.eventos.forEach((eventoId: string) => {
                // Find project name from ID
                const project = projects.find(p => p.id === eventoId);
                const eventoNombre = project?.evento || eventoId;
                if (!parts.some(p => p.toLowerCase() === eventoNombre.toLowerCase())) {
                  parts.push(eventoNombre);
                }
              });
            }
          }
        }
      });
      
      group.displayCategoria = parts.length > 0 ? parts.join(' + ') : '-';
      result.push(group);
    });

    // Sort by date descending
    result.sort((a, b) => b.dia.localeCompare(a.dia));

    console.log('[GestionHorarios] Final grouped rows:', result.length);
    return result;
  }, [horarios, selectedEmpleadoId, getDateRange, empleados]);

  const handleEdit = (horario: Horario) => {
    setEditingHorario(horario);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Está seguro de eliminar este horario?')) {
      await deleteHorario(id);
    }
  };

  const handleEmpleadoChange = (_nombre: string, empleadoId?: string) => {
    setSelectedEmpleadoId(empleadoId || '');
  };

  const navigatePrevious = () => {
    const newDate = new Date(selectedDate);
    switch (viewMode) {
      case 'day': newDate.setDate(newDate.getDate() - 1); break;
      case 'week': newDate.setDate(newDate.getDate() - 7); break;
      case 'month': newDate.setMonth(newDate.getMonth() - 1); break;
      case 'quarter': newDate.setMonth(newDate.getMonth() - 3); break;
      case 'year': newDate.setFullYear(newDate.getFullYear() - 1); break;
    }
    setSelectedDate(newDate);
  };

  const navigateNext = () => {
    const newDate = new Date(selectedDate);
    switch (viewMode) {
      case 'day': newDate.setDate(newDate.getDate() + 1); break;
      case 'week': newDate.setDate(newDate.getDate() + 7); break;
      case 'month': newDate.setMonth(newDate.getMonth() + 1); break;
      case 'quarter': newDate.setMonth(newDate.getMonth() + 3); break;
      case 'year': newDate.setFullYear(newDate.getFullYear() + 1); break;
    }
    setSelectedDate(newDate);
  };

  const getDateLabel = () => {
    switch (viewMode) {
      case 'day': return format(selectedDate, "d 'de' MMMM yyyy", { locale: es });
      case 'week': 
        const weekStart = startOfWeek(selectedDate, { locale: es });
        const weekEnd = endOfWeek(selectedDate, { locale: es });
        return `${format(weekStart, 'd MMM', { locale: es })} - ${format(weekEnd, 'd MMM yyyy', { locale: es })}`;
      case 'month': return format(selectedDate, 'MMMM yyyy', { locale: es });
      case 'quarter': return `Q${Math.floor(selectedDate.getMonth() / 3) + 1} ${selectedDate.getFullYear()}`;
      case 'year': return selectedDate.getFullYear().toString();
      case 'custom':
        if (dateRange) {
          return `${format(dateRange.from, 'd MMM', { locale: es })} - ${format(dateRange.to, 'd MMM yyyy', { locale: es })}`;
        }
        return 'Seleccionar rango';
    }
  };

  const selectedEmpleado = empleados.find(e => e.id === selectedEmpleadoId);

  if (loading) {
    return <div className="flex items-center justify-center p-8">Cargando horarios...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Employee Selection - Main Filter */}
      <div className="bg-card/50 p-4 rounded-lg border border-border/50">
        <div className="flex items-center gap-4">
          <div className="flex-1 max-w-md">
            <Label className="text-xs text-muted-foreground mb-1 block">SELECCIONAR EMPLEADO</Label>
            <EmpleadoAutocomplete
              value={selectedEmpleadoId}
              onChange={handleEmpleadoChange}
              useEmpleadoId={true}
              placeholder="Buscar empleado por nombre..."
            />
          </div>
          
          {selectedEmpleado && (
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{selectedEmpleado.nombre}</span>
              <span className="text-muted-foreground">({selectedEmpleado.cargo})</span>
            </div>
          )}
        </div>
      </div>

      {/* Date filter bar */}
      <div className="flex items-center gap-2 flex-wrap bg-card/50 p-2 rounded-lg border border-border/50">
        {/* View mode tabs */}
        <div className="flex bg-muted/50 rounded-md p-0.5">
          {(['day', 'week', 'month', 'quarter', 'year'] as ViewMode[]).map((mode) => (
            <Button
              key={mode}
              variant={viewMode === mode ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => setViewMode(mode)}
            >
              {VIEW_MODE_LABELS[mode]}
            </Button>
          ))}
        </div>

        {/* Custom range button */}
        <Popover open={isRangePopoverOpen} onOpenChange={setIsRangePopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={viewMode === 'custom' ? 'secondary' : 'outline'}
              size="sm"
              className="h-7 px-3 text-xs gap-1"
              onClick={() => {
                setTempRange(dateRange ? { from: dateRange.from, to: dateRange.to } : undefined);
                setIsRangePopoverOpen(true);
              }}
            >
              <CalendarIcon className="h-3 w-3" />
              {viewMode === 'custom' && dateRange ? (
                <span>{format(dateRange.from, 'd MMM', { locale: es })} - {format(dateRange.to, 'd MMM', { locale: es })}</span>
              ) : (
                'Rango'
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-auto p-0 z-[100] bg-popover border border-border shadow-lg" 
            align="start"
            sideOffset={4}
            onInteractOutside={(e) => {
              // Prevent closing when clicking inside the calendar
              e.preventDefault();
            }}
          >
            <div className="p-3 space-y-3">
              <Calendar
                mode="range"
                selected={tempRange}
                onSelect={(range) => {
                  setTempRange(range);
                }}
                locale={es}
                numberOfMonths={1}
                className="pointer-events-auto"
              />
              
              {/* Range status indicator */}
              <div className="text-xs text-muted-foreground text-center border-t border-border pt-2">
                {!tempRange?.from && 'Selecciona fecha inicio'}
                {tempRange?.from && !tempRange?.to && (
                  <span className="text-primary font-medium">
                    Inicio: {format(tempRange.from, 'd MMM yyyy', { locale: es })} — Selecciona fecha fin
                  </span>
                )}
                {tempRange?.from && tempRange?.to && (
                  <span className="text-green-600 font-medium">
                    {format(tempRange.from, 'd MMM', { locale: es })} — {format(tempRange.to, 'd MMM yyyy', { locale: es })}
                  </span>
                )}
              </div>
              
              {/* Action buttons */}
              <div className="flex gap-2 pt-2 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  onClick={() => {
                    setTempRange(undefined);
                    setDateRange(undefined);
                    setViewMode('month');
                    setIsRangePopoverOpen(false);
                  }}
                >
                  <X className="h-3 w-3 mr-1" />
                  Limpiar
                </Button>
                <Button
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  disabled={!tempRange?.from || !tempRange?.to}
                  onClick={() => {
                    if (tempRange?.from && tempRange?.to) {
                      // Ensure from <= to (swap if needed)
                      const from = tempRange.from <= tempRange.to ? tempRange.from : tempRange.to;
                      const to = tempRange.from <= tempRange.to ? tempRange.to : tempRange.from;
                      setDateRange({ from, to });
                      setViewMode('custom');
                      setIsRangePopoverOpen(false);
                      toast.success(`Rango aplicado: ${format(from, 'd MMM', { locale: es })} - ${format(to, 'd MMM yyyy', { locale: es })}`);
                    }
                  }}
                >
                  Aplicar
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
        
        {/* Clear range button (visible when custom range is active) */}
        {viewMode === 'custom' && dateRange && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
            onClick={() => {
              setDateRange(undefined);
              setTempRange(undefined);
              setViewMode('month');
              toast.info('Rango eliminado');
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        )}

        {/* Navigation */}
        <div className="flex items-center gap-1 ml-auto">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={navigatePrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 px-3 text-xs gap-1 min-w-[150px]">
                <CalendarIcon className="h-3 w-3" />
                {getDateLabel()}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                locale={es}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={navigateNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-7 px-3 text-xs" onClick={() => setSelectedDate(new Date())}>
            Hoy
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            className="h-7 w-7" 
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            title="Refrescar datos"
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </Button>
        </div>

        {/* Add button */}
        <HorarioFormDialog 
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) setEditingHorario(null);
          }}
          defaultEmpleadoId={selectedEmpleadoId}
          mode="admin"
        >
          <Button size="sm" className="h-7 px-3 text-xs gap-1">
            <Plus className="h-3 w-3" />
            Registrar Horario
          </Button>
        </HorarioFormDialog>
      </div>

      {/* Eventos Asignados Section - Solo informativo, NO bloquea historial */}
      {selectedEmpleadoId && eventosAsignados.length > 0 && (
        <details className="bg-card/30 p-4 rounded-lg border border-border/30">
          <summary className="text-sm font-semibold cursor-pointer text-foreground flex items-center gap-2">
            <span>EVENTOS ASIGNADOS EN PANEL OPERATIVO</span>
            <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded">
              {eventosAsignados.length} evento{eventosAsignados.length !== 1 ? 's' : ''}
            </span>
            <span className="text-xs text-muted-foreground ml-auto">(clic para expandir)</span>
          </summary>
          
          <div className="grid gap-2 mt-3">
            {eventosAsignados.map((evento) => (
              <div 
                key={evento.projectId}
                className="flex items-center justify-between p-3 bg-muted/30 rounded-md border border-border/30"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-sm">{evento.evento}</span>
                  <span className="text-xs px-2 py-0.5 bg-primary/20 text-primary rounded">
                    {evento.cargo || 'Sin cargo'}
                  </span>
                  <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                    {evento.tipoPersonal}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {evento.fechaMontajeInicio && (
                    <span className="mr-3">
                      Montaje: {format(parseISO(evento.fechaMontajeInicio), 'dd/MM')} - {format(parseISO(evento.fechaMontajeFin), 'dd/MM')}
                    </span>
                  )}
                  {evento.fechaEjecucionInicio && (
                    <span>
                      Ejecución: {format(parseISO(evento.fechaEjecucionInicio), 'dd/MM')} - {format(parseISO(evento.fechaEjecucionFin), 'dd/MM')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Historial de Horarios - Independiente de eventos asignados */}
      <div className="border rounded-lg overflow-hidden">
        <h3 className="text-sm font-semibold p-3 bg-muted/30 border-b border-border/50">
          HISTORIAL DE REGISTROS DE HORARIOS (1 fila por día)
        </h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">CARGO</TableHead>
                <TableHead className="font-semibold">NOMBRE</TableHead>
                <TableHead className="font-semibold">DÍA</TableHead>
                <TableHead className="font-semibold min-w-[200px]">CATEGORÍA</TableHead>
                <TableHead className="font-semibold text-center">LLEGADA</TableHead>
                <TableHead className="font-semibold text-center">UBICACIÓN</TableHead>
                <TableHead className="font-semibold text-center">SALIDA</TableHead>
                <TableHead className="font-semibold text-center">UBICACIÓN</TableHead>
                <TableHead className="font-semibold text-center min-w-[140px]">SALIDA EMERGENCIA</TableHead>
                <TableHead className="font-semibold w-20">ACCIONES</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!selectedEmpleadoId ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    Seleccione un empleado para ver sus horarios registrados
                  </TableCell>
                </TableRow>
              ) : filteredHorarios.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    No hay registros de horarios para este empleado en el rango seleccionado
                  </TableCell>
                </TableRow>
              ) : (
                filteredHorarios.map((horario, index) => {
                  // Parse ubicación to create clickable Google Maps link
                  const renderUbicacion = (ubicacion: string) => {
                    if (!ubicacion || ubicacion === '-') return <span className="text-muted-foreground text-xs">—</span>;
                    
                    // Check if it's coordinates (lat, lng format)
                    const coordsMatch = ubicacion.match(/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
                    if (coordsMatch) {
                      const lat = coordsMatch[1];
                      const lng = coordsMatch[2];
                      const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
                      return (
                        <a 
                          href={mapsUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:underline text-xs flex items-center gap-1"
                        >
                          Ver en Maps
                        </a>
                      );
                    }
                    
                    // Check if it already contains a maps link
                    if (ubicacion.includes('google.com/maps') || ubicacion.startsWith('http')) {
                      return (
                        <a 
                          href={ubicacion} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:underline text-xs"
                        >
                          Ver en Maps
                        </a>
                      );
                    }
                    
                    // Check for "Ubicación no disponible"
                    if (ubicacion.toLowerCase().includes('no disponible')) {
                      return <span className="text-muted-foreground text-xs">No disponible</span>;
                    }
                    
                    return <span className="text-xs">{ubicacion}</span>;
                  };

                  // Determine category badge color based on content
                  const getCategoryStyles = (categoria: string) => {
                    const hasOficina = categoria.toLowerCase().includes('oficina');
                    const hasEvents = categoria.split('+').filter(p => !p.toLowerCase().includes('oficina')).length > 0;
                    
                    if (hasOficina && hasEvents) {
                      return "bg-purple-500/20 text-purple-400";
                    } else if (hasOficina) {
                      return "bg-blue-500/20 text-blue-400";
                    }
                    return "bg-green-500/20 text-green-400";
                  };

                  // Render category as tags/pills
                  const renderCategoria = (categoria: string) => {
                    const parts = categoria.split(' + ').map(p => p.trim()).filter(Boolean);
                    if (parts.length === 0) return <span className="text-muted-foreground">—</span>;
                    
                    return (
                      <div className="flex flex-wrap gap-1">
                        {parts.map((part, i) => {
                          const isOficina = part.toLowerCase() === 'oficina';
                          return (
                            <span
                              key={i}
                              className={cn(
                                "px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap",
                                isOficina ? "bg-blue-500/20 text-blue-400" : "bg-green-500/20 text-green-400"
                              )}
                            >
                              {part}
                            </span>
                          );
                        })}
                      </div>
                    );
                  };

                  // Handle edit - use first original horario
                  const handleEditGroup = () => {
                    if (horario.originalHorarios.length > 0) {
                      handleEdit(horario.originalHorarios[0]);
                    }
                  };

                  // Handle delete - delete all horarios in the group
                  const handleDeleteGroup = async () => {
                    if (confirm(`¿Está seguro de eliminar todos los registros del día ${format(parseISO(horario.dia), 'dd/MM/yyyy')}?`)) {
                      for (const h of horario.originalHorarios) {
                        await deleteHorario(h.id);
                      }
                    }
                  };

                  return (
                    <TableRow key={`${horario.id}-${index}`} className={horario.empleado_deleted ? "bg-red-500/5" : ""}>
                      <TableCell className={horario.empleado_deleted ? "text-red-500" : ""}>{horario.displayCargo}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={horario.empleado_deleted ? "text-red-500 font-medium" : ""}>{horario.displayNombre}</span>
                          {horario.empleado_deleted && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-500/20 text-red-500 rounded uppercase">
                              ELIMINADO
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">{format(parseISO(horario.dia), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>{renderCategoria(horario.displayCategoria)}</TableCell>
                      <TableCell className="text-center font-mono">{horario.llegada || '—'}</TableCell>
                      <TableCell className="text-center">{renderUbicacion(horario.ubicacion_llegada)}</TableCell>
                      <TableCell className="text-center font-mono">{horario.salida || '—'}</TableCell>
                      <TableCell className="text-center">{renderUbicacion(horario.ubicacion_salida)}</TableCell>
                      <TableCell className="text-center">
                        {horario.salidaEmergencia ? (
                          <div className="space-y-1">
                            <span className="font-mono text-orange-400">{horario.salidaEmergencia.hora}</span>
                            <div>
                              {horario.salidaEmergencia.maps_url ? (
                                <a 
                                  href={horario.salidaEmergencia.maps_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline text-xs"
                                >
                                  Ver en Maps
                                </a>
                              ) : (
                                renderUbicacion(horario.salidaEmergencia.ubicacion)
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleEditGroup}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={handleDeleteGroup}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        {filteredHorarios.length} día{filteredHorarios.length !== 1 ? 's' : ''} con registros
        {selectedEmpleadoId && eventosAsignados.length > 0 && (
          <span className="ml-2">• {eventosAsignados.length} evento{eventosAsignados.length !== 1 ? 's' : ''} asignado{eventosAsignados.length !== 1 ? 's' : ''}</span>
        )}
      </div>
    </div>
  );
};
