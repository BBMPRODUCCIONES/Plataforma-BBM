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
import { Search, Plus, CalendarIcon, Pencil, Trash2, ChevronLeft, ChevronRight, User, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Project, PersonalItem } from '@/types';
import { EmpleadoAutocomplete } from '@/components/EmpleadoAutocomplete';
import { HorarioFormDialog } from '@/components/HorarioFormDialog';

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

  // Expanded horarios - one row per event in multi-event registrations
  interface ExpandedHorario extends Horario {
    displayEvento: string;
    displayCargo: string;
    displayCategoria: string;
    displayNombre: string;
  }

  // Filter horarios by selected employee and date range, then expand to rows per event
  const filteredHorarios = useMemo((): ExpandedHorario[] => {
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
          console.log('[GestionHorarios] Date check:', h.dia, '-> in range:', inRange);
          return inRange;
        } catch (e) {
          console.error('[GestionHorarios] Date parse error for:', h.dia, e);
          return false;
        }
      });
      console.log('[GestionHorarios] After date filter:', filtered.length, 'records');
    }

    // Expand to multiple rows if evento_nombre contains multiple events (separated by " + ")
    const expanded: ExpandedHorario[] = [];
    
    filtered.forEach(horario => {
      // Get employee data for autocompletado
      const empleado = empleados.find(e => e.id === horario.empleado_id);
      const displayNombre = empleado?.nombre || horario.empleado_nombre || '-';
      const displayCargo = empleado?.cargo || horario.cargo || '-';
      
      // Parse evento_nombre to check for multiple events and oficina
      const eventoNombre = horario.evento_nombre || '';
      const parts = eventoNombre.split(' + ').map(p => p.trim()).filter(Boolean);
      
      // Determine category display based on categoria field and evento_nombre
      const categoria = horario.categoria || '';
      const hasOficina = categoria.toLowerCase() === 'oficina' || parts.some(p => p.toLowerCase() === 'oficina');
      const eventParts = parts.filter(p => p.toLowerCase() !== 'oficina');
      const hasEvents = eventParts.length > 0 || (categoria.toLowerCase() === 'evento' && eventoNombre);
      
      let displayCategoria: string;
      if (hasOficina && hasEvents) {
        displayCategoria = 'Oficina + Evento';
      } else if (hasOficina) {
        displayCategoria = 'Oficina';
      } else {
        displayCategoria = 'Evento';
      }
      
      // If there are multiple events, create a row for each
      if (eventParts.length > 1) {
        eventParts.forEach(eventName => {
          expanded.push({
            ...horario,
            displayEvento: eventName,
            displayCargo,
            displayCategoria,
            displayNombre,
          });
        });
      } else if (eventParts.length === 1) {
        // Single event
        expanded.push({
          ...horario,
          displayEvento: eventParts[0],
          displayCargo,
          displayCategoria,
          displayNombre,
        });
      } else if (hasOficina || categoria.toLowerCase() === 'oficina') {
        // Only oficina, no events
        expanded.push({
          ...horario,
          displayEvento: 'OFICINA',
          displayCargo,
          displayCategoria: 'Oficina',
          displayNombre,
        });
      } else {
        // Fallback - use evento_nombre directly
        expanded.push({
          ...horario,
          displayEvento: eventoNombre || horario.categoria || '-',
          displayCargo,
          displayCategoria: categoria || 'Evento',
          displayNombre,
        });
      }
    });

    console.log('[GestionHorarios] Final expanded rows:', expanded.length);
    return expanded;
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

  const handleEmpleadoChange = (empleadoId: string) => {
    setSelectedEmpleadoId(empleadoId);
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
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={viewMode === 'custom' ? 'secondary' : 'outline'}
              size="sm"
              className="h-7 px-3 text-xs gap-1"
              onClick={() => setViewMode('custom')}
            >
              <CalendarIcon className="h-3 w-3" />
              Rango
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={(range) => {
                if (range?.from && range?.to) {
                  setDateRange({ from: range.from, to: range.to });
                  setViewMode('custom');
                }
              }}
              locale={es}
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>

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
          HISTORIAL DE REGISTROS DE HORARIOS
        </h3>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold">EVENTO</TableHead>
              <TableHead className="font-semibold">CARGO</TableHead>
              <TableHead className="font-semibold">NOMBRE</TableHead>
              <TableHead className="font-semibold">DÍA</TableHead>
              <TableHead className="font-semibold">CATEGORÍA</TableHead>
              <TableHead className="font-semibold text-center">LLEGADA</TableHead>
              <TableHead className="font-semibold text-center">UBICACIÓN</TableHead>
              <TableHead className="font-semibold text-center">SALIDA</TableHead>
              <TableHead className="font-semibold text-center">UBICACIÓN</TableHead>
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
                  No hay horarios registrados para este empleado en el período seleccionado
                </TableCell>
              </TableRow>
            ) : (
              filteredHorarios.map((horario, index) => {
                // Parse ubicación to create clickable Google Maps link
                const renderUbicacion = (ubicacion: string) => {
                  if (!ubicacion || ubicacion === '-') return <span className="text-muted-foreground text-xs">-</span>;
                  
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

                // Determine category badge color
                const getCategoryStyles = (categoria: string) => {
                  if (categoria.includes('Oficina') && categoria.includes('Evento')) {
                    return "bg-purple-500/20 text-purple-400";
                  } else if (categoria === 'Oficina') {
                    return "bg-blue-500/20 text-blue-400";
                  }
                  return "bg-green-500/20 text-green-400";
                };

                return (
                  <TableRow key={`${horario.id}-${index}`}>
                    <TableCell className="font-medium">{horario.displayEvento}</TableCell>
                    <TableCell>{horario.displayCargo}</TableCell>
                    <TableCell>{horario.displayNombre}</TableCell>
                    <TableCell>{format(parseISO(horario.dia), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>
                      <span className={cn(
                        "px-2 py-1 rounded text-xs font-medium whitespace-nowrap",
                        getCategoryStyles(horario.displayCategoria)
                      )}>
                        {horario.displayCategoria}
                      </span>
                    </TableCell>
                    <TableCell className="text-center font-mono">{horario.llegada || '-'}</TableCell>
                    <TableCell className="text-center">{renderUbicacion(horario.ubicacion_llegada)}</TableCell>
                    <TableCell className="text-center font-mono">{horario.salida || '-'}</TableCell>
                    <TableCell className="text-center">{renderUbicacion(horario.ubicacion_salida)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(horario)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(horario.id)}>
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

      <div className="text-xs text-muted-foreground">
        {filteredHorarios.length} registro{filteredHorarios.length !== 1 ? 's' : ''} encontrado{filteredHorarios.length !== 1 ? 's' : ''}
        {selectedEmpleadoId && eventosAsignados.length > 0 && (
          <span className="ml-2">• {eventosAsignados.length} evento{eventosAsignados.length !== 1 ? 's' : ''} asignado{eventosAsignados.length !== 1 ? 's' : ''}</span>
        )}
      </div>
    </div>
  );
};
