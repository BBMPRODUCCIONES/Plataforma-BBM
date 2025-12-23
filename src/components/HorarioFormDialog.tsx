import { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { EmpleadoAutocomplete } from '@/components/EmpleadoAutocomplete';
import { CameraCapture } from '@/components/CameraCapture';
import { useHorarios, Horario } from '@/contexts/HorariosContext';
import { useProjects } from '@/contexts/ProjectsContext';
import { Project } from '@/types';
import { useEmpleados } from '@/contexts/EmpleadosContext';
import { supabase } from '@/integrations/supabase/client';
import { CalendarIcon, Search, Trash2, MapPin, Clock, Check, Camera, ExternalLink, Building2, Star, Save, AlertTriangle, Home, X, ChevronDown, ChevronUp } from 'lucide-react';
import { format, parseISO, isWithinInterval, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
interface HorarioFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEmpleadoId?: string;
  children?: React.ReactNode;
  /** Mode: 'field' = Panel Operaciones (locked employee + today only), 'admin' = Empleados page (full control) */
  mode?: 'field' | 'admin';
  /** Lock employee selector (used in field mode) */
  lockEmpleado?: boolean;
  /** Lock date to today only (used in field mode) */
  lockFecha?: boolean;
}

interface LocationData {
  lat: number;
  lng: number;
  address?: string;
  accuracy?: number;
  provider?: string;
  status?: 'available' | 'unavailable' | 'denied' | 'error';
}

interface SalidaContingencia {
  foto: string;
  horario: string;
  ubicacion: string;
  timestamp: string;
  lat?: number;
  lng?: number;
  accuracy_m?: number;
  maps_url?: string;
  location_status?: string;
  contexto?: ContingenciaContexto;
}

interface ContingenciaContexto {
  oficina: boolean;
  casa: boolean;
  eventos: string[];
  eventoNombres: string[];
  // Persisted in backend inside contingencia_contexto
  contingencia_timestamp?: string; // ISO when photo was captured
  contingencia_grace_until?: string; // ISO end of 5-min grace period
  last_saved_at?: string; // ISO when context was last saved
}


export const HorarioFormDialog = ({ 
  open, 
  onOpenChange, 
  defaultEmpleadoId, 
  children,
  mode = 'admin',
  lockEmpleado = false,
  lockFecha = false
}: HorarioFormDialogProps) => {
  const { addHorario, updateHorario, refetch } = useHorarios();
  const { projects } = useProjects();
  const { empleados } = useEmpleados();
  const [loading, setLoading] = useState(false);
  
  // Derived flags based on mode
  const isFieldMode = mode === 'field';
  const isEmpleadoLocked = isFieldMode || lockEmpleado;
  const isFechaLocked = isFieldMode || lockFecha;

  // Form state
  const [empleadoId, setEmpleadoId] = useState<string | null>(null);
  const [fecha, setFecha] = useState<Date>(new Date());
  const [eventoSearch, setEventoSearch] = useState('');
  
  // Context selection
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [oficinaEnabled, setOficinaEnabled] = useState(false);
  const [casaEnabled, setCasaEnabled] = useState(false);
  const [contextModified, setContextModified] = useState(false);

  // Single daily record from DB
  const [existingRecord, setExistingRecord] = useState<Horario | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  
  // Local state for new captures (before saving)
  const [fotoLlegada, setFotoLlegada] = useState('');
  const [horarioLlegada, setHorarioLlegada] = useState('');
  const [ubicacionLlegada, setUbicacionLlegada] = useState('');
  const [locationLlegada, setLocationLlegada] = useState<LocationData | null>(null);
  const [fotoSalida, setFotoSalida] = useState('');
  const [horarioSalida, setHorarioSalida] = useState('');
  const [ubicacionSalida, setUbicacionSalida] = useState('');
  const [locationSalida, setLocationSalida] = useState<LocationData | null>(null);

  // Contingency exit state
  const [salidaContingencia, setSalidaContingencia] = useState<SalidaContingencia | null>(null);
  const [cameraContingenciaOpen, setCameraContingenciaOpen] = useState(false);
  
  // Contingency context selection (step 2 after photo)
  const [showContingenciaContextDialog, setShowContingenciaContextDialog] = useState(false);
  const [contingenciaContexto, setContingenciaContexto] = useState<ContingenciaContexto>({
    oficina: false,
    casa: false,
    eventos: [],
    eventoNombres: [],
  });
  const [pendingContingenciaData, setPendingContingenciaData] = useState<{
    foto: string;
    horario: string;
    ubicacion: string;
    lat?: number;
    lng?: number;
    accuracy_m?: number;
    maps_url?: string;
    location_status?: string;
  } | null>(null);

  // Camera dialogs
  const [cameraLlegadaOpen, setCameraLlegadaOpen] = useState(false);
  const [cameraSalidaOpen, setCameraSalidaOpen] = useState(false);
  
  // Desktop-only: accordion states for collapsible sections
  const isMobile = useIsMobile();
  const [salidaOpen, setSalidaOpen] = useState(true);
  const [contingenciaOpen, setContingenciaOpen] = useState(false);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const MAX_VISIBLE_EVENTS = 5;
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
      p.empleado_id === empId || p.empleadoId === empId || p.personal === empId || p.nombre === empleados.find(e => e.id === empId)?.nombre
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

  // Load existing record directly from DB for employee + date (unique key)
  const loadExistingRecord = useCallback(async () => {
    if (!empleadoId) {
      setExistingRecord(null);
      clearLocalState();
      return;
    }

    const dia = format(fecha, 'yyyy-MM-dd');
    setLoadingRecord(true);

    try {
      // Query directly from DB for this employee + date
      const { data, error } = await supabase
        .from('horarios')
        .select('*')
        .eq('empleado_id', empleadoId)
        .eq('dia', dia)
        .maybeSingle();

      if (error) {
        console.error('Error loading horario:', error);
        setExistingRecord(null);
        clearLocalState();
        return;
      }

      if (data) {
        const record = data as Horario;
        setExistingRecord(record);
        
        // Populate local state from existing record
        setFotoLlegada(record.foto_llegada || '');
        setHorarioLlegada(record.llegada || '');
        setUbicacionLlegada(record.ubicacion_llegada || '');
        setLocationLlegada(parseLocationFromString(record.ubicacion_llegada));
        setFotoSalida(record.foto_salida || '');
        setHorarioSalida(record.salida || '');
        setUbicacionSalida(record.ubicacion_salida || '');
        setLocationSalida(parseLocationFromString(record.ubicacion_salida));
        
        // Load contingency exit if exists
        if (record.contingencia_foto || record.contingencia_hora) {
          const rawContexto = record.contingencia_contexto as Record<string, any> | undefined;
          const parsedContexto: ContingenciaContexto = {
            oficina: !!rawContexto?.oficina,
            casa: !!rawContexto?.casa,
            eventos: Array.isArray(rawContexto?.eventos) ? rawContexto.eventos : [],
            eventoNombres: Array.isArray(rawContexto?.eventoNombres) ? rawContexto.eventoNombres : [],
            contingencia_timestamp: rawContexto?.contingencia_timestamp ?? rawContexto?.timestamp,
            contingencia_grace_until: rawContexto?.contingencia_grace_until,
            last_saved_at: rawContexto?.last_saved_at ?? rawContexto?.timestamp,
          };
          
          const contingenciaData: SalidaContingencia = {
            foto: record.contingencia_foto || '',
            horario: record.contingencia_hora || '',
            ubicacion: record.contingencia_ubicacion || '',
            timestamp: record.updated_at || '',
            lat: record.contingencia_lat || undefined,
            lng: record.contingencia_lng || undefined,
            accuracy_m: record.contingencia_accuracy_m || undefined,
            maps_url: record.contingencia_maps_url || '',
            location_status: record.contingencia_location_status || '',
            contexto: parsedContexto,
          };
          setSalidaContingencia(contingenciaData);
          setContingenciaContexto(parsedContexto);
        } else {
          setSalidaContingencia(null);
          setContingenciaContexto({
            oficina: false,
            casa: false,
            eventos: [],
            eventoNombres: [],
          });
        }
        
        // Parse context from record
        setOficinaEnabled(record.categoria === 'Oficina' || record.evento_nombre?.includes('Oficina') || false);
        setCasaEnabled(record.evento_nombre?.includes('Casa') || false);
        if (record.evento_id) {
          setSelectedEventIds([record.evento_id]);
        } else {
          setSelectedEventIds([]);
        }
      } else {
        setExistingRecord(null);
        clearLocalState();
      }
    } catch (err) {
      console.error('Error in loadExistingRecord:', err);
      setExistingRecord(null);
      clearLocalState();
    } finally {
      setLoadingRecord(false);
    }
  }, [empleadoId, fecha]);

  const clearLocalState = () => {
    setFotoLlegada('');
    setHorarioLlegada('');
    setUbicacionLlegada('');
    setLocationLlegada(null);
    setFotoSalida('');
    setHorarioSalida('');
    setUbicacionSalida('');
    setLocationSalida(null);
    setOficinaEnabled(false);
    setCasaEnabled(false);
    setSelectedEventIds([]);
    setSalidaContingencia(null);
    setContextModified(false);
    setContingenciaContexto({
      oficina: false,
      casa: false,
      eventos: [],
      eventoNombres: [],
    });
    setPendingContingenciaData(null);
    setShowContingenciaContextDialog(false);
  };

  // Load record when employee or date changes
  useEffect(() => {
    if (open) {
      loadExistingRecord();
    }
  }, [loadExistingRecord, open]);

  // Reset event selections when date changes (only if no existing record)
  useEffect(() => {
    if (!existingRecord) {
      setSelectedEventIds([]);
      setOficinaEnabled(false);
      setCasaEnabled(false);
    }
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
    setContextModified(true);
    setSelectedEventIds(prev => {
      if (prev.includes(eventId)) {
        return prev.filter(id => id !== eventId);
      }
      return [...prev, eventId];
    });
  };

  const handleOficinaToggle = (checked: boolean) => {
    setContextModified(true);
    setOficinaEnabled(checked);
  };

  const handleCasaToggle = (checked: boolean) => {
    setContextModified(true);
    setCasaEnabled(checked);
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
            // Address lookup failed silently - not critical
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

  // Check if llegada/salida are already registered in DB
  const llegadaRegistered = Boolean(existingRecord?.foto_llegada && existingRecord?.llegada);
  const salidaRegistered = Boolean(existingRecord?.foto_salida && existingRecord?.salida);
  const hasLlegada = llegadaRegistered || (fotoLlegada && horarioLlegada);

  // Save to backend immediately when capturing photo
  const saveToBackend = async (type: 'llegada' | 'salida', data: {
    foto: string;
    horario: string;
    ubicacion: string;
    location: LocationData | null;
  }) => {
    if (!empleadoId) {
      toast.error('Debes seleccionar un empleado de la lista');
      return false;
    }

    // Validate context is selected
    if (!oficinaEnabled && !casaEnabled && selectedEventIds.length === 0) {
      toast.error('Selecciona al menos oficina, casa o un evento como contexto');
      return false;
    }

    // FIELD MODE: Block saving if date is not today
    if (isFieldMode) {
      const today = format(new Date(), 'yyyy-MM-dd');
      const selectedDay = format(fecha, 'yyyy-MM-dd');
      if (selectedDay !== today) {
        toast.error('En Panel de Operaciones solo puedes registrar el día de hoy');
        return false;
      }
    }

    const dia = format(fecha, 'yyyy-MM-dd');
    const empleado = empleados.find(e => e.id === empleadoId);
    const cargo = empleado?.cargo || '';

    // Build evento_nombre based on context
    const contextParts: string[] = [];
    if (oficinaEnabled) contextParts.push('Oficina');
    if (casaEnabled) contextParts.push('Casa');
    selectedEventIds.forEach(eventId => {
      const project = projects.find(p => p.id === eventId);
      if (project) contextParts.push(project.evento);
    });
    const eventoNombre = contextParts.join(' + ') || 'Sin contexto';
    const categoria = (oficinaEnabled || casaEnabled) && selectedEventIds.length === 0 
      ? (oficinaEnabled ? 'Oficina' : 'Casa') 
      : 'Evento';

    // Build Google Maps link
    const mapsUrl = data.location?.status === 'available' && data.location.lat !== 0
      ? `https://www.google.com/maps?q=${data.location.lat},${data.location.lng}`
      : '';

    // Prepare ubicacion string with all metadata
    const ubicacionFull = data.location?.status === 'available' && data.location.lat !== 0
      ? `${data.location.lat.toFixed(6)}, ${data.location.lng.toFixed(6)}`
      : `Ubicación no disponible (${data.location?.status || 'unknown'})`;

    try {
      if (existingRecord) {
        // Update existing record
        const updateData: Partial<Horario> = {
          evento_nombre: eventoNombre,
          evento_id: selectedEventIds.length > 0 ? selectedEventIds[0] : null,
          categoria,
        };

        if (type === 'llegada') {
          updateData.foto_llegada = data.foto;
          updateData.llegada = data.horario;
          updateData.ubicacion_llegada = ubicacionFull;
        } else {
          updateData.foto_salida = data.foto;
          updateData.salida = data.horario;
          updateData.ubicacion_salida = ubicacionFull;
        }

        const { error } = await supabase
          .from('horarios')
          .update(updateData)
          .eq('id', existingRecord.id);

        if (error) throw error;
      } else {
        // Create new record
        const newRecord: any = {
          empleado_id: empleadoId,
          evento_id: selectedEventIds.length > 0 ? selectedEventIds[0] : null,
          evento_nombre: eventoNombre,
          cargo,
          dia,
          categoria,
          llegada: type === 'llegada' ? data.horario : '',
          ubicacion_llegada: type === 'llegada' ? ubicacionFull : '',
          salida: type === 'salida' ? data.horario : '',
          ubicacion_salida: type === 'salida' ? ubicacionFull : '',
          foto_llegada: type === 'llegada' ? data.foto : '',
          foto_salida: type === 'salida' ? data.foto : '',
        };

        const { error } = await supabase
          .from('horarios')
          .insert([newRecord]);

        if (error) throw error;
      }

      // Refresh from backend
      await loadExistingRecord();
      await refetch();
      
      return true;
    } catch (err) {
      console.error('Error saving to backend:', err);
      toast.error('Error al guardar en base de datos');
      return false;
    }
  };

  const handleCaptureLlegada = async (file: File) => {
    // Validate employee is selected from database
    if (!empleadoId) {
      toast.error('Debes seleccionar un empleado de la lista');
      setCameraLlegadaOpen(false);
      return;
    }

    // Validate context is selected
    if (!oficinaEnabled && !casaEnabled && selectedEventIds.length === 0) {
      toast.error('Selecciona oficina, casa o al menos un evento como contexto');
      setCameraLlegadaOpen(false);
      return;
    }

    if (llegadaRegistered) {
      toast.error('Ya registraste tu llegada hoy. No puedes registrar otra llegada.');
      return;
    }

    setLoading(true);
    setCameraLlegadaOpen(false);

    const now = new Date();
    const timestamp = now.toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    let photoUrl = '';
    try {
      const fileName = `horario-llegada-${empleadoId}-${Date.now()}.jpg`;
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
      toast.error('Error al subir la foto');
      setLoading(false);
      return;
    }

    const location = await getCurrentLocation();
    const coordsStr = location?.status === 'available' 
      ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`
      : 'Ubicación no disponible';

    // Save immediately to backend
    const success = await saveToBackend('llegada', {
      foto: photoUrl,
      horario: timestamp,
      ubicacion: coordsStr,
      location
    });

    if (success) {
      toast.success('Llegada registrada correctamente');
    }

    setLoading(false);
  };

  const handleCaptureSalida = async (file: File) => {
    // Validate employee is selected from database
    if (!empleadoId) {
      toast.error('Debes seleccionar un empleado de la lista');
      setCameraSalidaOpen(false);
      return;
    }

    // Validate context is selected
    if (!oficinaEnabled && selectedEventIds.length === 0) {
      toast.error('Selecciona oficina o al menos un evento como contexto');
      setCameraSalidaOpen(false);
      return;
    }

    if (salidaRegistered) {
      toast.error('Ya registraste tu salida hoy. No puedes registrar otra salida.');
      return;
    }

    if (!hasLlegada) {
      toast.error('Debes registrar tu llegada antes de registrar la salida.');
      return;
    }

    setLoading(true);
    setCameraSalidaOpen(false);

    const now = new Date();
    const timestamp = now.toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    let photoUrl = '';
    try {
      const fileName = `horario-salida-${empleadoId}-${Date.now()}.jpg`;
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
      toast.error('Error al subir la foto');
      setLoading(false);
      return;
    }

    const location = await getCurrentLocation();
    const coordsStr = location?.status === 'available' 
      ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`
      : 'Ubicación no disponible';

    // Save immediately to backend
    const success = await saveToBackend('salida', {
      foto: photoUrl,
      horario: timestamp,
      ubicacion: coordsStr,
      location
    });

    if (success) {
      toast.success('Salida registrada correctamente');
    }

    setLoading(false);
  };

  // Save context changes without losing llegada
  const handleSaveContextChanges = async () => {
    if (!existingRecord || !empleadoId) {
      toast.error('No hay registro existente para actualizar');
      return;
    }

    if (!oficinaEnabled && !casaEnabled && selectedEventIds.length === 0) {
      toast.error('Selecciona al menos oficina, casa o un evento como contexto');
      return;
    }

    setLoading(true);

    // Build new context string
    const contextParts: string[] = [];
    if (oficinaEnabled) contextParts.push('Oficina');
    if (casaEnabled) contextParts.push('Casa');
    selectedEventIds.forEach(eventId => {
      const project = projects.find(p => p.id === eventId);
      if (project) contextParts.push(project.evento);
    });
    const eventoNombre = contextParts.join(' + ') || 'Sin contexto';
    const categoria: 'Oficina' | 'Casa' | 'Evento' = (oficinaEnabled || casaEnabled) && selectedEventIds.length === 0 
      ? (oficinaEnabled ? 'Oficina' : 'Casa') 
      : 'Evento';

    try {
      const { error } = await supabase
        .from('horarios')
        .update({
          evento_nombre: eventoNombre,
          evento_id: selectedEventIds.length > 0 ? selectedEventIds[0] : null,
          categoria,
        })
        .eq('id', existingRecord.id);

      if (error) throw error;

      await loadExistingRecord();
      await refetch();
      setContextModified(false);
      toast.success('Contexto actualizado correctamente');
    } catch (err) {
      console.error('Error updating context:', err);
      toast.error('Error al actualizar el contexto');
    } finally {
      setLoading(false);
    }
  };

  // Check if contingency already registered from DB
  const contingenciaRegistered = Boolean(existingRecord?.contingencia_foto || existingRecord?.contingencia_hora);
  
  // Grace period countdown state
  const [graceTimeRemaining, setGraceTimeRemaining] = useState<number | null>(null);
  
  // Calculate grace period end time (must survive refresh)
  // Priority: persisted contingencia_grace_until; fallback to contingencia_timestamp + 5min
  const contingenciaGraceUntil = useMemo(() => {
    const raw = (salidaContingencia?.contexto || (existingRecord?.contingencia_contexto as any | undefined)) as any;
    const graceUntilIso = raw?.contingencia_grace_until;
    if (graceUntilIso) {
      const ms = new Date(graceUntilIso).getTime();
      return Number.isNaN(ms) ? null : ms;
    }

    const capturedIso = raw?.contingencia_timestamp ?? raw?.timestamp;
    if (!capturedIso) return null;
    const capturedMs = new Date(capturedIso).getTime();
    if (Number.isNaN(capturedMs)) return null;

    return capturedMs + 5 * 60 * 1000;
  }, [salidaContingencia, existingRecord?.contingencia_contexto]);
  
  // Check if 5 minutes have passed since contingency was registered (context lock)
  const isContingenciaContextLocked = useMemo(() => {
    if (!contingenciaGraceUntil) return false;
    return Date.now() > contingenciaGraceUntil;
  }, [contingenciaGraceUntil, graceTimeRemaining]); // graceTimeRemaining triggers recalc
  
  // Update countdown timer every second
  useEffect(() => {
    if (!contingenciaGraceUntil || isContingenciaContextLocked) {
      setGraceTimeRemaining(null);
      return;
    }
    
    const updateTimer = () => {
      const remaining = contingenciaGraceUntil - Date.now();
      if (remaining <= 0) {
        setGraceTimeRemaining(0);
      } else {
        setGraceTimeRemaining(remaining);
      }
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    
    return () => clearInterval(interval);
  }, [contingenciaGraceUntil, isContingenciaContextLocked]);
  
  // Format remaining time as MM:SS
  const formatRemainingTime = (ms: number | null): string => {
    if (ms === null || ms <= 0) return '00:00';
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Step 1: Handle contingency photo capture - save foto/hora/ubicacion immediately
  const handleCaptureContingencia = async (file: File) => {
    if (!empleadoId) {
      toast.error('Debes seleccionar un empleado de la lista');
      setCameraContingenciaOpen(false);
      return;
    }

    if (!hasLlegada) {
      toast.error('Debes registrar tu llegada antes de agregar una salida de contingencia');
      setCameraContingenciaOpen(false);
      return;
    }

    // Check if contingency already exists
    if (contingenciaRegistered || salidaContingencia) {
      toast.error('Ya existe una salida de contingencia registrada');
      setCameraContingenciaOpen(false);
      return;
    }

    setLoading(true);
    setCameraContingenciaOpen(false);

    const now = new Date();
    const timestamp = now.toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    let photoUrl = '';
    try {
      const fileName = `horario-contingencia-${empleadoId}-${Date.now()}.jpg`;
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
      console.error('Error uploading contingency photo:', err);
      toast.error('Error al subir la foto de contingencia');
      setLoading(false);
      return;
    }

    const location = await getCurrentLocation();
    const coordsStr = location?.status === 'available' 
      ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`
      : 'Ubicación no disponible';
    const mapsUrl = location?.status === 'available' && location.lat !== 0
      ? `https://www.google.com/maps?q=${location.lat},${location.lng}`
      : '';

    const contingenciaTimestampIso = now.toISOString();
    const contingenciaGraceUntilIso = new Date(now.getTime() + 5 * 60 * 1000).toISOString();

    // Save foto/hora/ubicacion to database immediately (and start grace window)
    try {
      if (!existingRecord) {
        toast.error('No hay registro existente para agregar contingencia');
        setLoading(false);
        return;
      }

      const initialContingenciaContexto: ContingenciaContexto = {
        oficina: false,
        casa: false,
        eventos: [],
        eventoNombres: [],
        contingencia_timestamp: contingenciaTimestampIso,
        contingencia_grace_until: contingenciaGraceUntilIso,
        last_saved_at: undefined,
      };

      const { error } = await supabase
        .from('horarios')
        .update({
          contingencia_foto: photoUrl,
          contingencia_hora: timestamp,
          contingencia_ubicacion: coordsStr,
          contingencia_lat: location?.lat || null,
          contingencia_lng: location?.lng || null,
          contingencia_accuracy_m: location?.accuracy || null,
          contingencia_maps_url: mapsUrl,
          contingencia_location_status: location?.status || 'unavailable',
          contingencia_contexto: JSON.parse(JSON.stringify(initialContingenciaContexto)),
        })
        .eq('id', existingRecord.id);

      if (error) throw error;

      // Store pending data for context dialog
      setPendingContingenciaData({
        foto: photoUrl,
        horario: timestamp,
        ubicacion: coordsStr,
        lat: location?.lat,
        lng: location?.lng,
        accuracy_m: location?.accuracy,
        maps_url: mapsUrl,
        location_status: location?.status,
      });

      // Set local state for display
      setSalidaContingencia({
        foto: photoUrl,
        horario: timestamp,
        ubicacion: coordsStr,
        timestamp: contingenciaTimestampIso,
        lat: location?.lat,
        lng: location?.lng,
        accuracy_m: location?.accuracy,
        maps_url: mapsUrl,
        location_status: location?.status,
        contexto: initialContingenciaContexto,
      });

      // Reset contingency context for selection (but keep grace window persisted)
      setContingenciaContexto(initialContingenciaContexto);

      // Show context selection dialog
      setShowContingenciaContextDialog(true);

      toast.success('Foto guardada. Ahora selecciona el contexto de la contingencia.');
    } catch (err) {
      console.error('Error saving contingency to DB:', err);
      toast.error('Error al guardar la salida de contingencia');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Save contingency context
  const handleSaveContingenciaContext = async () => {
    if (!existingRecord) {
      toast.error('No hay registro existente');
      return;
    }

    if (!contingenciaContexto.oficina && !contingenciaContexto.casa && contingenciaContexto.eventos.length === 0) {
      toast.error('Selecciona al menos oficina, casa o un evento como contexto');
      return;
    }

    setLoading(true);

    // Build event names
    const eventoNombres: string[] = [];
    if (contingenciaContexto.oficina) eventoNombres.push('Oficina');
    if (contingenciaContexto.casa) eventoNombres.push('Casa');
    contingenciaContexto.eventos.forEach(eventId => {
      const project = projects.find(p => p.id === eventId);
      if (project) eventoNombres.push(project.evento);
    });

    const baseRaw = (existingRecord.contingencia_contexto as any) || {};
    const persistedTimestamp = baseRaw.contingencia_timestamp ?? baseRaw.timestamp;
    const contingenciaTimestampIso = typeof persistedTimestamp === 'string' ? persistedTimestamp : new Date().toISOString();
    const persistedGraceUntil = baseRaw.contingencia_grace_until;
    const contingenciaGraceUntilIso = typeof persistedGraceUntil === 'string'
      ? persistedGraceUntil
      : new Date(new Date(contingenciaTimestampIso).getTime() + 5 * 60 * 1000).toISOString();

    const contextoWithTimestamp: ContingenciaContexto = {
      ...contingenciaContexto,
      eventoNombres,
      contingencia_timestamp: contingenciaTimestampIso,
      contingencia_grace_until: contingenciaGraceUntilIso,
      last_saved_at: new Date().toISOString(),
    };

    try {
      const { error } = await supabase
        .from('horarios')
        .update({
          contingencia_contexto: JSON.parse(JSON.stringify(contextoWithTimestamp)),
        })
        .eq('id', existingRecord.id);

      if (error) throw error;

      // Update local state
      if (salidaContingencia) {
        setSalidaContingencia({
          ...salidaContingencia,
          contexto: contextoWithTimestamp,
        });
      }
      setContingenciaContexto(contextoWithTimestamp);
      setShowContingenciaContextDialog(false);
      setPendingContingenciaData(null);

      // Refresh from backend
      await loadExistingRecord();
      await refetch();

      toast.success('Contexto de contingencia guardado correctamente');
    } catch (err) {
      console.error('Error saving contingency context:', err);
      toast.error('Error al guardar el contexto');
    } finally {
      setLoading(false);
    }
  };

  // Toggle contingency context events
  const toggleContingenciaEvent = (eventId: string) => {
    setContingenciaContexto(prev => ({
      ...prev,
      eventos: prev.eventos.includes(eventId)
        ? prev.eventos.filter(id => id !== eventId)
        : [...prev.eventos, eventId],
    }));
  };

  const resetForm = () => {
    setEmpleadoId(null);
    setFecha(new Date());
    setSelectedEventIds([]);
    setOficinaEnabled(false);
    setEventoSearch('');
    setExistingRecord(null);
    clearLocalState();
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

  const showRegistrationForm = empleadoId && (oficinaEnabled || casaEnabled || selectedEventIds.length > 0);

  // Display values from existing record or local state
  const displayFotoLlegada = existingRecord?.foto_llegada || fotoLlegada;
  const displayHorarioLlegada = existingRecord?.llegada || horarioLlegada;
  const displayUbicacionLlegada = existingRecord?.ubicacion_llegada || ubicacionLlegada;
  const displayFotoSalida = existingRecord?.foto_salida || fotoSalida;
  const displayHorarioSalida = existingRecord?.salida || horarioSalida;
  const displayUbicacionSalida = existingRecord?.ubicacion_salida || ubicacionSalida;

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => {
        if (!isOpen) resetForm();
        onOpenChange(isOpen);
      }}>
        {children && <DialogTrigger asChild>{children}</DialogTrigger>}
        <DialogContent className="horario-form-dialog max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="horario-dialog-header">
            <div className="flex items-center justify-between w-full">
              <DialogTitle className="text-2xl font-bold">GESTIÓN DE HORARIOS</DialogTitle>
              {/* Botón cerrar visible en móvil AWC */}
              <Button 
                variant="ghost" 
                size="icon"
                className="horario-close-btn"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </DialogHeader>

          {/* Content: Desktop 2 columns, Mobile flex column */}
          <div className={cn(
            "horario-form-content",
            isMobile && "flex flex-col gap-6"
          )}>
            {/* LEFT COLUMN: Nombre + Contexto + LLEGADA + SALIDA + CONTINGENCIA */}
            <div className={cn("horario-left-column", isMobile && "order-last space-y-6")}>
              {/* Nombre */}
              <div className="space-y-2">
                <Label className="text-sm font-bold uppercase">
                  Nombre
                  {isEmpleadoLocked && (
                    <span className="ml-2 text-xs text-muted-foreground font-normal">(bloqueado)</span>
                  )}
                </Label>
                
                {/* Error prominente en modo field sin empleado */}
                {isFieldMode && !empleadoId && (
                  <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
                    <div>
                      <p className="font-medium text-destructive">No se encontró empleado para este usuario</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Contacta al administrador para vincular tu cuenta de usuario a un empleado en el sistema.
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Nombre bloqueado (modo field con empleado) */}
                {isEmpleadoLocked && empleadoId && (
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md border border-border">
                    <span className="font-medium">{empleados.find(e => e.id === empleadoId)?.nombre || 'Empleado'}</span>
                    <span className="text-xs text-muted-foreground">
                      ({empleados.find(e => e.id === empleadoId)?.cargo || 'Sin cargo'})
                    </span>
                  </div>
                )}
                
                {/* Selector libre (modo admin) */}
                {!isEmpleadoLocked && (
                  <>
                    <EmpleadoAutocomplete
                      value={empleadoId || ''}
                      onChange={(_, id) => {
                        if (id) {
                          setEmpleadoId(id);
                        } else {
                          setEmpleadoId(null);
                        }
                      }}
                      useEmpleadoId={true}
                      placeholder="Buscar empleado..."
                    />
                    {!empleadoId && (
                      <p className="text-xs text-amber-400">* Debes seleccionar un empleado de la lista</p>
                    )}
                  </>
                )}
              </div>

              {/* Context Summary (visible cuando hay contexto) */}
              {(oficinaEnabled || casaEnabled || selectedEventIds.length > 0) && (
                <div className="flex items-center gap-2 flex-wrap p-3 bg-muted/30 rounded-lg border border-border">
                  <span className="text-xs text-muted-foreground">Contexto:</span>
                  {oficinaEnabled && (
                    <span className="inline-flex items-center gap-1 bg-primary/20 text-primary px-2 py-1 rounded text-xs">
                      <Building2 className="h-3 w-3" />
                      Oficina
                    </span>
                  )}
                  {casaEnabled && (
                    <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-500 px-2 py-1 rounded text-xs">
                      <Home className="h-3 w-3" />
                      Casa
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
              )}

              {/* Loading indicator */}
              {loadingRecord && (
                <div className="text-center py-4 text-muted-foreground">
                  Cargando registro...
                </div>
              )}

              {/* REGISTRATION SECTIONS: LLEGADA + SALIDA + CONTINGENCIA */}
              {showRegistrationForm && !loadingRecord && (
                <>
                  {/* LLEGADA */}
                  <div className="horario-registration-section space-y-3">
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
                          {displayFotoLlegada ? (
                            <div className="relative w-full">
                              <img 
                                src={displayFotoLlegada} 
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
                              disabled={llegadaRegistered || loading}
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
                          value={displayUbicacionLlegada || ''}
                          readOnly
                          placeholder="--"
                          className="bg-muted/50 cursor-not-allowed text-sm"
                        />
                        {displayUbicacionLlegada && !displayUbicacionLlegada.includes('no disponible') && (
                          <a
                            href={`https://www.google.com/maps?q=${displayUbicacionLlegada.replace(' ', '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Ver en Maps
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
                          value={displayHorarioLlegada || ''}
                          readOnly
                          placeholder="--:--"
                          className="bg-muted/50 cursor-not-allowed font-mono text-lg font-bold"
                        />
                      </div>
                    </div>
                  </div>

                  {/* SALIDA */}
                  <div className="horario-registration-section space-y-3">
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
                          {displayFotoSalida ? (
                            <div className="relative w-full">
                              <img 
                                src={displayFotoSalida} 
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
                                disabled={salidaRegistered || !hasLlegada || loading}
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
                          value={displayUbicacionSalida || ''}
                          readOnly
                          placeholder="--"
                          className="bg-muted/50 cursor-not-allowed text-sm"
                        />
                        {displayUbicacionSalida && !displayUbicacionSalida.includes('no disponible') && (
                          <a
                            href={`https://www.google.com/maps?q=${displayUbicacionSalida.replace(' ', '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Ver en Maps
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
                          value={displayHorarioSalida || ''}
                          readOnly
                          placeholder="--:--"
                          className="bg-muted/50 cursor-not-allowed font-mono text-lg font-bold"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Save Context Changes Button */}
                  {hasLlegada && !salidaRegistered && contextModified && (
                    <div className="flex justify-center">
                      <Button
                        onClick={handleSaveContextChanges}
                        disabled={loading}
                        className="gap-2"
                      >
                        <Save className="h-4 w-4" />
                        Guardar Cambios de Contexto
                      </Button>
                    </div>
                  )}

                  {/* SALIDA DE CONTINGENCIA */}
                  {hasLlegada && (
                    <div className="horario-registration-section space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-lg font-bold uppercase flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-amber-500" />
                          Salida de Contingencia
                        </Label>
                        {(salidaContingencia || contingenciaRegistered) && (
                          <span className="text-xs bg-amber-500/20 text-amber-500 px-2 py-1 rounded-full flex items-center gap-1">
                            <Check className="h-3 w-3" />
                            Registrada ({salidaContingencia?.horario || existingRecord?.contingencia_hora})
                          </span>
                        )}
                      </div>
                      
                      {/* Context selection dialog after photo capture */}
                      {showContingenciaContextDialog && (
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 space-y-4">
                          <p className="text-sm font-medium text-amber-400">
                            ✅ Foto guardada. Selecciona el contexto de esta salida de contingencia:
                          </p>
                          
                          <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <Checkbox 
                                checked={contingenciaContexto.oficina}
                                onCheckedChange={(checked) => setContingenciaContexto(prev => ({ ...prev, oficina: !!checked }))}
                              />
                              <Building2 className="h-4 w-4" />
                              <span className="text-sm">Oficina</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <Checkbox 
                                checked={contingenciaContexto.casa}
                                onCheckedChange={(checked) => setContingenciaContexto(prev => ({ ...prev, casa: !!checked }))}
                              />
                              <Home className="h-4 w-4" />
                              <span className="text-sm">Casa</span>
                            </label>
                          </div>

                          {filteredEvents.length > 0 && (
                            <div className="space-y-2">
                              <Label className="text-xs">Eventos:</Label>
                              <div className="max-h-32 overflow-y-auto border border-border rounded">
                                {filteredEvents.map(event => (
                                  <div
                                    key={event.id}
                                    className={cn(
                                      "flex items-center gap-2 px-2 py-1 hover:bg-muted cursor-pointer text-sm",
                                      contingenciaContexto.eventos.includes(event.id) && "bg-primary/10"
                                    )}
                                    onClick={() => toggleContingenciaEvent(event.id)}
                                  >
                                    <Checkbox
                                      checked={contingenciaContexto.eventos.includes(event.id)}
                                      onCheckedChange={() => toggleContingenciaEvent(event.id)}
                                      aria-label={`Seleccionar evento ${event.evento}`}
                                    />
                                    <span className="truncate">{event.evento}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <Button onClick={handleSaveContingenciaContext} disabled={loading} className="w-full gap-2">
                            <Save className="h-4 w-4" />
                            Confirmar Contexto
                          </Button>
                          <p className="text-[10px] text-muted-foreground">Tendrás 5 minutos para modificar el contexto después de guardar.</p>
                        </div>
                      )}
                      
                      {(salidaContingencia || contingenciaRegistered) && !showContingenciaContextDialog ? (
                        <div className="space-y-3 bg-amber-500/5 p-3 rounded-lg">
                          {/* Grace period banner with countdown */}
                          {!isContingenciaContextLocked && graceTimeRemaining !== null && graceTimeRemaining > 0 && (
                            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-green-400 flex items-center gap-2">
                                  ✅ Puedes ajustar Oficina/Casa/Eventos durante los próximos:
                                </p>
                                <span className="text-lg font-mono font-bold text-green-400 bg-green-500/20 px-2 py-0.5 rounded">
                                  {formatRemainingTime(graceTimeRemaining)}
                                </span>
                              </div>
                            </div>
                          )}
                          
                          {/* Locked banner */}
                          {isContingenciaContextLocked && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2">
                              <p className="text-xs text-red-400 text-center">
                                🔒 Periodo de edición finalizado. El contexto de contingencia ya no puede modificarse.
                              </p>
                            </div>
                          )}
                          
                          {/* Editable context during grace period */}
                          {!isContingenciaContextLocked && graceTimeRemaining !== null && graceTimeRemaining > 0 && (
                            <div className="space-y-3 border border-green-500/20 rounded-lg p-3">
                              <Label className="text-xs text-muted-foreground">Editar contexto de contingencia:</Label>
                              <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <Checkbox 
                                    checked={contingenciaContexto.oficina}
                                    onCheckedChange={(checked) => setContingenciaContexto(prev => ({ ...prev, oficina: !!checked }))}
                                  />
                                  <Building2 className="h-4 w-4" />
                                  <span className="text-sm">Oficina</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <Checkbox 
                                    checked={contingenciaContexto.casa}
                                    onCheckedChange={(checked) => setContingenciaContexto(prev => ({ ...prev, casa: !!checked }))}
                                  />
                                  <Home className="h-4 w-4" />
                                  <span className="text-sm">Casa</span>
                                </label>
                              </div>

                              {filteredEvents.length > 0 && (
                                <div className="space-y-2">
                                  <Label className="text-xs">Eventos:</Label>
                                  <div className="max-h-24 overflow-y-auto border border-border rounded">
                                    {filteredEvents.map(event => (
                                      <div
                                        key={event.id}
                                        className={cn(
                                          "flex items-center gap-2 px-2 py-1 hover:bg-muted cursor-pointer text-sm",
                                          contingenciaContexto.eventos.includes(event.id) && "bg-primary/10"
                                        )}
                                        onClick={() => toggleContingenciaEvent(event.id)}
                                      >
                                        <Checkbox
                                          checked={contingenciaContexto.eventos.includes(event.id)}
                                          onCheckedChange={() => toggleContingenciaEvent(event.id)}
                                          aria-label={`Seleccionar evento ${event.evento}`}
                                        />
                                        <span className="truncate">{event.evento}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <Button onClick={handleSaveContingenciaContext} disabled={loading} className="w-full gap-2 bg-green-600 hover:bg-green-700">
                                <Save className="h-4 w-4" />
                                Guardar cambios (Contingencia)
                              </Button>
                            </div>
                          )}
                          
                          {/* Contexto de contingencia chips */}
                          {(salidaContingencia?.contexto || existingRecord?.contingencia_contexto) && (
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-muted-foreground">Contexto guardado:</span>
                              {(salidaContingencia?.contexto?.oficina || (existingRecord?.contingencia_contexto as ContingenciaContexto)?.oficina) && (
                                <span className="inline-flex items-center gap-1 bg-primary/20 text-primary px-2 py-0.5 rounded text-xs">
                                  <Building2 className="h-3 w-3" />Oficina
                                </span>
                              )}
                              {(salidaContingencia?.contexto?.casa || (existingRecord?.contingencia_contexto as ContingenciaContexto)?.casa) && (
                                <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded text-xs">
                                  <Home className="h-3 w-3" />Casa
                                </span>
                              )}
                              {(salidaContingencia?.contexto?.eventoNombres || (existingRecord?.contingencia_contexto as ContingenciaContexto)?.eventoNombres)?.filter(n => n !== 'Oficina' && n !== 'Casa').map((nombre, i) => (
                                <span key={i} className="inline-flex items-center gap-1 bg-primary/20 text-primary px-2 py-0.5 rounded text-xs">
                                  <Star className="h-3 w-3" />{nombre}
                                </span>
                              ))}
                            </div>
                          )}
                          
                          <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">Foto</Label>
                              <img src={salidaContingencia?.foto || existingRecord?.contingencia_foto || ''} alt="Contingencia" className="w-full h-20 object-cover rounded" />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />Ubicación</Label>
                              <Input value={salidaContingencia?.ubicacion || existingRecord?.contingencia_ubicacion || ''} readOnly className="bg-muted/50 cursor-not-allowed text-sm" />
                              {(salidaContingencia?.maps_url || existingRecord?.contingencia_maps_url) && (
                                <a href={salidaContingencia?.maps_url || existingRecord?.contingencia_maps_url || ''} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                                  <ExternalLink className="h-3 w-3" />Ver en Maps
                                </a>
                              )}
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />Horario</Label>
                              <Input value={salidaContingencia?.horario || existingRecord?.contingencia_hora || ''} readOnly className="bg-muted/50 cursor-not-allowed font-mono text-lg font-bold" />
                            </div>
                          </div>
                        </div>
                      ) : !salidaContingencia && !contingenciaRegistered && !showContingenciaContextDialog && (
                        <div className="flex items-center justify-center py-4">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setCameraContingenciaOpen(true)}
                            disabled={loading}
                            className="gap-2 border-amber-500/50 text-amber-500 hover:bg-amber-500/10"
                          >
                            <AlertTriangle className="h-4 w-4" />
                            Agregar salida de contingencia
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* No context selected message */}
              {!showRegistrationForm && !loadingRecord && empleadoId && (
                <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
                  <p>Selecciona al menos oficina, casa o un evento para comenzar el registro</p>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Fecha + Oficina/Casa + Eventos */}
            <div className={cn("horario-right-column", isMobile && "order-first space-y-4")}>
              {/* Fecha */}
              <div className="space-y-2">
                <Label className="text-sm font-bold uppercase">
                  Fecha
                  {isFechaLocked && (
                    <span className="ml-2 text-xs text-muted-foreground font-normal">(solo hoy)</span>
                  )}
                </Label>
                {isFechaLocked ? (
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md border border-border">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{format(fecha, "PPP", { locale: es })}</span>
                  </div>
                ) : (
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
                )}
                {isFechaLocked && (
                  <p className="text-xs text-muted-foreground">En este panel solo puedes registrar el día de hoy.</p>
                )}
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
                  onCheckedChange={handleOficinaToggle}
                  disabled={!empleadoId || salidaRegistered}
                />
              </div>

              {/* Casa Toggle */}
              <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <Home className="h-5 w-5 text-amber-500" />
                  <div>
                    <Label className="text-sm font-bold">CASA</Label>
                    <p className="text-xs text-muted-foreground">Trabajo remoto</p>
                  </div>
                </div>
                <Switch
                  checked={casaEnabled}
                  onCheckedChange={handleCasaToggle}
                  disabled={!empleadoId || salidaRegistered}
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

                {/* Events list */}
                <div className={cn(
                  "border border-border rounded-lg bg-background",
                  isMobile ? "max-h-48 overflow-y-auto" : "horario-events-list-desktop"
                )}>
                  {filteredEvents.length > 0 ? (
                    <>
                      {(isMobile || showAllEvents ? filteredEvents : filteredEvents.slice(0, MAX_VISIBLE_EVENTS)).map((event) => {
                        const isAssigned = isEmployeeAssignedToEvent(event, empleadoId);
                        const isSelected = selectedEventIds.includes(event.id);
                        
                        return (
                          <div
                            key={event.id}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2 hover:bg-muted cursor-pointer border-b border-border last:border-b-0",
                              isSelected && "bg-primary/10"
                            )}
                            onClick={() => empleadoId && !salidaRegistered && toggleEventSelection(event.id)}
                          >
                            <Checkbox 
                              checked={isSelected}
                              disabled={!empleadoId || salidaRegistered}
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
                      })}
                    </>
                  ) : (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No hay eventos para esta fecha
                    </div>
                  )}
                </div>

                {/* Ver más button (Desktop only) */}
                {!isMobile && filteredEvents.length > MAX_VISIBLE_EVENTS && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full text-xs h-8">
                        Ver {filteredEvents.length - MAX_VISIBLE_EVENTS} eventos más
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 max-h-64 overflow-y-auto p-0" align="start">
                      <div className="p-2 border-b border-border">
                        <p className="text-xs font-medium">Todos los eventos ({filteredEvents.length})</p>
                      </div>
                      {filteredEvents.map((event) => {
                        const isAssigned = isEmployeeAssignedToEvent(event, empleadoId);
                        const isSelected = selectedEventIds.includes(event.id);
                        
                        return (
                          <div
                            key={event.id}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2 hover:bg-muted cursor-pointer border-b border-border last:border-b-0",
                              isSelected && "bg-primary/10"
                            )}
                            onClick={() => empleadoId && !salidaRegistered && toggleEventSelection(event.id)}
                          >
                            <Checkbox 
                              checked={isSelected}
                              disabled={!empleadoId || salidaRegistered}
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
                      })}
                    </PopoverContent>
                  </Popover>
                )}

                {selectedEventIds.length > 0 && (
                  <p className="text-xs text-primary">
                    {selectedEventIds.length} evento{selectedEventIds.length > 1 ? 's' : ''} seleccionado{selectedEventIds.length > 1 ? 's' : ''}
                  </p>
                )}

                {salidaRegistered && (
                  <p className="text-xs text-amber-400">
                    El contexto no puede modificarse después de registrar salida
                  </p>
                )}
              </div>
            </div>
          </div>



          {/* Footer con botón Salir - solo visible en móvil AWC */}
          <div className="horario-dialog-footer">
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => onOpenChange(false)}
            >
              Salir
            </Button>
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
      <CameraCapture
        open={cameraContingenciaOpen}
        onOpenChange={setCameraContingenciaOpen}
        onCapture={handleCaptureContingencia}
      />
    </>
  );
};
