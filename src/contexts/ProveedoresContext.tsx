import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Proveedor } from '@/types';

interface ProveedoresContextType {
  proveedores: Proveedor[];
  loading: boolean;
  addProveedor: (proveedor: Omit<Proveedor, 'id'>) => Promise<Proveedor | null>;
  updateProveedor: (id: string, field: string, value: any) => Promise<void>;
  deleteProveedor: (id: string) => Promise<void>;
  refreshProveedores: () => Promise<void>;
}

const ProveedoresContext = createContext<ProveedoresContextType | null>(null);

// Map DB row to Proveedor type
const dbRowToProveedor = (row: any): Proveedor => ({
  id: row.id,
  categoria: row.categoria || '',
  nombre: row.nombre || '',
  telefono: row.telefono || '',
  correo: row.correo || '',
  tipoProductoServicio: row.tipo_producto_servicio || '',
  notas: row.notas || '',
  cotizacionesAnteriores: row.cotizaciones || [],
});

// Map Proveedor to DB row
const proveedorToDbRow = (proveedor: Partial<Proveedor>): Record<string, any> => {
  const row: Record<string, any> = {};
  if (proveedor.categoria !== undefined) row.categoria = proveedor.categoria;
  if (proveedor.nombre !== undefined) row.nombre = proveedor.nombre;
  if (proveedor.telefono !== undefined) row.telefono = proveedor.telefono;
  if (proveedor.correo !== undefined) row.correo = proveedor.correo;
  if (proveedor.tipoProductoServicio !== undefined) row.tipo_producto_servicio = proveedor.tipoProductoServicio;
  if (proveedor.notas !== undefined) row.notas = proveedor.notas;
  if (proveedor.cotizacionesAnteriores !== undefined) row.cotizaciones = proveedor.cotizacionesAnteriores;
  return row;
};

// Map field name to DB column
const fieldToColumn = (field: string): string => {
  const mapping: Record<string, string> = {
    tipoProductoServicio: 'tipo_producto_servicio',
    cotizacionesAnteriores: 'cotizaciones',
  };
  return mapping[field] || field;
};

export const ProveedoresProvider = ({ children }: { children: ReactNode }) => {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProveedores = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('nombre', { ascending: true });

      if (error) {
        console.error('[ProveedoresContext] Error fetching proveedores:', error);
        return;
      }

      setProveedores((data || []).map(dbRowToProveedor));
    } catch (err) {
      console.error('[ProveedoresContext] Exception fetching proveedores:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProveedores();

    // Real-time subscription
    const channel = supabase
      .channel('suppliers-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'suppliers' },
        (payload) => {
          console.log('[ProveedoresContext] Realtime update:', payload);
          fetchProveedores();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const addProveedor = async (proveedor: Omit<Proveedor, 'id'>): Promise<Proveedor | null> => {
    try {
      const dbRow = proveedorToDbRow(proveedor);
      const { data, error } = await supabase
        .from('suppliers')
        .insert(dbRow)
        .select()
        .single();

      if (error) {
        console.error('[ProveedoresContext] Error adding proveedor:', error);
        throw error;
      }

      const newProveedor = dbRowToProveedor(data);
      setProveedores(prev => [...prev, newProveedor]);
      return newProveedor;
    } catch (err) {
      console.error('[ProveedoresContext] Exception adding proveedor:', err);
      throw err;
    }
  };

  const updateProveedor = async (id: string, field: string, value: any): Promise<void> => {
    try {
      const column = fieldToColumn(field);
      const { error } = await supabase
        .from('suppliers')
        .update({ [column]: value })
        .eq('id', id);

      if (error) {
        console.error('[ProveedoresContext] Error updating proveedor:', error);
        throw error;
      }

      setProveedores(prev =>
        prev.map(p => (p.id === id ? { ...p, [field]: value } : p))
      );
    } catch (err) {
      console.error('[ProveedoresContext] Exception updating proveedor:', err);
      throw err;
    }
  };

  const deleteProveedor = async (id: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[ProveedoresContext] Error deleting proveedor:', error);
        throw error;
      }

      setProveedores(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      console.error('[ProveedoresContext] Exception deleting proveedor:', err);
      throw err;
    }
  };

  const refreshProveedores = async () => {
    setLoading(true);
    await fetchProveedores();
  };

  return (
    <ProveedoresContext.Provider
      value={{
        proveedores,
        loading,
        addProveedor,
        updateProveedor,
        deleteProveedor,
        refreshProveedores,
      }}
    >
      {children}
    </ProveedoresContext.Provider>
  );
};

export const useProveedores = () => {
  const context = useContext(ProveedoresContext);
  if (!context) {
    throw new Error('useProveedores must be used within a ProveedoresProvider');
  }
  return context;
};
