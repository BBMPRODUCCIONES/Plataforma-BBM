import { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { CalendarIcon, Search, Trash2, MapPin, Clock, Check, AlertCircle, Camera, ExternalLink, Building2, Star } from 'lucide-react';
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
  accuracy?: number;
  provider?: string;
  status?: 'available' | 'unavailable' | 'denied' | 'error';
}

interface SelectedEvent {
  id: string;
  nombre: string;
  isAssigned: boolean; // true if employee is assigned to this event
}

// Structure to track registrations per type (oficina or each event)
interface RegistrationState {
  tipo: 'Oficina' | 'Evento';
  eventoId?: string;
  eventoNombre?: string;
  existingRecord: Horario | null;
  fotoLlegada: string;
  ubicacionLlegada: string;
  horarioLlegada: string;
  locationLlegada: LocationData | null;
  fotoSalida: string;
  ubicacionSalida: string;
  horarioSalida: string;
  locationSalida: LocationData | null;
}

export const HorarioFormDialog = ({ open, onOpenChange }: HorarioFormDialogProps) => {
  const { addHorario, updateHorario, horarios } = useHorarios();
  const { projects } = useProjects();
  const { empleados } = useEmpleados();
  const [loading, setLoading] = useState(false);

  // Form state
  const [empleadoId, setEmpleadoId] = useState<string | null>(null);
  const [fecha, setFecha] = useState<Date>(new Date());
  const [eventoSearch, setEventoSearch] = useState('');
  
  // New: multi-select events and oficina toggle
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [oficinaEnabled, setOficinaEnabled] = useState(false);

  // Active registration being captured (which one is currently open for camera)
  const [activeRegistration, setActiveRegistration] = useState<string | null>(null); // 'oficina' or event id

  // Registration states per type
  const [registrations, setRegistrations] = useState<Map<string, RegistrationState>>(new Map());

  // Camera dialogs
  const [cameraLlegadaOpen, setCameraLlegadaOpen] = useState(false);
  const [cameraSalidaOpen, setCameraSalidaOpen] = useState(false);

  // Filter events by selected date (montaje or ejecucion)
  const eventsForDate = useMemo(() => {
    if (!fecha) return [];
    
    return projects.filter(project => {
      try {
        // Check montaje dates
        if (project.fechaMontajeInicio && project.fechaMontajeFin) {
          const montajeStart = parseISO(project.fechaMontajeInicio);
          const montajeEnd = parseISO(project.fechaMontajeFin);
          const isInMontaje = isWithinInterval(fecha, { start: montajeStart, end: montajeEnd }) ||
            isSameDay(fecha, montajeStart) || isSameDay(fecha, montajeEnd);
          if (isInMontaje) return true;
        }

        // Check ejecucion dates
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

  // Check if employee is assigned to an event (in personal array)
  const isEmployeeAssignedToEvent = useCallback((project: Project, empId: string | null): boolean => {
    if (!empId || !project.personal) return false;
    
    // personal is an array of objects with empleado_id or similar
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

  // Load existing records for the employee + date combination
  const loadExistingRecords = useCallback(() => {
    if (!empleadoId) {
      setRegistrations(new Map());
      return;
    }

    const dia = format(fecha, 'yyyy-MM-dd');
    const newRegistrations = new Map<string, RegistrationState>();

    // Check for oficina record
    const oficinaRecord = horarios.find(h => 
      h.empleado_id === empleadoId && 
      h.dia === dia && 
      h.categoria === 'Oficina'
    );

    if (oficinaRecord || oficinaEnabled) {
      newRegistrations.set('oficina', {
        tipo: 'Oficina',
        existingRecord: oficinaRecord || null,
        fotoLlegada: oficinaRecord?.foto_llegada || '',
        ubicacionLlegada: oficinaRecord?.ubicacion_llegada || '',
        horarioLlegada: oficinaRecord?.llegada || '',
        locationLlegada: parseLocationFromString(oficinaRecord?.ubicacion_llegada),
        fotoSalida: oficinaRecord?.foto_salida || '',
        ubicacionSalida: oficinaRecord?.ubicacion_salida || '',
        horarioSalida: oficinaRecord?.salida || '',
        locationSalida: parseLocationFromString(oficinaRecord?.ubicacion_salida),
      });
    }

    // Check for event records
    selectedEventIds.forEach(eventId => {
      const eventRecord = horarios.find(h => 
        h.empleado_id === empleadoId && 
        h.dia === dia && 
        h.categoria === 'Evento' &&
        h.evento_id === eventId
      );
      const project = projects.find(p => p.id === eventId);

      newRegistrations.set(eventId, {
        tipo: 'Evento',
        eventoId: eventId,
        eventoNombre: project?.evento || eventRecord?.evento_nombre || '',
        existingRecord: eventRecord || null,
        fotoLlegada: eventRecord?.foto_llegada || '',
        ubicacionLlegada: eventRecord?.ubicacion_llegada || '',
        horarioLlegada: eventRecord?.llegada || '',
        locationLlegada: parseLocationFromString(eventRecord?.ubicacion_llegada),
        fotoSalida: eventRecord?.foto_salida || '',
        ubicacionSalida: eventRecord?.ubicacion_salida || '',
        horarioSalida: eventRecord?.salida || '',
        locationSalida: parseLocationFromString(eventRecord?.ubicacion_salida),
      });
    });

    setRegistrations(newRegistrations);
  }, [empleadoId, fecha, horarios, oficinaEnabled, selectedEventIds, projects]);

  useEffect(() => {
    loadExistingRecords();
  }, [loadExistingRecords]);

  // Reset selections when date changes
  useEffect(() => {
    setSelectedEventIds([]);
    setEventoSearch('');
  }, [fecha]);

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

  const handleCaptureLlegada = async (file: File) => {
    if (!activeRegistration) return;

    const reg = registrations.get(activeRegistration);
    if (!reg) return;

    // Check if already registered
    if (reg.existingRecord?.foto_llegada && reg.existingRecord?.llegada) {
      toast.error('Ya registraste tu llegada. No puedes registrar otra llegada.');
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

    setRegistrations(prev => {
      const updated = new Map(prev);
      const current = updated.get(activeRegistration);
      if (current) {
        updated.set(activeRegistration, {
          ...current,
          fotoLlegada: photoUrl,
          horarioLlegada: timestamp,
          ubicacionLlegada: coordsStr,
          locationLlegada: location,
        });
      }
      return updated;
    });

    toast.success('Foto de llegada capturada');
  };

  const handleCaptureSalida = async (file: File) => {
    if (!activeRegistration) return;

    const reg = registrations.get(activeRegistration);
    if (!reg) return;

    // Check if already registered
    if (reg.existingRecord?.foto_salida && reg.existingRecord?.salida) {
      toast.error('Ya registraste tu salida. No puedes registrar otra salida.');
      return;
    }

    // Check if llegada exists
    const hasLlegada = (reg.existingRecord?.foto_llegada && reg.existingRecord?.llegada) || reg.fotoLlegada;
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

    setRegistrations(prev => {
      const updated = new Map(prev);
      const current = updated.get(activeRegistration);
      if (current) {
        updated.set(activeRegistration, {
          ...current,
          fotoSalida: photoUrl,
          horarioSalida: timestamp,
          ubicacionSalida: coordsStr,
          locationSalida: location,
        });
      }
      return updated;
    });

    toast.success('Foto de salida capturada');
  };

  const handleSubmit = async () => {
    if (!empleadoId) {
      toast.error('Selecciona un empleado');
      return;
    }

    if (!oficinaEnabled && selectedEventIds.length === 0) {
      toast.error('Selecciona al menos oficina o un evento');
      return;
    }

    // Check each registration has at least llegada
    for (const [key, reg] of registrations) {
      if (!reg.fotoLlegada && !reg.horarioLlegada && !reg.existingRecord?.llegada) {
        const label = key === 'oficina' ? 'Oficina' : reg.eventoNombre;
        toast.error(`Debes registrar la llegada para ${label}`);
        return;
      }
    }

    setLoading(true);
    try {
      const dia = format(fecha, 'yyyy-MM-dd');
      const empleado = empleados.find(e => e.id === empleadoId);
      const cargo = empleado?.cargo || '';

      for (const [key, reg] of registrations) {
        if (reg.existingRecord) {
          // Update existing record
          await updateHorario(reg.existingRecord.id, {
            llegada: reg.horarioLlegada || reg.existingRecord.llegada,
            ubicacion_llegada: reg.ubicacionLlegada || reg.existingRecord.ubicacion_llegada,
            salida: reg.horarioSalida || reg.existingRecord.salida,
            ubicacion_salida: reg.ubicacionSalida || reg.existingRecord.ubicacion_salida,
            foto_llegada: reg.fotoLlegada || reg.existingRecord.foto_llegada,
            foto_salida: reg.fotoSalida || reg.existingRecord.foto_salida,
          });
        } else {
          // Create new record
          await addHorario({
            empleado_id: empleadoId,
            evento_id: reg.tipo === 'Evento' ? reg.eventoId || null : null,
            evento_nombre: reg.tipo === 'Evento' ? reg.eventoNombre || '' : 'Oficina',
            cargo,
            dia,
            categoria: reg.tipo,
            llegada: reg.horarioLlegada || '',
            ubicacion_llegada: reg.ubicacionLlegada,
            salida: reg.horarioSalida || '',
            ubicacion_salida: reg.ubicacionSalida,
            foto_llegada: reg.fotoLlegada,
            foto_salida: reg.fotoSalida,
          });
        }
      }

      toast.success('Horarios guardados');
      resetForm();
      onOpenChange(false);
    } catch (err) {
      console.error('Error saving horarios:', err);
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
    setRegistrations(new Map());
    setActiveRegistration(null);
  };

  const clearLlegada = (key: string) => {
    setRegistrations(prev => {
      const updated = new Map(prev);
      const current = updated.get(key);
      if (current && !current.existingRecord?.foto_llegada) {
        updated.set(key, {
          ...current,
          fotoLlegada: '',
          horarioLlegada: '',
          ubicacionLlegada: '',
          locationLlegada: null,
        });
      }
      return updated;
    });
  };

  const clearSalida = (key: string) => {
    setRegistrations(prev => {
      const updated = new Map(prev);
      const current = updated.get(key);
      if (current && !current.existingRecord?.foto_salida) {
        updated.set(key, {
          ...current,
          fotoSalida: '',
          horarioSalida: '',
          ubicacionSalida: '',
          locationSalida: null,
        });
      }
      return updated;
    });
  };

  const renderRegistrationSection = (key: string, reg: RegistrationState) => {
    const llegadaRegistered = Boolean(reg.existingRecord?.foto_llegada && reg.existingRecord?.llegada);
    const salidaRegistered = Boolean(reg.existingRecord?.foto_salida && reg.existingRecord?.salida);
    const hasLlegada = llegadaRegistered || reg.fotoLlegada;
    const label = key === 'oficina' ? 'Oficina' : reg.eventoNombre;

    return (
      <div key={key} className="border border-border rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-2">
          {key === 'oficina' ? (
            <Building2 className="h-5 w-5 text-primary" />
          ) : (
            <Star className="h-5 w-5 text-primary" />
          )}
          <h3 className="font-bold text-lg">{label}</h3>
        </div>

        {/* Llegada */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-bold uppercase">Llegada</Label>
            {llegadaRegistered && (
              <span className="text-xs bg-green-500/20 text-green-500 px-2 py-1 rounded-full flex items-center gap-1">
                <Check className="h-3 w-3" />
                Registrada
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {/* Foto */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Foto</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-2 min-h-[80px] flex flex-col items-center justify-center">
                {reg.fotoLlegada || reg.existingRecord?.foto_llegada ? (
                  <div className="relative w-full">
                    <img 
                      src={reg.fotoLlegada || reg.existingRecord?.foto_llegada} 
                      alt="Llegada" 
                      className="w-full h-16 object-cover rounded" 
                    />
                    {!llegadaRegistered && reg.fotoLlegada && (
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-5 w-5"
                        onClick={() => clearLlegada(key)}
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
                    onClick={() => {
                      setActiveRegistration(key);
                      setCameraLlegadaOpen(true);
                    }}
                    disabled={llegadaRegistered}
                    className="gap-1 text-xs"
                  >
                    <Camera className="h-3 w-3" />
                    Tomar foto
                  </Button>
                )}
              </div>
            </div>

            {/* Ubicación */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                Ubicación
              </Label>
              <Input
                value={reg.ubicacionLlegada || reg.existingRecord?.ubicacion_llegada || ''}
                readOnly
                placeholder="--"
                className="bg-muted/50 cursor-not-allowed text-xs h-8"
              />
              {getGoogleMapsLink(reg.locationLlegada) && (
                <a
                  href={getGoogleMapsLink(reg.locationLlegada)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-primary hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  Ver en Maps
                </a>
              )}
            </div>

            {/* Horario */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Horario
              </Label>
              <Input
                value={reg.horarioLlegada || reg.existingRecord?.llegada || ''}
                readOnly
                placeholder="--:--"
                className="bg-muted/50 cursor-not-allowed font-mono text-xs h-8"
              />
            </div>
          </div>
        </div>

        {/* Salida */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-bold uppercase">Salida</Label>
            {salidaRegistered && (
              <span className="text-xs bg-green-500/20 text-green-500 px-2 py-1 rounded-full flex items-center gap-1">
                <Check className="h-3 w-3" />
                Registrada
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {/* Foto */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Foto</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-2 min-h-[80px] flex flex-col items-center justify-center">
                {reg.fotoSalida || reg.existingRecord?.foto_salida ? (
                  <div className="relative w-full">
                    <img 
                      src={reg.fotoSalida || reg.existingRecord?.foto_salida} 
                      alt="Salida" 
                      className="w-full h-16 object-cover rounded" 
                    />
                    {!salidaRegistered && reg.fotoSalida && (
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-5 w-5"
                        onClick={() => clearSalida(key)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setActiveRegistration(key);
                        setCameraSalidaOpen(true);
                      }}
                      disabled={salidaRegistered || !hasLlegada}
                      className="gap-1 text-xs"
                    >
                      <Camera className="h-3 w-3" />
                      Tomar foto
                    </Button>
                    {!hasLlegada && (
                      <p className="text-[9px] text-muted-foreground">Registra llegada primero</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Ubicación */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                Ubicación
              </Label>
              <Input
                value={reg.ubicacionSalida || reg.existingRecord?.ubicacion_salida || ''}
                readOnly
                placeholder="--"
                className="bg-muted/50 cursor-not-allowed text-xs h-8"
              />
              {getGoogleMapsLink(reg.locationSalida) && (
                <a
                  href={getGoogleMapsLink(reg.locationSalida)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-primary hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  Ver en Maps
                </a>
              )}
            </div>

            {/* Horario */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Horario
              </Label>
              <Input
                value={reg.horarioSalida || reg.existingRecord?.salida || ''}
                readOnly
                placeholder="--:--"
                className="bg-muted/50 cursor-not-allowed font-mono text-xs h-8"
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
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

              {/* Registration Sections */}
              <div className="space-y-4">
                {registrations.size === 0 && (
                  <div className="text-center text-muted-foreground py-8 border-2 border-dashed border-border rounded-lg">
                    <p>Selecciona un empleado y luego activa Oficina o selecciona eventos</p>
                  </div>
                )}
                {Array.from(registrations.entries()).map(([key, reg]) => 
                  renderRegistrationSection(key, reg)
                )}
              </div>

              {/* Submit Button */}
              {registrations.size > 0 && (
                <Button
                  onClick={handleSubmit}
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? 'Guardando...' : 'Guardar Horarios'}
                </Button>
              )}
            </div>

            {/* Right Panel - Date + Event Selection + Oficina Toggle */}
            <div className="w-80 border-l border-border pl-6 space-y-6">
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

                <div className="border border-border rounded-lg bg-background max-h-52 overflow-y-auto">
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
