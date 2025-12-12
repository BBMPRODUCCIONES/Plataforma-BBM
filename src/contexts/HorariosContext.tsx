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
  categoria: 'Oficina' | 'Evento';
  llegada: string;
  ubicacion_llegada: string;
  salida: string;
  ubicacion_salida: string;
  foto_llegada?: string;
  foto_salida?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  empleado_nombre?: string;
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
    try {
      const { data, error } = await supabase
        .from('horarios')
        .select('*')
        .order('dia', { ascending: false });

      console.log('[HorariosContext] Raw data from DB:', data?.length, 'records');
      if (error) {
        console.error('[HorariosContext] DB error:', error);
        throw error;
      }
      
      // Fetch employee names
      const empleadoIds = [...new Set(data?.map(h => h.empleado_id).filter(Boolean))];
      let empleadosMap: Record<string, string> = {};
      
      if (empleadoIds.length > 0) {
        const { data: empleados } = await supabase
          .from('employees')
          .select('id, nombre')
          .in('id', empleadoIds);
        
        if (empleados) {
          empleadosMap = empleados.reduce((acc, e) => ({ ...acc, [e.id]: e.nombre }), {});
        }
      }

      const horariosWithNames = (data || []).map(h => ({
        ...h,
        empleado_nombre: h.empleado_id ? empleadosMap[h.empleado_id] || '' : ''
      })) as Horario[];

      console.log('[HorariosContext] Setting horarios state:', horariosWithNames.length, 'records');
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
