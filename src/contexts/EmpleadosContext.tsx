import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Empleado {
  id: string;
  cargo: string;
  nombre: string;
  telefono: string;
  correo: string;
  createdAt: string;
  [key: string]: any;
}

interface EmpleadosContextType {
  empleados: Empleado[];
  loading: boolean;
  addEmpleado: (empleado: Omit<Empleado, "id" | "createdAt">) => Promise<Empleado | null>;
  updateEmpleado: (id: string, data: Partial<Empleado>) => Promise<void>;
  deleteEmpleado: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

const EmpleadosContext = createContext<EmpleadosContextType | undefined>(undefined);

// Convert database row to Empleado type
function dbRowToEmpleado(row: any): Empleado {
  return {
    id: row.id,
    cargo: row.cargo || "",
    nombre: row.nombre || "",
    // These fields will be empty strings for non-admin users (filtered by the secure function)
    telefono: row.telefono || "",
    correo: row.correo || "",
    createdAt: row.created_at,
  };
}

export function EmpleadosProvider({ children }: { children: ReactNode }) {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEmpleados = useCallback(async () => {
    try {
      // SECURITY: Always use the secure function that filters based on user role
      // Admin gets full access (nombre, cargo, telefono, correo)
      // Operativo gets limited access (nombre, cargo only - telefono/correo are empty strings)
      // Visual gets no access (empty result)
      const { data, error } = await supabase.rpc('get_employees_for_role');

      if (error) {
        console.error("[EmpleadosContext] Error fetching employees:", error);
        // Do NOT fallback to direct table access - this would bypass security
        // If the function fails, we show an error and return empty list
        toast.error("Error al cargar empleados. Verifique sus permisos.");
        setEmpleados([]);
        return;
      }

      const empleadosList = (data || []).map(dbRowToEmpleado);
      setEmpleados(empleadosList);
      console.log("[EmpleadosContext] Loaded", empleadosList.length, "employees via secure function");
    } catch (err) {
      console.error("[EmpleadosContext] Unexpected error:", err);
      setEmpleados([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch and realtime subscription
  useEffect(() => {
    fetchEmpleados();

    // Subscribe to realtime changes
    const channel = supabase
      .channel("employees-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "employees" },
        (payload) => {
          console.log("[EmpleadosContext] Realtime event:", payload.eventType);
          // Refetch to get role-filtered data (secure function will filter appropriately)
          fetchEmpleados();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchEmpleados]);

  const addEmpleado = useCallback(async (empleadoData: Omit<Empleado, "id" | "createdAt">): Promise<Empleado | null> => {
    // Note: INSERT is protected by RLS - only admin can insert
    const tempId = `temp-${Date.now()}`;
    const optimisticEmpleado: Empleado = {
      id: tempId,
      cargo: empleadoData.cargo || "",
      nombre: empleadoData.nombre || "",
      telefono: empleadoData.telefono || "",
      correo: empleadoData.correo || "",
      createdAt: new Date().toISOString(),
    };

    // Optimistic update
    setEmpleados(prev => [optimisticEmpleado, ...prev]);

    const { data, error } = await supabase
      .from("employees")
      .insert({
        cargo: empleadoData.cargo,
        nombre: empleadoData.nombre,
        telefono: empleadoData.telefono,
        correo: empleadoData.correo,
      })
      .select()
      .single();

    if (error) {
      console.error("[EmpleadosContext] Error creating employee:", error);
      toast.error("Error al crear el empleado. Solo administradores pueden crear empleados.");
      // Revert optimistic update
      setEmpleados(prev => prev.filter(e => e.id !== tempId));
      return null;
    }

    // Replace temp empleado with real one
    const realEmpleado = dbRowToEmpleado(data);
    setEmpleados(prev => prev.map(e => e.id === tempId ? realEmpleado : e));
    console.log("[EmpleadosContext] Created new employee:", data.id);
    return realEmpleado;
  }, []);

  const updateEmpleado = useCallback(async (id: string, data: Partial<Empleado>) => {
    // Note: UPDATE is protected by RLS - only admin can update
    setEmpleados(prev => prev.map(e => 
      e.id === id ? { ...e, ...data } : e
    ));

    const updateData: Record<string, any> = {};
    if (data.cargo !== undefined) updateData.cargo = data.cargo;
    if (data.nombre !== undefined) updateData.nombre = data.nombre;
    if (data.telefono !== undefined) updateData.telefono = data.telefono;
    if (data.correo !== undefined) updateData.correo = data.correo;

    const { error } = await supabase
      .from("employees")
      .update(updateData)
      .eq("id", id);

    if (error) {
      console.error("[EmpleadosContext] Error updating employee:", error);
      toast.error("Error al actualizar el empleado. Solo administradores pueden editar.");
      await fetchEmpleados(); // Revert on error
      return;
    }

    console.log("[EmpleadosContext] Updated employee:", id);
  }, [fetchEmpleados]);

  const deleteEmpleado = useCallback(async (id: string) => {
    // Note: DELETE is protected by RLS - only admin can delete
    const empleadoToDelete = empleados.find(e => e.id === id);
    
    // Optimistic update
    setEmpleados(prev => prev.filter(e => e.id !== id));

    const { error } = await supabase
      .from("employees")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[EmpleadosContext] Error deleting employee:", error);
      toast.error("Error al eliminar el empleado. Solo administradores pueden eliminar.");
      // Revert optimistic update
      if (empleadoToDelete) {
        setEmpleados(prev => [empleadoToDelete, ...prev]);
      }
      return;
    }

    console.log("[EmpleadosContext] Deleted employee:", id);
  }, [empleados]);

  return (
    <EmpleadosContext.Provider value={{ 
      empleados, 
      loading,
      addEmpleado, 
      updateEmpleado, 
      deleteEmpleado,
      refetch: fetchEmpleados,
    }}>
      {children}
    </EmpleadosContext.Provider>
  );
}

export function useEmpleados() {
  const context = useContext(EmpleadosContext);
  if (!context) {
    throw new Error("useEmpleados must be used within EmpleadosProvider");
  }
  return context;
}
