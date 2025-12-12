import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { EmpleadoAutocomplete } from '@/components/EmpleadoAutocomplete';
import { CameraCapture } from '@/components/CameraCapture';
import { useHorarios } from '@/contexts/HorariosContext';
import { useProjects } from '@/contexts/ProjectsContext';
import { useEmpleados } from '@/contexts/EmpleadosContext';
import { supabase } from '@/integrations/supabase/client';
import { CalendarIcon, Search, Trash2, MapPin, Clock, Check, AlertCircle, Camera } from 'lucide-react';
import { format, parseISO, isWithinInterval, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface HorarioFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface LocationData {
  lat: number;
  lng: number;
  address?: string;
}

export const HorarioFormDialog = ({ open, onOpenChange }: HorarioFormDialogProps) => {
  const { addHorario } = useHorarios();
  const { projects } = useProjects();
  const { empleados } = useEmpleados();
  const [loading, setLoading] = useState(false);

  // Form state
  const [empleadoId, setEmpleadoId] = useState<string | null>(null);
  const [categoria, setCategoria] = useState<'Oficina' | 'Evento'>('Oficina');
  const [fechaEvento, setFechaEvento] = useState<Date>(new Date());
  const [eventoId, setEventoId] = useState<string | null>(null);
  const [eventoNombre, setEventoNombre] = useState('');
  const [eventoSearch, setEventoSearch] = useState('');
  const [showEventoDropdown, setShowEventoDropdown] = useState(false);

  // Camera dialogs
  const [cameraLlegadaOpen, setCameraLlegadaOpen] = useState(false);
  const [cameraSalidaOpen, setCameraSalidaOpen] = useState(false);

  // Llegada
  const [fotoLlegada, setFotoLlegada] = useState<string>('');
  const [ubicacionLlegada, setUbicacionLlegada] = useState('');
  const [horarioLlegada, setHorarioLlegada] = useState('');
  const [locationLlegada, setLocationLlegada] = useState<LocationData | null>(null);

  // Salida
  const [fotoSalida, setFotoSalida] = useState<string>('');
  const [ubicacionSalida, setUbicacionSalida] = useState('');
  const [horarioSalida, setHorarioSalida] = useState('');
  const [locationSalida, setLocationSalida] = useState<LocationData | null>(null);

  // Reset event selection when category changes to Evento
  useEffect(() => {
    if (categoria === 'Evento') {
      setFechaEvento(new Date());
    }
  }, [categoria]);

  // Filter events by selected date (montaje or ejecucion)
  const eventsForDate = useMemo(() => {
    if (!fechaEvento) return [];
    
    return projects.filter(project => {
      try {
        const montajeStart = parseISO(project.fechaMontajeInicio);
        const montajeEnd = parseISO(project.fechaMontajeFin);
        const isInMontaje = isWithinInterval(fechaEvento, { start: montajeStart, end: montajeEnd }) ||
          isSameDay(fechaEvento, montajeStart) || isSameDay(fechaEvento, montajeEnd);

        const ejecucionStart = parseISO(project.fechaEjecucionInicio);
        const ejecucionEnd = parseISO(project.fechaEjecucionFin);
        const isInEjecucion = isWithinInterval(fechaEvento, { start: ejecucionStart, end: ejecucionEnd }) ||
          isSameDay(fechaEvento, ejecucionStart) || isSameDay(fechaEvento, ejecucionEnd);

        return isInMontaje || isInEjecucion;
      } catch {
        return false;
      }
    });
  }, [projects, fechaEvento]);

  // Filter events based on search
  const filteredEvents = useMemo(() => {
    if (!eventoSearch.trim()) return eventsForDate;
    return eventsForDate.filter(p =>
      p.evento.toLowerCase().includes(eventoSearch.toLowerCase())
    );
  }, [eventsForDate, eventoSearch]);

  // Reset event selection when date changes
  useEffect(() => {
    setEventoId(null);
    setEventoNombre('');
    setEventoSearch('');
  }, [fechaEvento]);

  const handleSelectEvento = (project: typeof projects[0]) => {
    setEventoId(project.id);
    setEventoNombre(project.evento);
    setEventoSearch(project.evento);
    setShowEventoDropdown(false);
  };

  const getCurrentLocation = (): Promise<LocationData | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        toast.error('Geolocalización no soportada');
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          let address: string | undefined;

          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
            );
            if (response.ok) {
              const data = await response.json();
              address = data.display_name || undefined;
            }
          } catch (err) {
            console.log('Could not get address:', err);
          }

          resolve({ lat: latitude, lng: longitude, address });
        },
        (error) => {
          console.error('Location error:', error);
          if (error.code === error.PERMISSION_DENIED) {
            toast.error('Para registrar la ubicación debes habilitar permisos de ubicación en tu dispositivo.');
          } else {
            toast.error('No se pudo obtener la ubicación');
          }
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  const handleCaptureLlegada = async (file: File) => {
    const now = new Date();
    const timestamp = now.toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    try {
      const fileName = `horario-llegada-${Date.now()}.jpg`;
      const filePath = `horarios/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('notes-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('notes-images')
        .getPublicUrl(filePath);

      setFotoLlegada(publicUrl);
    } catch (err) {
      console.error('Error uploading photo:', err);
      const reader = new FileReader();
      reader.onload = () => setFotoLlegada(reader.result as string);
      reader.readAsDataURL(file);
    }

    setHorarioLlegada(timestamp);

    const location = await getCurrentLocation();
    if (location) {
      setLocationLlegada(location);
      setUbicacionLlegada(location.address || `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`);
    }

    toast.success('Foto de llegada capturada');
  };

  const handleCaptureSalida = async (file: File) => {
    const now = new Date();
    const timestamp = now.toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    try {
      const fileName = `horario-salida-${Date.now()}.jpg`;
      const filePath = `horarios/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('notes-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('notes-images')
        .getPublicUrl(filePath);

      setFotoSalida(publicUrl);
    } catch (err) {
      console.error('Error uploading photo:', err);
      const reader = new FileReader();
      reader.onload = () => setFotoSalida(reader.result as string);
      reader.readAsDataURL(file);
    }

    setHorarioSalida(timestamp);

    const location = await getCurrentLocation();
    if (location) {
      setLocationSalida(location);
      setUbicacionSalida(location.address || `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`);
    }

    toast.success('Foto de salida capturada');
  };

  const handleSubmit = async () => {
    if (!empleadoId) {
      toast.error('Selecciona un empleado');
      return;
    }
    if (categoria === 'Evento' && !eventoId) {
      toast.error('Selecciona un evento');
      return;
    }

    setLoading(true);
    try {
      const dia = format(fechaEvento, 'yyyy-MM-dd');
      const empleado = empleados.find(e => e.id === empleadoId);
      const cargo = empleado?.cargo || '';

      await addHorario({
        empleado_id: empleadoId,
        evento_id: eventoId,
        evento_nombre: eventoNombre,
        cargo,
        dia,
        categoria,
        llegada: horarioLlegada || '',
        ubicacion_llegada: ubicacionLlegada,
        salida: horarioSalida || '',
        ubicacion_salida: ubicacionSalida,
        foto_llegada: fotoLlegada,
        foto_salida: fotoSalida,
      });

      resetForm();
      onOpenChange(false);
    } catch (err) {
      console.error('Error creating horario:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmpleadoId(null);
    setCategoria('Oficina');
    setFechaEvento(new Date());
    setEventoId(null);
    setEventoNombre('');
    setEventoSearch('');
    setFotoLlegada('');
    setUbicacionLlegada('');
    setHorarioLlegada('');
    setLocationLlegada(null);
    setFotoSalida('');
    setUbicacionSalida('');
    setHorarioSalida('');
    setLocationSalida(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">GESTIÓN DE HORARIOS</DialogTitle>
          </DialogHeader>

          <div className="flex gap-6">
            {/* Left Panel - Main Form */}
            <div className="flex-1 space-y-6">
              {/* Nombre - Connected to Empleados */}
              <div className="space-y-2">
                <Label className="text-sm font-bold uppercase">Nombre</Label>
                <EmpleadoAutocomplete
                  value={empleadoId || ''}
                  onChange={(_, id) => {
                    setEmpleadoId(id || null);
                  }}
                  useEmpleadoId={true}
                  placeholder="Buscar empleado..."
                />
              </div>

              {/* Categoría */}
              <div className="space-y-2">
                <Label className="text-sm font-bold uppercase">Categoría</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={categoria === 'Evento' ? 'default' : 'outline'}
                    onClick={() => setCategoria('Evento')}
                    className="flex-1"
                  >
                    EVENTO
                  </Button>
                  <Button
                    type="button"
                    variant={categoria === 'Oficina' ? 'default' : 'outline'}
                    onClick={() => setCategoria('Oficina')}
                    className="flex-1"
                  >
                    OFICINA
                  </Button>
                </div>
              </div>

              {/* Llegada Section */}
              <div className="space-y-3">
                <Label className="text-lg font-bold uppercase">Llegada</Label>
                <div className="grid grid-cols-3 gap-4">
                  {/* Foto */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium uppercase text-muted-foreground">Foto</Label>
                    <div className="border-2 border-dashed border-border rounded-lg p-4 min-h-[100px] flex flex-col items-center justify-center gap-2">
                      {fotoLlegada ? (
                        <div className="relative w-full">
                          <img src={fotoLlegada} alt="Llegada" className="w-full h-20 object-cover rounded" />
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute -top-2 -right-2 h-6 w-6"
                            onClick={() => {
                              setFotoLlegada('');
                              setHorarioLlegada('');
                              setUbicacionLlegada('');
                              setLocationLlegada(null);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setCameraLlegadaOpen(true)}
                          className="gap-2"
                        >
                          <Camera className="h-4 w-4" />
                          Tomar foto
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Ubicación - Read only */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium uppercase text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      Ubicación
                    </Label>
                    <div className="relative">
                      <Input
                        value={ubicacionLlegada}
                        readOnly
                        placeholder="Se captura con la foto"
                        className="bg-muted/50 cursor-not-allowed text-xs"
                      />
                      {locationLlegada && (
                        <Check className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                      )}
                    </div>
                    {!ubicacionLlegada && (
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Automático al tomar foto
                      </p>
                    )}
                  </div>

                  {/* Horario - Read only */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium uppercase text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Horario
                    </Label>
                    <div className="relative">
                      <Input
                        value={horarioLlegada}
                        readOnly
                        placeholder="--:--"
                        className="bg-muted/50 cursor-not-allowed font-mono"
                      />
                      {horarioLlegada && (
                        <Check className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                      )}
                    </div>
                    {!horarioLlegada && (
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Automático al tomar foto
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Salida Section */}
              <div className="space-y-3">
                <Label className="text-lg font-bold uppercase">Salida</Label>
                <div className="grid grid-cols-3 gap-4">
                  {/* Foto */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium uppercase text-muted-foreground">Foto</Label>
                    <div className="border-2 border-dashed border-border rounded-lg p-4 min-h-[100px] flex flex-col items-center justify-center gap-2">
                      {fotoSalida ? (
                        <div className="relative w-full">
                          <img src={fotoSalida} alt="Salida" className="w-full h-20 object-cover rounded" />
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute -top-2 -right-2 h-6 w-6"
                            onClick={() => {
                              setFotoSalida('');
                              setHorarioSalida('');
                              setUbicacionSalida('');
                              setLocationSalida(null);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setCameraSalidaOpen(true)}
                          className="gap-2"
                        >
                          <Camera className="h-4 w-4" />
                          Tomar foto
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Ubicación - Read only */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium uppercase text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      Ubicación
                    </Label>
                    <div className="relative">
                      <Input
                        value={ubicacionSalida}
                        readOnly
                        placeholder="Se captura con la foto"
                        className="bg-muted/50 cursor-not-allowed text-xs"
                      />
                      {locationSalida && (
                        <Check className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                      )}
                    </div>
                    {!ubicacionSalida && (
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Automático al tomar foto
                      </p>
                    )}
                  </div>

                  {/* Horario - Read only */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium uppercase text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Horario
                    </Label>
                    <div className="relative">
                      <Input
                        value={horarioSalida}
                        readOnly
                        placeholder="--:--"
                        className="bg-muted/50 cursor-not-allowed font-mono"
                      />
                      {horarioSalida && (
                        <Check className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                      )}
                    </div>
                    {!horarioSalida && (
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Automático al tomar foto
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                onClick={handleSubmit}
                className="w-full"
                disabled={loading}
              >
                {loading ? 'Guardando...' : 'Guardar Horario'}
              </Button>
            </div>

            {/* Right Panel - Event Selection (only if categoria === 'Evento') */}
            {categoria === 'Evento' && (
              <div className="w-72 border-l border-border pl-6 space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-bold uppercase">Fecha</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(fechaEvento, "PPP", { locale: es })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={fechaEvento}
                        onSelect={(date) => date && setFechaEvento(date)}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-bold uppercase">Nombre de Evento</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={eventoSearch}
                      onChange={(e) => {
                        setEventoSearch(e.target.value);
                        setShowEventoDropdown(true);
                      }}
                      onFocus={() => setShowEventoDropdown(true)}
                      placeholder="Buscar evento..."
                      className="pl-9"
                    />
                  </div>

                  <p className="text-[10px] text-muted-foreground">
                    Mostrando eventos del {format(fechaEvento, "d 'de' MMMM", { locale: es })}
                  </p>

                  {showEventoDropdown && (
                    <div className="border border-border rounded-md bg-background max-h-60 overflow-y-auto shadow-lg">
                      {filteredEvents.length > 0 ? (
                        filteredEvents.map((event) => (
                          <button
                            key={event.id}
                            className={cn(
                              "w-full text-left px-3 py-2 hover:bg-muted text-sm flex items-center gap-2",
                              eventoId === event.id && "bg-muted"
                            )}
                            onClick={() => handleSelectEvento(event)}
                          >
                            {eventoId === event.id && (
                              <Check className="h-4 w-4 text-primary flex-shrink-0" />
                            )}
                            <span className="truncate">{event.evento}</span>
                          </button>
                        ))
                      ) : (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          No hay eventos para esta fecha
                        </div>
                      )}
                    </div>
                  )}

                  {eventoId && (
                    <div className="p-2 bg-primary/10 rounded border border-primary/20">
                      <p className="text-xs font-medium text-primary">Evento seleccionado:</p>
                      <p className="text-sm truncate">{eventoNombre}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Camera Dialogs */}
      <CameraCapture
        open={cameraLlegadaOpen}
        onOpenChange={setCameraLlegadaOpen}
        onCapture={handleCaptureLlegada}
      />
      <CameraCapture
        open={cameraSalidaOpen}
        onOpenChange={setCameraSalidaOpen}
        onCapture={handleCaptureSalida}
      />
    </>
  );
};
