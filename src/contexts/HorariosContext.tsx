import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

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
  const { user, loading: authLoading } = useAuth();
  const dataLoadedRef = useRef(false);

  const fetchHorarios = async () => {
    console.log('[HorariosContext] Fetching horarios...');
    
    try {
      const { data, error, status } = await supabase
        .from('horarios')
        .select('*')
        .order('dia', { ascending: false });

      console.log('[HorariosContext] Query response - Status:', status, 'Records:', data?.length);
      
      if (error) {
        console.error('[HorariosContext] DB error:', error.message, error.code);
        throw error;
      }
      
      if (!data || data.length === 0) {
        console.log('[HorariosContext] No horarios found');
        setHorarios([]);
        setLoading(false);
        return;
      }
      
      // Fetch employee names (including deleted employees)
      const empleadoIds = [...new Set(data.map(h => h.empleado_id).filter(Boolean))] as string[];
      let empleadosMap: Record<string, { nombre: string; deleted: boolean }> = {};
      
      if (empleadoIds.length > 0) {
        const { data: empleados } = await supabase
          .from('employees')
          .select('id, nombre, deleted_at')
          .in('id', empleadoIds);
        
        if (empleados) {
          empleados.forEach(e => {
            empleadosMap[e.id] = { nombre: e.nombre, deleted: !!e.deleted_at };
          });
        }
        
        // Fetch deleted employees via RPC
        const missingIds = empleadoIds.filter(id => !empleadosMap[id]);
        for (const id of missingIds) {
          try {
            const { data: nombre } = await supabase.rpc('get_employee_name_by_id', { _employee_id: id });
            if (nombre) {
              empleadosMap[id] = { nombre, deleted: true };
            }
          } catch (err) {
            console.error('[HorariosContext] RPC error:', id, err);
          }
        }
      }

      const horariosWithNames = data.map(h => ({
        ...h,
        empleado_nombre: h.empleado_id ? empleadosMap[h.empleado_id]?.nombre || '' : '',
        empleado_deleted: h.empleado_id ? empleadosMap[h.empleado_id]?.deleted || false : false
      })) as Horario[];

      console.log('[HorariosContext] Loaded', horariosWithNames.length, 'horarios');
      setHorarios(horariosWithNames);
    } catch (error) {
      console.error('[HorariosContext] Error fetching horarios:', error);
      toast.error('Error al cargar horarios');
    } finally {
      setLoading(false);
    }
  };

  // Conditional fetch: only when user is authenticated
  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      setLoading(false);
      setHorarios([]);
      dataLoadedRef.current = false;
      return;
    }

    if (dataLoadedRef.current) return;

    console.log('[HorariosContext] User authenticated, fetching horarios...');
    dataLoadedRef.current = true;
    fetchHorarios();

    const channel = supabase
      .channel('horarios-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'horarios' },
        () => fetchHorarios()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, authLoading]);

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
