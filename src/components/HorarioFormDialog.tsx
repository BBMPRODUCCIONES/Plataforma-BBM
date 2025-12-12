import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { EmpleadoAutocomplete } from '@/components/EmpleadoAutocomplete';
import { useHorarios, Horario } from '@/contexts/HorariosContext';
import { useProjects } from '@/contexts/ProjectsContext';
import { useEmpleados } from '@/contexts/EmpleadosContext';
import { supabase } from '@/integrations/supabase/client';
import { Camera, Upload, CalendarIcon, Search, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface HorarioFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const HorarioFormDialog = ({ open, onOpenChange }: HorarioFormDialogProps) => {
  const { addHorario } = useHorarios();
  const { projects } = useProjects();
  const { empleados } = useEmpleados();
  const [loading, setLoading] = useState(false);

  // Form state
  const [empleadoId, setEmpleadoId] = useState<string | null>(null);
  const [empleadoNombre, setEmpleadoNombre] = useState('');
  const [categoria, setCategoria] = useState<'Oficina' | 'Evento'>('Oficina');
  const [fechaEvento, setFechaEvento] = useState<Date | undefined>(undefined);
  const [eventoId, setEventoId] = useState<string | null>(null);
  const [eventoNombre, setEventoNombre] = useState('');
  const [eventoSearch, setEventoSearch] = useState('');
  const [showEventoDropdown, setShowEventoDropdown] = useState(false);

  // Llegada
  const [fotoLlegada, setFotoLlegada] = useState<string>('');
  const [ubicacionLlegada, setUbicacionLlegada] = useState('');
  const [horarioLlegada, setHorarioLlegada] = useState('08:00');

  // Salida
  const [fotoSalida, setFotoSalida] = useState<string>('');
  const [ubicacionSalida, setUbicacionSalida] = useState('');
  const [horarioSalida, setHorarioSalida] = useState('18:00');

  const fileInputLlegadaRef = useRef<HTMLInputElement>(null);
  const fileInputSalidaRef = useRef<HTMLInputElement>(null);

  // Filter events based on search
  const filteredEvents = projects.filter(p => 
    p.evento.toLowerCase().includes(eventoSearch.toLowerCase())
  );

  const handleSelectEvento = (project: typeof projects[0]) => {
    setEventoId(project.id);
    setEventoNombre(project.evento);
    setEventoSearch(project.evento);
    setShowEventoDropdown(false);
  };

  const handlePhotoUpload = async (file: File, type: 'llegada' | 'salida') => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `horario-${type}-${Date.now()}.${fileExt}`;
      const filePath = `horarios/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('notes-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('notes-images')
        .getPublicUrl(filePath);

      if (type === 'llegada') {
        setFotoLlegada(publicUrl);
      } else {
        setFotoSalida(publicUrl);
      }
      toast.success('Foto subida correctamente');
    } catch (err) {
      console.error('Error uploading photo:', err);
      toast.error('Error al subir la foto');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'llegada' | 'salida') => {
    const file = e.target.files?.[0];
    if (file) {
      handlePhotoUpload(file, type);
    }
  };

  const validateTime = (time: string) => {
    return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
  };

  const handleSubmit = async () => {
    if (!empleadoId) {
      toast.error('Selecciona un empleado');
      return;
    }
    if (!validateTime(horarioLlegada) || !validateTime(horarioSalida)) {
      toast.error('El horario debe estar en formato 24h (ej: 08:00)');
      return;
    }
    if (categoria === 'Evento' && !fechaEvento) {
      toast.error('Selecciona una fecha para el evento');
      return;
    }

    setLoading(true);
    try {
      const dia = categoria === 'Evento' && fechaEvento 
        ? format(fechaEvento, 'yyyy-MM-dd')
        : format(new Date(), 'yyyy-MM-dd');

      // Get cargo from empleado
      const empleado = empleados.find(e => e.id === empleadoId);
      const cargo = empleado?.cargo || '';

      await addHorario({
        empleado_id: empleadoId,
        evento_id: eventoId,
        evento_nombre: eventoNombre,
        cargo,
        dia,
        categoria,
        llegada: horarioLlegada,
        ubicacion_llegada: ubicacionLlegada,
        salida: horarioSalida,
        ubicacion_salida: ubicacionSalida,
      });

      // Reset form
      setEmpleadoId(null);
      setEmpleadoNombre('');
      setCategoria('Oficina');
      setFechaEvento(undefined);
      setEventoId(null);
      setEventoNombre('');
      setEventoSearch('');
      setFotoLlegada('');
      setUbicacionLlegada('');
      setHorarioLlegada('08:00');
      setFotoSalida('');
      setUbicacionSalida('');
      setHorarioSalida('18:00');

      onOpenChange(false);
    } catch (err) {
      console.error('Error creating horario:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">GESTIÓN DE HORARIOS</DialogTitle>
        </DialogHeader>

        <div className="flex gap-6">
          {/* Left Panel - Main Form */}
          <div className="flex-1 space-y-6">
            {/* Nombre */}
            <div className="space-y-2">
              <Label className="text-sm font-bold uppercase">Nombre</Label>
              <EmpleadoAutocomplete
                value={empleadoNombre}
                onChange={(nombre, id) => {
                  setEmpleadoNombre(nombre);
                  setEmpleadoId(id || null);
                }}
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
                          onClick={() => setFotoLlegada('')}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          ref={fileInputLlegadaRef}
                          onChange={(e) => handleFileChange(e, 'llegada')}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputLlegadaRef.current?.click()}
                        >
                          <Upload className="h-4 w-4 mr-1" />
                          Subir
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Ubicación */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase text-muted-foreground">Ubicación</Label>
                  <Input
                    value={ubicacionLlegada}
                    onChange={(e) => setUbicacionLlegada(e.target.value)}
                    placeholder="Ubicación llegada"
                  />
                </div>

                {/* Horario */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase text-muted-foreground">Horario</Label>
                  <Input
                    value={horarioLlegada}
                    onChange={(e) => setHorarioLlegada(e.target.value)}
                    placeholder="08:00"
                    maxLength={5}
                  />
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
                          onClick={() => setFotoSalida('')}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          ref={fileInputSalidaRef}
                          onChange={(e) => handleFileChange(e, 'salida')}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputSalidaRef.current?.click()}
                        >
                          <Upload className="h-4 w-4 mr-1" />
                          Subir
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Ubicación */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase text-muted-foreground">Ubicación</Label>
                  <Input
                    value={ubicacionSalida}
                    onChange={(e) => setUbicacionSalida(e.target.value)}
                    placeholder="Ubicación salida"
                  />
                </div>

                {/* Horario */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase text-muted-foreground">Horario</Label>
                  <Input
                    value={horarioSalida}
                    onChange={(e) => setHorarioSalida(e.target.value)}
                    placeholder="18:00"
                    maxLength={5}
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

          {/* Right Panel - Event Selection (only if categoria === 'Evento') */}
          {categoria === 'Evento' && (
            <div className="w-72 border-l border-border pl-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-bold uppercase">Fecha</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !fechaEvento && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {fechaEvento ? format(fechaEvento, "PPP", { locale: es }) : "Seleccionar fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={fechaEvento}
                      onSelect={setFechaEvento}
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

                {showEventoDropdown && filteredEvents.length > 0 && (
                  <div className="border border-border rounded-md bg-background max-h-60 overflow-y-auto shadow-lg">
                    {filteredEvents.map((event) => (
                      <button
                        key={event.id}
                        className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                        onClick={() => handleSelectEvento(event)}
                      >
                        {event.evento}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
