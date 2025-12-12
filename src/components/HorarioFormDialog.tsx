import { useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { EmpleadoAutocomplete } from '@/components/EmpleadoAutocomplete';
import { CameraCapture } from '@/components/CameraCapture';
import { useHorarios, Horario } from '@/contexts/HorariosContext';
import { useProjects } from '@/contexts/ProjectsContext';
import { Project } from '@/types';
import { useEmpleados } from '@/contexts/EmpleadosContext';
import { supabase } from '@/integrations/supabase/client';
import { CalendarIcon, Search, Trash2, MapPin, Clock, Check, Camera, ExternalLink, Building2, Star } from 'lucide-react';
import { format, parseISO, isWithinInterval, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface HorarioFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEmpleadoId?: string;
  children?: React.ReactNode;
}

interface LocationData {
  lat: number;
  lng: number;
  address?: string;
  accuracy?: number;
  provider?: string;
  status?: 'available' | 'unavailable' | 'denied' | 'error';
}

// New model: single daily record with context
interface DailyRecord {
  id?: string; // existing record id
  empleadoId: string;
  fecha: string;
  oficina: boolean;
  eventoIds: string[];
  // Llegada
  fotoLlegada: string;
  horarioLlegada: string;
  ubicacionLlegada: string;
  locationLlegada: LocationData | null;
  // Salida
  fotoSalida: string;
  horarioSalida: string;
  ubicacionSalida: string;
  locationSalida: LocationData | null;
}

export const HorarioFormDialog = ({ open, onOpenChange, defaultEmpleadoId, children }: HorarioFormDialogProps) => {
  const { addHorario, updateHorario, horarios } = useHorarios();
  const { projects } = useProjects();
  const { empleados } = useEmpleados();
  const [loading, setLoading] = useState(false);

  // Form state
  const [empleadoId, setEmpleadoId] = useState<string | null>(null);
  const [fecha, setFecha] = useState<Date>(new Date());
  const [eventoSearch, setEventoSearch] = useState('');
  
  // Context selection
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [oficinaEnabled, setOficinaEnabled] = useState(false);

  // Single daily record
  const [existingRecord, setExistingRecord] = useState<Horario | null>(null);
  const [fotoLlegada, setFotoLlegada] = useState('');
  const [horarioLlegada, setHorarioLlegada] = useState('');
  const [ubicacionLlegada, setUbicacionLlegada] = useState('');
  const [locationLlegada, setLocationLlegada] = useState<LocationData | null>(null);
  const [fotoSalida, setFotoSalida] = useState('');
  const [horarioSalida, setHorarioSalida] = useState('');
  const [ubicacionSalida, setUbicacionSalida] = useState('');
  const [locationSalida, setLocationSalida] = useState<LocationData | null>(null);

  // Camera dialogs
  const [cameraLlegadaOpen, setCameraLlegadaOpen] = useState(false);
  const [cameraSalidaOpen, setCameraSalidaOpen] = useState(false);

  // Initialize with defaultEmpleadoId when dialog opens
  useEffect(() => {
    if (open && defaultEmpleadoId && !empleadoId) {
      setEmpleadoId(defaultEmpleadoId);
    }
  }, [open, defaultEmpleadoId]);

  // Filter events by selected date
  const eventsForDate = useMemo(() => {
    if (!fecha) return [];
    
    return projects.filter(project => {
      try {
        if (project.fechaMontajeInicio && project.fechaMontajeFin) {
          const montajeStart = parseISO(project.fechaMontajeInicio);
          const montajeEnd = parseISO(project.fechaMontajeFin);
          const isInMontaje = isWithinInterval(fecha, { start: montajeStart, end: montajeEnd }) ||
            isSameDay(fecha, montajeStart) || isSameDay(fecha, montajeEnd);
          if (isInMontaje) return true;
        }

        if (project.fechaEjecucionInicio && project.fechaEjecucionFin) {
          const ejecucionStart = parseISO(project.fechaEjecucionInicio);
          const ejecucionEnd = parseISO(project.fechaEjecucionFin);
          const isInEjecucion = isWithinInterval(fecha, { start: ejecucionStart, end: ejecucionEnd }) ||
            isSameDay(fecha, ejecucionStart) || isSameDay(fecha, ejecucionEnd);
          if (isInEjecucion) return true;
        }

        return false;
      } catch {
        return false;
      }
    });
  }, [projects, fecha]);

  // Check if employee is assigned to an event
  const isEmployeeAssignedToEvent = useCallback((project: Project, empId: string | null): boolean => {
    if (!empId || !project.personal) return false;
    return project.personal.some((p: any) => 
      p.empleado_id === empId || p.personal === empId || p.nombre === empleados.find(e => e.id === empId)?.nombre
    );
  }, [empleados]);

  // Sort events: assigned ones first
  const sortedEventsForDate = useMemo(() => {
    return [...eventsForDate].sort((a, b) => {
      const aAssigned = isEmployeeAssignedToEvent(a, empleadoId);
      const bAssigned = isEmployeeAssignedToEvent(b, empleadoId);
      if (aAssigned && !bAssigned) return -1;
      if (!aAssigned && bAssigned) return 1;
      return 0;
    });
  }, [eventsForDate, empleadoId, isEmployeeAssignedToEvent]);

  // Filter events based on search
  const filteredEvents = useMemo(() => {
    if (!eventoSearch.trim()) return sortedEventsForDate;
    return sortedEventsForDate.filter(p =>
      p.evento.toLowerCase().includes(eventoSearch.toLowerCase())
    );
  }, [sortedEventsForDate, eventoSearch]);

  // Load existing record for employee + date (unique key)
  const loadExistingRecord = useCallback(() => {
    if (!empleadoId) {
      setExistingRecord(null);
      return;
    }

    const dia = format(fecha, 'yyyy-MM-dd');
    
    // Find record for this employee + date (new model: one record per day)
    const record = horarios.find(h => 
      h.empleado_id === empleadoId && h.dia === dia
    );

    if (record) {
      setExistingRecord(record);
      setFotoLlegada(record.foto_llegada || '');
      setHorarioLlegada(record.llegada || '');
      setUbicacionLlegada(record.ubicacion_llegada || '');
      setLocationLlegada(parseLocationFromString(record.ubicacion_llegada));
      setFotoSalida(record.foto_salida || '');
      setHorarioSalida(record.salida || '');
      setUbicacionSalida(record.ubicacion_salida || '');
      setLocationSalida(parseLocationFromString(record.ubicacion_salida));
      
      // Parse context from record
      setOficinaEnabled(record.categoria === 'Oficina' || record.evento_nombre?.includes('Oficina') || false);
      // For events, we'd need to parse from evento_id or evento_nombre
      if (record.evento_id) {
        setSelectedEventIds([record.evento_id]);
      }
    } else {
      setExistingRecord(null);
      setFotoLlegada('');
      setHorarioLlegada('');
      setUbicacionLlegada('');
      setLocationLlegada(null);
      setFotoSalida('');
      setHorarioSalida('');
      setUbicacionSalida('');
      setLocationSalida(null);
    }
  }, [empleadoId, fecha, horarios]);

  useEffect(() => {
    loadExistingRecord();
  }, [loadExistingRecord]);

  // Reset event selections when date changes
  useEffect(() => {
    if (!existingRecord) {
      setSelectedEventIds([]);
      setOficinaEnabled(false);
    }
    setEventoSearch('');
  }, [fecha, existingRecord]);

  const parseLocationFromString = (locationStr: string | undefined): LocationData | null => {
    if (!locationStr || !locationStr.includes(',')) return null;
    const coords = locationStr.match(/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
    if (coords) {
      return { lat: parseFloat(coords[1]), lng: parseFloat(coords[2]), status: 'available' };
    }
    return null;
  };

  const toggleEventSelection = (eventId: string) => {
    setSelectedEventIds(prev => {
      if (prev.includes(eventId)) {
        return prev.filter(id => id !== eventId);
      }
      return [...prev, eventId];
    });
  };

  const getCurrentLocation = (): Promise<LocationData | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        toast.error('Geolocalización no soportada');
        resolve({ lat: 0, lng: 0, status: 'unavailable', provider: 'none' });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          let address: string | undefined;
          const provider = accuracy < 100 ? 'gps' : 'network';

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

          if (accuracy && accuracy > 2000) {
            toast.warning(`Precisión baja: ${Math.round(accuracy)}m`, {
              description: 'La ubicación se guardará pero puede no ser exacta'
            });
          }

          resolve({ 
            lat: latitude, 
            lng: longitude, 
            address, 
            accuracy,
            provider,
            status: 'available' 
          });
        },
        (error) => {
          console.error('Location error:', error);
          let status: LocationData['status'] = 'error';
          if (error.code === error.PERMISSION_DENIED) {
            status = 'denied';
            toast.error('Para registrar la ubicación debes habilitar permisos de ubicación en tu dispositivo.');
          } else if (error.code === error.TIMEOUT) {
            toast.error('Tiempo de espera agotado para obtener ubicación');
          } else {
            toast.error('No se pudo obtener la ubicación');
          }
          resolve({ lat: 0, lng: 0, status, provider: 'failed' });
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  };

  const getGoogleMapsLink = (location: LocationData | null): string | null => {
    if (!location || location.status !== 'available' || (location.lat === 0 && location.lng === 0)) {
      return null;
    }
    return `https://www.google.com/maps?q=${location.lat},${location.lng}`;
  };

  const llegadaRegistered = Boolean(existingRecord?.foto_llegada && existingRecord?.llegada);
  const salidaRegistered = Boolean(existingRecord?.foto_salida && existingRecord?.salida);
  const hasLlegada = llegadaRegistered || fotoLlegada;

  const handleCaptureLlegada = async (file: File) => {
    if (llegadaRegistered) {
      toast.error('Ya registraste tu llegada hoy. No puedes registrar otra llegada.');
      return;
    }

    const now = new Date();
    const timestamp = now.toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    let photoUrl = '';
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

      photoUrl = publicUrl;
    } catch (err) {
      console.error('Error uploading photo:', err);
      const reader = new FileReader();
      reader.onload = () => {
        photoUrl = reader.result as string;
      };
      reader.readAsDataURL(file);
    }

    const location = await getCurrentLocation();
    const coordsStr = location?.status === 'available' 
      ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`
      : 'Ubicación no disponible';

    setFotoLlegada(photoUrl);
    setHorarioLlegada(timestamp);
    setUbicacionLlegada(coordsStr);
    setLocationLlegada(location);

    toast.success('Foto de llegada capturada');
  };

  const handleCaptureSalida = async (file: File) => {
    if (salidaRegistered) {
      toast.error('Ya registraste tu salida hoy. No puedes registrar otra salida.');
      return;
    }

    if (!hasLlegada) {
      toast.error('Debes registrar tu llegada antes de registrar la salida.');
      return;
    }

    const now = new Date();
    const timestamp = now.toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    let photoUrl = '';
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

      photoUrl = publicUrl;
    } catch (err) {
      console.error('Error uploading photo:', err);
      const reader = new FileReader();
      reader.onload = () => {
        photoUrl = reader.result as string;
      };
      reader.readAsDataURL(file);
    }

    const location = await getCurrentLocation();
    const coordsStr = location?.status === 'available' 
      ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`
      : 'Ubicación no disponible';

    setFotoSalida(photoUrl);
    setHorarioSalida(timestamp);
    setUbicacionSalida(coordsStr);
    setLocationSalida(location);

    toast.success('Foto de salida capturada');
  };

  const handleSubmit = async () => {
    if (!empleadoId) {
      toast.error('Selecciona un empleado');
      return;
    }

    if (!oficinaEnabled && selectedEventIds.length === 0) {
      toast.error('Selecciona al menos oficina o un evento como contexto');
      return;
    }

    if (!fotoLlegada && !horarioLlegada && !existingRecord?.llegada) {
      toast.error('Debes registrar la llegada');
      return;
    }

    setLoading(true);
    try {
      const dia = format(fecha, 'yyyy-MM-dd');
      const empleado = empleados.find(e => e.id === empleadoId);
      const cargo = empleado?.cargo || '';

      // Build evento_nombre based on context
      const contextParts: string[] = [];
      if (oficinaEnabled) contextParts.push('Oficina');
      selectedEventIds.forEach(eventId => {
        const project = projects.find(p => p.id === eventId);
        if (project) contextParts.push(project.evento);
      });
      const eventoNombre = contextParts.join(' + ');

      // Determine categoria
      const categoria = oficinaEnabled && selectedEventIds.length === 0 ? 'Oficina' : 'Evento';

      if (existingRecord) {
        // Update existing record
        await updateHorario(existingRecord.id, {
          evento_nombre: eventoNombre,
          evento_id: selectedEventIds.length > 0 ? selectedEventIds[0] : null,
          categoria,
          llegada: horarioLlegada || existingRecord.llegada,
          ubicacion_llegada: ubicacionLlegada || existingRecord.ubicacion_llegada,
          salida: horarioSalida || existingRecord.salida,
          ubicacion_salida: ubicacionSalida || existingRecord.ubicacion_salida,
          foto_llegada: fotoLlegada || existingRecord.foto_llegada,
          foto_salida: fotoSalida || existingRecord.foto_salida,
        });
      } else {
        // Create new single daily record
        await addHorario({
          empleado_id: empleadoId,
          evento_id: selectedEventIds.length > 0 ? selectedEventIds[0] : null,
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
      }

      toast.success('Horario guardado');
      resetForm();
      onOpenChange(false);
    } catch (err) {
      console.error('Error saving horario:', err);
      toast.error('Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmpleadoId(null);
    setFecha(new Date());
    setSelectedEventIds([]);
    setOficinaEnabled(false);
    setEventoSearch('');
    setExistingRecord(null);
    setFotoLlegada('');
    setHorarioLlegada('');
    setUbicacionLlegada('');
    setLocationLlegada(null);
    setFotoSalida('');
    setHorarioSalida('');
    setUbicacionSalida('');
    setLocationSalida(null);
  };

  const clearLlegada = () => {
    if (!llegadaRegistered) {
      setFotoLlegada('');
      setHorarioLlegada('');
      setUbicacionLlegada('');
      setLocationLlegada(null);
    }
  };

  const clearSalida = () => {
    if (!salidaRegistered) {
      setFotoSalida('');
      setHorarioSalida('');
      setUbicacionSalida('');
      setLocationSalida(null);
    }
  };

  const showRegistrationForm = empleadoId && (oficinaEnabled || selectedEventIds.length > 0);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {children && <DialogTrigger asChild>{children}</DialogTrigger>}
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

              {/* Single Registration Section */}
              {showRegistrationForm ? (
                <div className="border border-border rounded-lg p-4 space-y-6">
                  {/* Context Summary */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {oficinaEnabled && (
                      <span className="inline-flex items-center gap-1 bg-primary/20 text-primary px-2 py-1 rounded text-xs">
                        <Building2 className="h-3 w-3" />
                        Oficina
                      </span>
                    )}
                    {selectedEventIds.map(eventId => {
                      const project = projects.find(p => p.id === eventId);
                      return (
                        <span key={eventId} className="inline-flex items-center gap-1 bg-primary/20 text-primary px-2 py-1 rounded text-xs">
                          <Star className="h-3 w-3" />
                          {project?.evento || 'Evento'}
                        </span>
                      );
                    })}
                  </div>

                  {/* LLEGADA */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-lg font-bold uppercase">Llegada</Label>
                      {llegadaRegistered && (
                        <span className="text-xs bg-green-500/20 text-green-500 px-2 py-1 rounded-full flex items-center gap-1">
                          <Check className="h-3 w-3" />
                          Registrada
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      {/* Foto */}
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Foto</Label>
                        <div className="border-2 border-dashed border-border rounded-lg p-3 min-h-[100px] flex flex-col items-center justify-center">
                          {fotoLlegada || existingRecord?.foto_llegada ? (
                            <div className="relative w-full">
                              <img 
                                src={fotoLlegada || existingRecord?.foto_llegada} 
                                alt="Llegada" 
                                className="w-full h-20 object-cover rounded" 
                              />
                              {!llegadaRegistered && fotoLlegada && (
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  className="absolute -top-2 -right-2 h-6 w-6"
                                  onClick={clearLlegada}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setCameraLlegadaOpen(true)}
                              disabled={llegadaRegistered}
                              className="gap-2"
                            >
                              <Camera className="h-4 w-4" />
                              Tomar foto
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Ubicación */}
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          Ubicación
                        </Label>
                        <Input
                          value={ubicacionLlegada || existingRecord?.ubicacion_llegada || ''}
                          readOnly
                          placeholder="--"
                          className="bg-muted/50 cursor-not-allowed text-sm"
                        />
                        {getGoogleMapsLink(locationLlegada) && (
                          <a
                            href={getGoogleMapsLink(locationLlegada)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Ver ubicación en Google Maps
                          </a>
                        )}
                      </div>

                      {/* Horario */}
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Horario
                        </Label>
                        <Input
                          value={horarioLlegada || existingRecord?.llegada || ''}
                          readOnly
                          placeholder="--:--"
                          className="bg-muted/50 cursor-not-allowed font-mono text-lg font-bold"
                        />
                      </div>
                    </div>
                  </div>

                  {/* SALIDA */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-lg font-bold uppercase">Salida</Label>
                      {salidaRegistered && (
                        <span className="text-xs bg-green-500/20 text-green-500 px-2 py-1 rounded-full flex items-center gap-1">
                          <Check className="h-3 w-3" />
                          Registrada
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      {/* Foto */}
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Foto</Label>
                        <div className="border-2 border-dashed border-border rounded-lg p-3 min-h-[100px] flex flex-col items-center justify-center">
                          {fotoSalida || existingRecord?.foto_salida ? (
                            <div className="relative w-full">
                              <img 
                                src={fotoSalida || existingRecord?.foto_salida} 
                                alt="Salida" 
                                className="w-full h-20 object-cover rounded" 
                              />
                              {!salidaRegistered && fotoSalida && (
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  className="absolute -top-2 -right-2 h-6 w-6"
                                  onClick={clearSalida}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setCameraSalidaOpen(true)}
                                disabled={salidaRegistered || !hasLlegada}
                                className="gap-2"
                              >
                                <Camera className="h-4 w-4" />
                                Tomar foto
                              </Button>
                              {!hasLlegada && (
                                <p className="text-xs text-muted-foreground">Registra llegada primero</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Ubicación */}
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          Ubicación
                        </Label>
                        <Input
                          value={ubicacionSalida || existingRecord?.ubicacion_salida || ''}
                          readOnly
                          placeholder="--"
                          className="bg-muted/50 cursor-not-allowed text-sm"
                        />
                        {getGoogleMapsLink(locationSalida) && (
                          <a
                            href={getGoogleMapsLink(locationSalida)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Ver ubicación en Google Maps
                          </a>
                        )}
                      </div>

                      {/* Horario */}
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Horario
                        </Label>
                        <Input
                          value={horarioSalida || existingRecord?.salida || ''}
                          readOnly
                          placeholder="--:--"
                          className="bg-muted/50 cursor-not-allowed font-mono text-lg font-bold"
                        />
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
              ) : (
                <div className="text-center text-muted-foreground py-12 border-2 border-dashed border-border rounded-lg">
                  <p className="text-sm">Selecciona un empleado y luego activa Oficina o selecciona eventos como contexto</p>
                </div>
              )}
            </div>

            {/* Right Panel - Date + Context Selection */}
            <div className="w-72 border-l border-border pl-6 space-y-6">
              {/* Fecha */}
              <div className="space-y-2">
                <Label className="text-sm font-bold uppercase">Fecha</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(fecha, "PPP", { locale: es })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={fecha}
                      onSelect={(date) => date && setFecha(date)}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Oficina Toggle */}
              <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-primary" />
                  <div>
                    <Label className="text-sm font-bold">OFICINA</Label>
                    <p className="text-xs text-muted-foreground">Registro de oficina</p>
                  </div>
                </div>
                <Switch
                  checked={oficinaEnabled}
                  onCheckedChange={setOficinaEnabled}
                  disabled={!empleadoId}
                />
              </div>

              {/* Eventos */}
              <div className="space-y-3">
                <Label className="text-sm font-bold uppercase">Eventos</Label>
                
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={eventoSearch}
                    onChange={(e) => setEventoSearch(e.target.value)}
                    placeholder="Buscar evento..."
                    className="pl-9"
                    disabled={!empleadoId}
                  />
                </div>

                <p className="text-[10px] text-muted-foreground">
                  Eventos del {format(fecha, "d 'de' MMMM", { locale: es })}
                  {empleadoId && ' • Los asignados aparecen primero'}
                </p>

                <div className="border border-border rounded-lg bg-background max-h-48 overflow-y-auto">
                  {filteredEvents.length > 0 ? (
                    filteredEvents.map((event) => {
                      const isAssigned = isEmployeeAssignedToEvent(event, empleadoId);
                      const isSelected = selectedEventIds.includes(event.id);
                      
                      return (
                        <div
                          key={event.id}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 hover:bg-muted cursor-pointer border-b border-border last:border-b-0",
                            isSelected && "bg-primary/10"
                          )}
                          onClick={() => empleadoId && toggleEventSelection(event.id)}
                        >
                          <Checkbox 
                            checked={isSelected}
                            disabled={!empleadoId}
                            className="pointer-events-none"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">{event.evento}</p>
                            {isAssigned && (
                              <p className="text-[10px] text-primary flex items-center gap-1">
                                <Star className="h-3 w-3 fill-primary" />
                                Asignado
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No hay eventos para esta fecha
                    </div>
                  )}
                </div>

                {selectedEventIds.length > 0 && (
                  <p className="text-xs text-primary">
                    {selectedEventIds.length} evento{selectedEventIds.length > 1 ? 's' : ''} seleccionado{selectedEventIds.length > 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>
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
