import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Horario {
  id: string;
  empleado_id: string | null;
  evento_id: string | null;
  evento_nombre: string;
  cargo: string;
  dia: string;
  categoria: 'Oficina' | 'Casa' | 'Evento';
  llegada: string;
  ubicacion_llegada: string;
  salida: string;
  ubicacion_salida: string;
  foto_llegada?: string;
  foto_salida?: string;
  // Contingency exit fields
  contingencia_foto?: string | null;
  contingencia_hora?: string | null;
  contingencia_ubicacion?: string | null;
  contingencia_lat?: number | null;
  contingencia_lng?: number | null;
  contingencia_accuracy_m?: number | null;
  contingencia_maps_url?: string | null;
  contingencia_location_status?: string | null;
  contingencia_contexto?: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  empleado_nombre?: string;
  empleado_deleted?: boolean;
}

interface HorariosContextType {
  horarios: Horario[];
  loading: boolean;
  addHorario: (horario: Omit<Horario, 'id' | 'created_at' | 'updated_at'>) => Promise<Horario | null>;
  updateHorario: (id: string, data: Partial<Horario>) => Promise<void>;
  deleteHorario: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

const HorariosContext = createContext<HorariosContextType | undefined>(undefined);

export const HorariosProvider = ({ children }: { children: ReactNode }) => {
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHorarios = async () => {
    console.log('[HorariosContext] Fetching horarios...');
    
    // Log current auth status
    const { data: { user } } = await supabase.auth.getUser();
    console.log('[HorariosContext] Current user:', user?.id, user?.email);
    
    try {
      const { data, error, status } = await supabase
        .from('horarios')
        .select('*')
        .order('dia', { ascending: false });

      console.log('[HorariosContext] Query response - Status:', status, 'Records:', data?.length);
      
      if (error) {
        console.error('[HorariosContext] DB error:', error.message, error.code, error.details);
        throw error;
      }
      
      if (!data || data.length === 0) {
        console.log('[HorariosContext] No horarios found in database');
        setHorarios([]);
        setLoading(false);
        return;
      }
      
      console.log('[HorariosContext] Raw horarios data:', data.map(h => ({
        id: h.id,
        empleado_id: h.empleado_id,
        dia: h.dia,
        evento_nombre: h.evento_nombre,
        categoria: h.categoria
      })));
      
      // Fetch employee names (including active employees)
      const empleadoIds = [...new Set(data.map(h => h.empleado_id).filter(Boolean))] as string[];
      let empleadosMap: Record<string, { nombre: string; deleted: boolean }> = {};
      
      if (empleadoIds.length > 0) {
        console.log('[HorariosContext] Fetching employee names for IDs:', empleadoIds);
        
        // First, get active employees
        const { data: empleados, error: empError } = await supabase
          .from('employees')
          .select('id, nombre, deleted_at')
          .in('id', empleadoIds);
        
        if (empError) {
          console.error('[HorariosContext] Error fetching employees:', empError);
        }
        
        if (empleados) {
          empleados.forEach(e => {
            empleadosMap[e.id] = { 
              nombre: e.nombre, 
              deleted: !!e.deleted_at 
            };
          });
          console.log('[HorariosContext] Active employee map:', Object.keys(empleadosMap).length);
        }
        
        // Find missing IDs (soft-deleted employees not returned by RLS)
        const missingIds = empleadoIds.filter(id => !empleadosMap[id]);
        
        if (missingIds.length > 0) {
          console.log('[HorariosContext] Fetching deleted employees via RPC:', missingIds);
          
          // Fetch names for deleted employees using the RPC function
          for (const id of missingIds) {
            try {
              const { data: nombre, error: rpcError } = await supabase.rpc('get_employee_name_by_id', { 
                _employee_id: id 
              });
              
              if (!rpcError && nombre) {
                empleadosMap[id] = { nombre, deleted: true };
                console.log('[HorariosContext] Found deleted employee:', id, nombre);
              }
            } catch (err) {
              console.error('[HorariosContext] RPC error for employee:', id, err);
            }
          }
        }
      }

      const horariosWithNames = data.map(h => ({
        ...h,
        empleado_nombre: h.empleado_id ? empleadosMap[h.empleado_id]?.nombre || '' : '',
        empleado_deleted: h.empleado_id ? empleadosMap[h.empleado_id]?.deleted || false : false
      })) as Horario[];

      console.log('[HorariosContext] Final horarios with names:', horariosWithNames.length, 'records');
      setHorarios(horariosWithNames);
    } catch (error) {
      console.error('[HorariosContext] Error fetching horarios:', error);
      toast.error('Error al cargar horarios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHorarios();

    const channel = supabase
      .channel('horarios-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'horarios' },
        () => {
          fetchHorarios();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const addHorario = async (horario: Omit<Horario, 'id' | 'created_at' | 'updated_at'>): Promise<Horario | null> => {
    try {
      const { data, error } = await supabase
        .from('horarios')
        .insert([{
          empleado_id: horario.empleado_id,
          evento_id: horario.evento_id,
          evento_nombre: horario.evento_nombre,
          cargo: horario.cargo,
          dia: horario.dia,
          categoria: horario.categoria,
          llegada: horario.llegada,
          ubicacion_llegada: horario.ubicacion_llegada,
          salida: horario.salida,
          ubicacion_salida: horario.ubicacion_salida,
          foto_llegada: horario.foto_llegada || '',
          foto_salida: horario.foto_salida || ''
        }])
        .select()
        .single();

      if (error) throw error;
      
      toast.success('Horario agregado');
      return data as Horario;
    } catch (error) {
      console.error('Error adding horario:', error);
      toast.error('Error al agregar horario');
      return null;
    }
  };

  const updateHorario = async (id: string, data: Partial<Horario>) => {
    try {
      const { error } = await supabase
        .from('horarios')
        .update(data)
        .eq('id', id);

      if (error) throw error;
      toast.success('Horario actualizado');
    } catch (error) {
      console.error('Error updating horario:', error);
      toast.error('Error al actualizar horario');
    }
  };

  const deleteHorario = async (id: string) => {
    try {
      const { error } = await supabase
        .from('horarios')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setHorarios(prev => prev.filter(h => h.id !== id));
      toast.success('Horario eliminado');
    } catch (error) {
      console.error('Error deleting horario:', error);
      toast.error('Error al eliminar horario');
    }
  };

  return (
    <HorariosContext.Provider value={{
      horarios,
      loading,
      addHorario,
      updateHorario,
      deleteHorario,
      refetch: fetchHorarios
    }}>
      {children}
    </HorariosContext.Provider>
  );
};

export const useHorarios = () => {
  const context = useContext(HorariosContext);
  if (context === undefined) {
    throw new Error('useHorarios must be used within a HorariosProvider');
  }
  return context;
};
