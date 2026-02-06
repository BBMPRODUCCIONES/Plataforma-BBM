import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Proveedor } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';

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
  banco: row.banco || '',
  tipoCuenta: row.tipo_cuenta || '',
  numeroCuenta: row.numero_cuenta || '',
  certificadoBancario: row.certificado_bancario || '',
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
  if (proveedor.banco !== undefined) row.banco = proveedor.banco;
  if (proveedor.tipoCuenta !== undefined) row.tipo_cuenta = proveedor.tipoCuenta;
  if (proveedor.numeroCuenta !== undefined) row.numero_cuenta = proveedor.numeroCuenta;
  if (proveedor.certificadoBancario !== undefined) row.certificado_bancario = proveedor.certificadoBancario;
  return row;
};

// Map field name to DB column
const fieldToColumn = (field: string): string => {
  const mapping: Record<string, string> = {
    tipoProductoServicio: 'tipo_producto_servicio',
    cotizacionesAnteriores: 'cotizaciones',
    tipoCuenta: 'tipo_cuenta',
    numeroCuenta: 'numero_cuenta',
    certificadoBancario: 'certificado_bancario',
  };
  return mapping[field] || field;
};

export const ProveedoresProvider = ({ children }: { children: ReactNode }) => {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();
  const dataLoadedRef = useRef(false);

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
      logger.debug('[ProveedoresContext] Loaded', (data || []).length, 'proveedores');
    } catch (err) {
      console.error('[ProveedoresContext] Exception fetching proveedores:', err);
    } finally {
      setLoading(false);
    }
  };

  // Conditional fetch: only when user is authenticated
  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      setLoading(false);
      setProveedores([]);
      dataLoadedRef.current = false;
      return;
    }

    if (dataLoadedRef.current) return;

    logger.debug('[ProveedoresContext] User authenticated, fetching proveedores...');
    dataLoadedRef.current = true;
    fetchProveedores();

    const channel = supabase
      .channel('suppliers-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'suppliers' },
        () => {
          logger.debug('[ProveedoresContext] Realtime update');
          fetchProveedores();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, authLoading]);

  const addProveedor = async (proveedor: Omit<Proveedor, 'id'>): Promise<Proveedor | null> => {
    // Create optimistic proveedor with temporary ID
    const tempId = `temp-${Date.now()}`;
    const optimisticProveedor: Proveedor = {
      id: tempId,
      categoria: proveedor.categoria || '',
      nombre: proveedor.nombre || '',
      telefono: proveedor.telefono || '',
      correo: proveedor.correo || '',
      tipoProductoServicio: proveedor.tipoProductoServicio || '',
      notas: proveedor.notas || '',
      cotizacionesAnteriores: proveedor.cotizacionesAnteriores || [],
    };

    // Optimistic update - add immediately
    setProveedores(prev => [...prev, optimisticProveedor]);

    try {
      const dbRow = proveedorToDbRow(proveedor);
      const { data, error } = await supabase
        .from('suppliers')
        .insert(dbRow)
        .select()
        .single();

      if (error) {
        console.error('[ProveedoresContext] Error adding proveedor:', error);
        // Revert optimistic update
        setProveedores(prev => prev.filter(p => p.id !== tempId));
        throw error;
      }

      // Replace temp proveedor with real one
      const realProveedor = dbRowToProveedor(data);
      setProveedores(prev => prev.map(p => p.id === tempId ? realProveedor : p));
      return realProveedor;
    } catch (err) {
      console.error('[ProveedoresContext] Exception adding proveedor:', err);
      throw err;
    }
  };

  const updateProveedor = async (id: string, field: string, value: any): Promise<void> => {
    // Optimistic update - update local state immediately
    setProveedores(prev =>
      prev.map(p => (p.id === id ? { ...p, [field]: value } : p))
    );

    try {
      const column = fieldToColumn(field);
      const { error } = await supabase
        .from('suppliers')
        .update({ [column]: value })
        .eq('id', id);

      if (error) {
        console.error('[ProveedoresContext] Error updating proveedor:', error);
        await fetchProveedores(); // Revert on error
        throw error;
      }
    } catch (err) {
      console.error('[ProveedoresContext] Exception updating proveedor:', err);
      throw err;
    }
  };

  const deleteProveedor = async (id: string): Promise<void> => {
    // Save for potential rollback
    const proveedorToDelete = proveedores.find(p => p.id === id);
    
    // Optimistic update - remove immediately
    setProveedores(prev => prev.filter(p => p.id !== id));

    try {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[ProveedoresContext] Error deleting proveedor:', error);
        // Revert optimistic update
        if (proveedorToDelete) {
          setProveedores(prev => [...prev, proveedorToDelete]);
        }
        throw error;
      }
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
