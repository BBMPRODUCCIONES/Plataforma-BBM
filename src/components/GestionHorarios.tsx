import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@/lib/logger';
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
import { Search, Plus, CalendarIcon, Pencil, Trash2, ChevronLeft, ChevronRight, User, AlertCircle, RefreshCw, X, Building2, Home, MapPin, Clock, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { Project, PersonalItem } from '@/types';
import { EmpleadoAutocomplete } from '@/components/EmpleadoAutocomplete';
import { HorarioFormDialog } from '@/components/HorarioFormDialog';
import { DateRange } from 'react-day-picker';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const isMobile = useIsMobile();
  const navigate = useNavigate();
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
    logger.debug('[GestionHorarios] Component mounted, forcing refetch...');
    refetch();
  }, [refetch]);

  // Log horarios state changes
  useEffect(() => {
    logger.debug('[GestionHorarios] Horarios updated:', horarios.length, 'records');
  }, [horarios]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    logger.debug('[GestionHorarios] Manual refresh triggered');
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
    let filtered = [...horarios];

    // Filter by selected employee (if one is selected)
    if (selectedEmpleadoId) {
      filtered = filtered.filter(h => h.empleado_id === selectedEmpleadoId);
    }

    // Filter by date range
    const range = getDateRange();
    if (range) {
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

    logger.debug('[GestionHorarios] Final grouped rows:', result.length);
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

  // Helper to render ubicacion as link
  const renderUbicacionMobile = (ubicacion: string) => {
    if (!ubicacion || ubicacion === '-') return <span className="text-muted-foreground">—</span>;
    
    const coordsMatch = ubicacion.match(/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
    if (coordsMatch) {
      const lat = coordsMatch[1];
      const lng = coordsMatch[2];
      const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
      return (
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="horario-detail-value">
          Ver en Maps
        </a>
      );
    }
    
    if (ubicacion.includes('google.com/maps') || ubicacion.startsWith('http')) {
      return (
        <a href={ubicacion} target="_blank" rel="noopener noreferrer" className="horario-detail-value">
          Ver en Maps
        </a>
      );
    }
    
    if (ubicacion.toLowerCase().includes('no disponible')) {
      return <span className="text-muted-foreground">No disponible</span>;
    }
    
    return <span>{ubicacion}</span>;
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Cargando horarios...</div>;
  }

  // ========== MOBILE LAYOUT (AWC) ==========
  if (isMobile) {
    return (
      <div className="gestion-horarios-mobile-container">
        {/* Fixed Header */}
        <div className="gestion-horarios-mobile-header">
          <div className="mobile-header-title">
            <Clock className="h-5 w-5 text-primary" />
            <h1>Gestión de Horarios</h1>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="mobile-header-action"
          >
            <RefreshCw className={cn("h-5 w-5", isRefreshing && "animate-spin")} />
          </Button>
        </div>

        {/* Scrollable Content */}
        <div className="gestion-horarios-mobile-content">
          {/* Employee Card */}
          <div className="empleado-card-mobile">
            <Label className="text-xs text-muted-foreground mb-2 block">SELECCIONAR EMPLEADO</Label>
            <EmpleadoAutocomplete
              value={selectedEmpleadoId}
              onChange={handleEmpleadoChange}
              useEmpleadoId={true}
              placeholder="Buscar empleado..."
            />
            {selectedEmpleado && (
              <div className="mt-3 pt-3 border-t border-border/50">
                <div className="empleado-nombre">{selectedEmpleado.nombre}</div>
                <div className="empleado-cargo">{selectedEmpleado.cargo}</div>
              </div>
            )}
          </div>

          {/* Date Filter Card */}
          <div className="date-filter-mobile">
            <Label className="text-xs text-muted-foreground mb-2 block">FECHA</Label>
            
            {/* View Mode Tabs */}
            <div className="view-mode-tabs-mobile">
              {(['day', 'week', 'month', 'quarter', 'year'] as ViewMode[]).map((mode) => (
                <Button
                  key={mode}
                  variant={viewMode === mode ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode(mode)}
                >
                  {VIEW_MODE_LABELS[mode]}
                </Button>
              ))}
            </div>

            {/* Date Navigation */}
            <div className="date-nav-mobile">
              <Button variant="ghost" size="icon" onClick={navigatePrevious}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="date-display-mobile">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {getDateLabel()}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="center">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    locale={es}
                  />
                </PopoverContent>
              </Popover>
              <Button variant="ghost" size="icon" onClick={navigateNext}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            {/* Quick Actions */}
            <Button variant="outline" size="sm" className="w-full" onClick={() => setSelectedDate(new Date())}>
              Ir a Hoy
            </Button>
          </div>

          {/* Location Type Cards */}
          <div className="location-cards-mobile">
            <div className="location-card-mobile">
              <Building2 className="h-5 w-5 text-blue-400" />
              <div className="location-card-info">
                <span className="location-card-title">Oficina</span>
                <span className="location-card-subtitle">Registro de oficina</span>
              </div>
            </div>
            <div className="location-card-mobile">
              <Home className="h-5 w-5 text-green-400" />
              <div className="location-card-info">
                <span className="location-card-title">Casa</span>
                <span className="location-card-subtitle">Trabajo remoto</span>
              </div>
            </div>
          </div>

          {/* Eventos Section */}
          <div className="eventos-section-mobile">
            <Label className="text-xs text-muted-foreground mb-2 block">EVENTOS</Label>
            <Input 
              placeholder="Buscar evento..." 
              className="mb-3"
            />
            
            {selectedEmpleadoId && eventosAsignados.length > 0 ? (
              <div className="eventos-list-mobile">
                {eventosAsignados.map((evento) => (
                  <div key={evento.projectId} className="evento-item-mobile">
                    <div className="evento-nombre">{evento.evento}</div>
                    <div className="evento-badges">
                      <span className="text-xs px-2 py-1 bg-primary/20 text-primary rounded">
                        {evento.cargo || 'Sin cargo'}
                      </span>
                      <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded">
                        {evento.tipoPersonal}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state-mobile-small">
                <p className="text-muted-foreground text-sm">
                  {!selectedEmpleadoId 
                    ? 'Seleccione un empleado para ver eventos' 
                    : 'No hay eventos para este período'}
                </p>
              </div>
            )}
          </div>

          {/* Horarios List */}
          <div className="horarios-list-mobile">
            <Label className="text-xs text-muted-foreground mb-2 block">HISTORIAL DE REGISTROS</Label>

            {!selectedEmpleadoId ? (
              <div className="empty-state-mobile">
                <User className="empty-icon" />
                <p className="empty-text">Seleccione un empleado para ver sus horarios</p>
              </div>
            ) : filteredHorarios.length === 0 ? (
              <div className="empty-state-mobile">
                <CalendarIcon className="empty-icon" />
                <p className="empty-text">No hay registros en el rango seleccionado</p>
              </div>
            ) : (
              filteredHorarios.map((horario, index) => (
                <div 
                  key={`${horario.id}-${index}`} 
                  className={cn(
                    "horario-card-mobile",
                    horario.salidaEmergencia && "has-contingency",
                    horario.empleado_deleted && "border-destructive/50"
                  )}
                >
                  {/* Header */}
                  <div className="horario-header">
                    <div className="horario-evento">
                      {horario.displayCategoria !== '-' ? horario.displayCategoria : 'Sin categoría'}
                    </div>
                    <div className="horario-fecha">
                      {format(parseISO(horario.dia), 'dd/MM/yyyy')}
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="horario-details">
                    <div className="horario-detail-item">
                      <span className="horario-detail-label">Llegada</span>
                      <span className="horario-detail-value">{horario.llegada || '—'}</span>
                    </div>
                    <div className="horario-detail-item">
                      <span className="horario-detail-label">Ubicación</span>
                      {renderUbicacionMobile(horario.ubicacion_llegada)}
                    </div>
                    <div className="horario-detail-item">
                      <span className="horario-detail-label">Salida</span>
                      <span className="horario-detail-value">{horario.salida || '—'}</span>
                    </div>
                    <div className="horario-detail-item">
                      <span className="horario-detail-label">Ubicación</span>
                      {renderUbicacionMobile(horario.ubicacion_salida)}
                    </div>
                  </div>

                  {/* Contingency Section */}
                  {horario.salidaEmergencia && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="contingency-badge">Salida Emergencia</span>
                      </div>
                      <div className="horario-details">
                        <div className="horario-detail-item">
                          <span className="horario-detail-label">Hora</span>
                          <span className="horario-detail-value text-orange-400">{horario.salidaEmergencia.hora}</span>
                        </div>
                        <div className="horario-detail-item">
                          <span className="horario-detail-label">Ubicación</span>
                          {horario.salidaEmergencia.maps_url ? (
                            <a 
                              href={horario.salidaEmergencia.maps_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="horario-detail-value text-primary"
                            >
                              Ver en Maps
                            </a>
                          ) : (
                            renderUbicacionMobile(horario.salidaEmergencia.ubicacion)
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="horario-actions">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => horario.originalHorarios.length > 0 && handleEdit(horario.originalHorarios[0])}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={async () => {
                        if (confirm(`¿Eliminar registros del día ${format(parseISO(horario.dia), 'dd/MM/yyyy')}?`)) {
                          for (const h of horario.originalHorarios) {
                            await deleteHorario(h.id);
                          }
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Eliminar
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Bottom padding for safe area and fixed button */}
          <div className="h-32"></div>
        </div>

        {/* Fixed Action Button */}
        <div className="fixed-action-mobile">
          <HorarioFormDialog 
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) setEditingHorario(null);
            }}
            defaultEmpleadoId={selectedEmpleadoId}
            mode="admin"
          >
            <Button size="lg" className="w-full gap-2">
              <Plus className="h-5 w-5" />
              Registrar Horario
            </Button>
          </HorarioFormDialog>
        </div>
      </div>
    );
  }

  // ========== DESKTOP LAYOUT (unchanged) ==========

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

                  // Render category as tags/pills with clickable events
                  const renderCategoria = (categoria: string, originalHorarios: Horario[]) => {
                    const parts = categoria.split(' + ').map(p => p.trim()).filter(Boolean);
                    if (parts.length === 0) return <span className="text-muted-foreground">—</span>;
                    
                    // Build a map of event names to project IDs from originalHorarios
                    const eventToProjectId = new Map<string, string>();
                    originalHorarios.forEach(h => {
                      if (h.evento_id && h.evento_nombre) {
                        eventToProjectId.set(h.evento_nombre.toLowerCase(), h.evento_id);
                      }
                      // Also check contingencia_contexto for event IDs
                      if (h.contingencia_contexto) {
                        let contexto: { eventos?: string[] } | null = null;
                        if (typeof h.contingencia_contexto === 'string') {
                          try {
                            contexto = JSON.parse(h.contingencia_contexto);
                          } catch (e) {}
                        } else if (typeof h.contingencia_contexto === 'object') {
                          contexto = h.contingencia_contexto as { eventos?: string[] };
                        }
                        if (contexto?.eventos) {
                          contexto.eventos.forEach(eventId => {
                            const project = projects.find(p => p.id === eventId);
                            if (project) {
                              eventToProjectId.set(project.evento.toLowerCase(), project.id);
                            }
                          });
                        }
                      }
                    });
                    
                    const handleEventClick = (eventName: string) => {
                      const lowercaseName = eventName.toLowerCase();
                      let projectId = eventToProjectId.get(lowercaseName);
                      
                      // If not in horario map, try to find in projects by name
                      if (!projectId) {
                        const project = projects.find(p => p.evento.toLowerCase() === lowercaseName);
                        if (project) {
                          projectId = project.id;
                        }
                      }
                      
                      if (projectId) {
                        navigate(`/panel-operaciones?eventId=${projectId}`);
                      }
                    };
                    
                    // Find otro_comentario from originalHorarios
                    const otroComentario = originalHorarios.find(h => h.otro_comentario)?.otro_comentario || '';
                    
                    return (
                      <div className="flex flex-wrap gap-1">
                        {parts.map((part, i) => {
                          const isOficina = part.toLowerCase() === 'oficina';
                          const isCasa = part.toLowerCase() === 'casa';
                          const isOtro = part.toLowerCase() === 'otro';
                          const isStatic = isOficina || isCasa;
                          
                          // Check if this is a clickable event
                          const lowercasePart = part.toLowerCase();
                          const hasProjectId = eventToProjectId.has(lowercasePart) || 
                            projects.some(p => p.evento.toLowerCase() === lowercasePart);
                          
                          // Handle "Otro" with popover for comment
                          if (isOtro) {
                            return (
                              <Popover key={i}>
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    className="px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap bg-purple-500/20 text-purple-400 cursor-pointer hover:ring-2 hover:ring-purple-500/50 hover:bg-purple-500/30 transition-all"
                                    title="Clic para ver comentario"
                                  >
                                    {part}
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-72 p-3">
                                  <div className="space-y-2">
                                    <h4 className="font-medium text-sm flex items-center gap-2">
                                      <MessageSquare className="h-4 w-4 text-purple-400" />
                                      Comentario
                                    </h4>
                                    <p className="text-sm text-muted-foreground">
                                      {otroComentario || 'Sin comentario'}
                                    </p>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            );
                          }
                          
                          if (isStatic) {
                            return (
                              <span
                                key={i}
                                className={cn(
                                  "px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap",
                                  isOficina ? "bg-blue-500/20 text-blue-400" : "bg-amber-500/20 text-amber-400"
                                )}
                              >
                                {part}
                              </span>
                            );
                          }
                          
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEventClick(part);
                              }}
                              className={cn(
                                "px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap transition-all",
                                "bg-green-500/20 text-green-400",
                                hasProjectId && "cursor-pointer hover:ring-2 hover:ring-green-500/50 hover:bg-green-500/30"
                              )}
                              title={hasProjectId ? "Clic para ver evento" : undefined}
                            >
                              {part}
                            </button>
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
                      <TableCell>{renderCategoria(horario.displayCategoria, horario.originalHorarios)}</TableCell>
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
