import React, { useState, useMemo } from 'react';
import { useHorarios, Horario } from '@/contexts/HorariosContext';
import { useEmpleados } from '@/contexts/EmpleadosContext';
import { useProjects } from '@/contexts/ProjectsContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { Search, Plus, CalendarIcon, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

type ViewMode = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  day: 'Día',
  week: 'Semana',
  month: 'Mes',
  quarter: 'Trimestre',
  year: 'Año',
  custom: 'Rango'
};

export const GestionHorarios = () => {
  const { horarios, loading, addHorario, updateHorario, deleteHorario } = useHorarios();
  const { empleados } = useEmpleados();
  const { projects } = useProjects();
  
  // Filters
  const [searchEmpleado, setSearchEmpleado] = useState('');
  const [searchEvento, setSearchEvento] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date } | undefined>();
  
  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingHorario, setEditingHorario] = useState<Horario | null>(null);
  const [formData, setFormData] = useState({
    empleado_id: '',
    evento_id: '',
    evento_nombre: '',
    cargo: '',
    dia: format(new Date(), 'yyyy-MM-dd'),
    categoria: 'Oficina' as 'Oficina' | 'Evento',
    llegada: '08:00',
    ubicacion_llegada: '',
    salida: '18:00',
    ubicacion_salida: ''
  });

  // Get date range based on view mode
  const getDateRange = (): { start: Date; end: Date } | null => {
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
  };

  // Filter horarios
  const filteredHorarios = useMemo(() => {
    let filtered = [...horarios];

    // Filter by employee name
    if (searchEmpleado) {
      const search = searchEmpleado.toLowerCase();
      filtered = filtered.filter(h => 
        h.empleado_nombre?.toLowerCase().includes(search) || 
        h.cargo.toLowerCase().includes(search)
      );
    }

    // Filter by event name
    if (searchEvento) {
      const search = searchEvento.toLowerCase();
      filtered = filtered.filter(h => h.evento_nombre.toLowerCase().includes(search));
    }

    // Filter by date range
    const range = getDateRange();
    if (range) {
      filtered = filtered.filter(h => {
        const horarioDate = parseISO(h.dia);
        return isWithinInterval(horarioDate, { start: range.start, end: range.end });
      });
    }

    return filtered;
  }, [horarios, searchEmpleado, searchEvento, viewMode, selectedDate, dateRange]);

  const handleSubmit = async () => {
    if (!formData.empleado_id || !formData.dia) {
      toast.error('Por favor complete los campos requeridos');
      return;
    }

    // Validate time format (HH:mm)
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(formData.llegada) || !timeRegex.test(formData.salida)) {
      toast.error('Formato de hora inválido. Use formato 24h (ej: 08:00, 14:30)');
      return;
    }

    const empleado = empleados.find(e => e.id === formData.empleado_id);
    
    const horarioData = {
      empleado_id: formData.empleado_id,
      evento_id: formData.evento_id || null,
      evento_nombre: formData.evento_nombre,
      cargo: formData.cargo || empleado?.cargo || '',
      dia: formData.dia,
      categoria: formData.categoria,
      llegada: formData.llegada,
      ubicacion_llegada: formData.ubicacion_llegada,
      salida: formData.salida,
      ubicacion_salida: formData.ubicacion_salida
    };

    if (editingHorario) {
      await updateHorario(editingHorario.id, horarioData);
    } else {
      await addHorario(horarioData);
    }

    resetForm();
    setIsDialogOpen(false);
  };

  const resetForm = () => {
    setFormData({
      empleado_id: '',
      evento_id: '',
      evento_nombre: '',
      cargo: '',
      dia: format(new Date(), 'yyyy-MM-dd'),
      categoria: 'Oficina',
      llegada: '08:00',
      ubicacion_llegada: '',
      salida: '18:00',
      ubicacion_salida: ''
    });
    setEditingHorario(null);
  };

  const handleEdit = (horario: Horario) => {
    setEditingHorario(horario);
    setFormData({
      empleado_id: horario.empleado_id || '',
      evento_id: horario.evento_id || '',
      evento_nombre: horario.evento_nombre,
      cargo: horario.cargo,
      dia: horario.dia,
      categoria: horario.categoria,
      llegada: horario.llegada,
      ubicacion_llegada: horario.ubicacion_llegada,
      salida: horario.salida,
      ubicacion_salida: horario.ubicacion_salida
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Está seguro de eliminar este horario?')) {
      await deleteHorario(id);
    }
  };

  const handleEmpleadoChange = (empleadoId: string) => {
    const empleado = empleados.find(e => e.id === empleadoId);
    setFormData(prev => ({
      ...prev,
      empleado_id: empleadoId,
      cargo: empleado?.cargo || prev.cargo
    }));
  };

  const handleEventoChange = (eventoId: string) => {
    const proyecto = projects.find(p => p.id === eventoId);
    setFormData(prev => ({
      ...prev,
      evento_id: eventoId,
      evento_nombre: proyecto?.evento || ''
    }));
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

  if (loading) {
    return <div className="flex items-center justify-center p-8">Cargando horarios...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Filters Section */}
      <div className="space-y-4">
        {/* Search filters */}
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <Label className="text-xs text-muted-foreground mb-1 block">NOMBRE</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar empleado..."
                value={searchEmpleado}
                onChange={(e) => setSearchEmpleado(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>
          <div className="flex-1 min-w-[200px]">
            <Label className="text-xs text-muted-foreground mb-1 block">EVENTO</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar evento..."
                value={searchEvento}
                onChange={(e) => setSearchEvento(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
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
          </div>

          {/* Add button */}
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-7 px-3 text-xs gap-1">
                <Plus className="h-3 w-3" />
                Agregar Horario
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingHorario ? 'Editar Horario' : 'Nuevo Horario'}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Empleado *</Label>
                    <Select value={formData.empleado_id} onValueChange={handleEmpleadoChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar empleado" />
                      </SelectTrigger>
                      <SelectContent>
                        {empleados.map(emp => (
                          <SelectItem key={emp.id} value={emp.id}>{emp.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Cargo</Label>
                    <Input
                      value={formData.cargo}
                      onChange={(e) => setFormData(prev => ({ ...prev, cargo: e.target.value }))}
                      placeholder="Cargo del empleado"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Evento</Label>
                    <Select value={formData.evento_id} onValueChange={handleEventoChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar evento" />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map(proj => (
                          <SelectItem key={proj.id} value={proj.id}>{proj.evento}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Nombre del Evento</Label>
                    <Input
                      value={formData.evento_nombre}
                      onChange={(e) => setFormData(prev => ({ ...prev, evento_nombre: e.target.value }))}
                      placeholder="O escribir manualmente"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Día *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.dia ? format(parseISO(formData.dia), 'PPP', { locale: es }) : 'Seleccionar fecha'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={formData.dia ? parseISO(formData.dia) : undefined}
                          onSelect={(date) => date && setFormData(prev => ({ ...prev, dia: format(date, 'yyyy-MM-dd') }))}
                          locale={es}
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label>Categoría *</Label>
                    <Select value={formData.categoria} onValueChange={(v) => setFormData(prev => ({ ...prev, categoria: v as 'Oficina' | 'Evento' }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Oficina">Oficina</SelectItem>
                        <SelectItem value="Evento">Evento</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Llegada (HH:mm) *</Label>
                    <Input
                      value={formData.llegada}
                      onChange={(e) => setFormData(prev => ({ ...prev, llegada: e.target.value }))}
                      placeholder="08:00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ubicación (Llegada)</Label>
                    <Input
                      value={formData.ubicacion_llegada}
                      onChange={(e) => setFormData(prev => ({ ...prev, ubicacion_llegada: e.target.value }))}
                      placeholder="Dirección o lugar"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Salida (HH:mm) *</Label>
                    <Input
                      value={formData.salida}
                      onChange={(e) => setFormData(prev => ({ ...prev, salida: e.target.value }))}
                      placeholder="18:00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ubicación (Salida)</Label>
                    <Input
                      value={formData.ubicacion_salida}
                      onChange={(e) => setFormData(prev => ({ ...prev, ubicacion_salida: e.target.value }))}
                      placeholder="Dirección o lugar"
                    />
                  </div>
                </div>

                <Button onClick={handleSubmit} className="w-full">
                  {editingHorario ? 'Guardar Cambios' : 'Agregar Horario'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold">CARGO</TableHead>
              <TableHead className="font-semibold">NOMBRE</TableHead>
              <TableHead className="font-semibold">DÍA</TableHead>
              <TableHead className="font-semibold">CATEGORÍA</TableHead>
              <TableHead className="font-semibold text-center" colSpan={2}>
                <div className="text-center">HORARIO</div>
                <div className="flex text-xs font-normal mt-1">
                  <span className="flex-1 text-center">LLEGADA</span>
                  <span className="flex-1 text-center">UBICACIÓN</span>
                </div>
              </TableHead>
              <TableHead className="font-semibold text-center" colSpan={2}>
                <div className="text-center">&nbsp;</div>
                <div className="flex text-xs font-normal mt-1">
                  <span className="flex-1 text-center">SALIDA</span>
                  <span className="flex-1 text-center">UBICACIÓN</span>
                </div>
              </TableHead>
              <TableHead className="font-semibold w-20">ACCIONES</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredHorarios.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  No hay horarios registrados para los filtros seleccionados
                </TableCell>
              </TableRow>
            ) : (
              filteredHorarios.map((horario) => (
                <TableRow key={horario.id}>
                  <TableCell className="font-medium">{horario.cargo}</TableCell>
                  <TableCell>{horario.empleado_nombre}</TableCell>
                  <TableCell>{format(parseISO(horario.dia), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>
                    <span className={cn(
                      "px-2 py-1 rounded text-xs font-medium",
                      horario.categoria === 'Oficina' 
                        ? "bg-blue-500/20 text-blue-400" 
                        : "bg-green-500/20 text-green-400"
                    )}>
                      {horario.categoria}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">{horario.llegada}</TableCell>
                  <TableCell className="text-center text-muted-foreground text-sm">{horario.ubicacion_llegada || '-'}</TableCell>
                  <TableCell className="text-center">{horario.salida}</TableCell>
                  <TableCell className="text-center text-muted-foreground text-sm">{horario.ubicacion_salida || '-'}</TableCell>
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
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="text-xs text-muted-foreground">
        {filteredHorarios.length} registro{filteredHorarios.length !== 1 ? 's' : ''} encontrado{filteredHorarios.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
};
