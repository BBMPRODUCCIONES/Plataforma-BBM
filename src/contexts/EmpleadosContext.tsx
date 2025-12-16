import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export interface Empleado {
  id: string;
  cargo: string;
  nombre: string;
  telefono: string;
  correo: string;
  banco: string;
  tipoCuenta: string;
  numeroCuenta: string;
  cedula: string;
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
  getEmpleadoNameById: (id: string) => Promise<string | null>;
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
    banco: row.banco || "",
    tipoCuenta: row.tipo_cuenta || "",
    numeroCuenta: row.numero_cuenta || "",
    cedula: row.cedula || "",
    createdAt: row.created_at,
  };
}

export function EmpleadosProvider({ children }: { children: ReactNode }) {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();
  const dataLoadedRef = useRef(false);

  const fetchEmpleados = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_employees_for_role');

      if (error) {
        console.error("[EmpleadosContext] Error fetching employees:", error);
        toast.error("Error al cargar empleados. Verifique sus permisos.");
        setEmpleados([]);
        return;
      }

      const empleadosList = (data || []).map(dbRowToEmpleado);
      setEmpleados(empleadosList);
      console.log("[EmpleadosContext] Loaded", empleadosList.length, "employees");
    } catch (err) {
      console.error("[EmpleadosContext] Unexpected error:", err);
      setEmpleados([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Conditional fetch: only when user is authenticated
  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      setLoading(false);
      setEmpleados([]);
      dataLoadedRef.current = false;
      return;
    }

    if (dataLoadedRef.current) return;

    console.log("[EmpleadosContext] User authenticated, fetching employees...");
    dataLoadedRef.current = true;
    fetchEmpleados();

    const channel = supabase
      .channel("employees-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "employees" },
        () => {
          console.log("[EmpleadosContext] Realtime event, refetching...");
          fetchEmpleados();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, authLoading, fetchEmpleados]);

  // Get employee name by ID (even if soft-deleted) for historical records
  const getEmpleadoNameById = useCallback(async (id: string): Promise<string | null> => {
    if (!id) return null;
    
    // First check if it's in our current list
    const found = empleados.find(e => e.id === id);
    if (found) return found.nombre;
    
    // Otherwise, fetch from DB (may be soft-deleted)
    try {
      const { data, error } = await supabase.rpc('get_employee_name_by_id', { _employee_id: id });
      if (error) {
        console.error("[EmpleadosContext] Error fetching employee name:", error);
        return null;
      }
      return data || null;
    } catch (err) {
      console.error("[EmpleadosContext] Unexpected error fetching employee name:", err);
      return null;
    }
  }, [empleados]);

  const addEmpleado = useCallback(async (empleadoData: Omit<Empleado, "id" | "createdAt">): Promise<Empleado | null> => {
    // Note: INSERT is protected by RLS - only admin can insert
    
    // VALIDATION: Check if email already exists (unique constraint)
    const emailToCheck = empleadoData.correo?.toLowerCase().trim();
    if (emailToCheck) {
      const existingEmpleado = empleados.find(
        e => e.correo.toLowerCase().trim() === emailToCheck
      );
      if (existingEmpleado) {
        toast.error(`Este correo ya existe. Empleado: ${existingEmpleado.nombre}`, {
          description: "Use 'Editar empleado existente' en lugar de crear uno nuevo.",
          duration: 5000,
        });
        return null;
      }
    }
    
    const tempId = `temp-${Date.now()}`;
    const optimisticEmpleado: Empleado = {
      id: tempId,
      cargo: empleadoData.cargo || "",
      nombre: empleadoData.nombre || "",
      telefono: empleadoData.telefono || "",
      correo: empleadoData.correo || "",
      banco: empleadoData.banco || "",
      tipoCuenta: empleadoData.tipoCuenta || "",
      numeroCuenta: empleadoData.numeroCuenta || "",
      cedula: empleadoData.cedula || "",
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
        banco: empleadoData.banco,
        tipo_cuenta: empleadoData.tipoCuenta,
        numero_cuenta: empleadoData.numeroCuenta,
        cedula: empleadoData.cedula,
      })
      .select()
      .single();

    if (error) {
      console.error("[EmpleadosContext] Error creating employee:", error);
      // Check if it's a unique constraint violation
      if (error.code === '23505' && error.message?.includes('correo')) {
        toast.error("Este correo ya existe en el sistema.", {
          description: "No se pueden crear empleados con correos duplicados.",
          duration: 5000,
        });
      } else {
        toast.error("Error al crear el empleado. Solo administradores pueden crear empleados.");
      }
      // Revert optimistic update
      setEmpleados(prev => prev.filter(e => e.id !== tempId));
      return null;
    }

    // Log audit for employee creation
    if (user && data) {
      await supabase.from("user_audit_log").insert({
        action: "employee_created",
        actor_id: user.id,
        actor_email: user.email || "",
        target_id: data.id,
        target_email: empleadoData.correo || null,
        panel: "empleados",
        details: { nombre: empleadoData.nombre, cargo: empleadoData.cargo },
      });
    }

    // Replace temp empleado with real one
    const realEmpleado = dbRowToEmpleado(data);
    setEmpleados(prev => prev.map(e => e.id === tempId ? realEmpleado : e));
    console.log("[EmpleadosContext] Created new employee:", data.id);
    return realEmpleado;
  }, [empleados, user]);

  const updateEmpleado = useCallback(async (id: string, data: Partial<Empleado>) => {
    // Note: UPDATE is protected by RLS - only admin can update
    const empleadoAntes = empleados.find(e => e.id === id);
    
    setEmpleados(prev => prev.map(e => 
      e.id === id ? { ...e, ...data } : e
    ));

    const updateData: Record<string, any> = {};
    if (data.cargo !== undefined) updateData.cargo = data.cargo;
    if (data.nombre !== undefined) updateData.nombre = data.nombre;
    if (data.telefono !== undefined) updateData.telefono = data.telefono;
    if (data.correo !== undefined) updateData.correo = data.correo;
    if (data.banco !== undefined) updateData.banco = data.banco;
    if (data.tipoCuenta !== undefined) updateData.tipo_cuenta = data.tipoCuenta;
    if (data.numeroCuenta !== undefined) updateData.numero_cuenta = data.numeroCuenta;
    if (data.cedula !== undefined) updateData.cedula = data.cedula;

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

    // Log audit for employee update
    if (user && empleadoAntes) {
      await supabase.from("user_audit_log").insert({
        action: "employee_updated",
        actor_id: user.id,
        actor_email: user.email || "",
        target_id: id,
        target_email: empleadoAntes.correo || null,
        panel: "empleados",
        details: { 
          nombre: empleadoAntes.nombre,
          changes: data 
        },
      });
    }

    console.log("[EmpleadosContext] Updated employee:", id);
  }, [fetchEmpleados, empleados, user]);

  const deleteEmpleado = useCallback(async (id: string) => {
    // SOFT DELETE: Mark as deleted instead of physical deletion
    const empleadoToDelete = empleados.find(e => e.id === id);
    
    // Optimistic update - remove from visible list
    setEmpleados(prev => prev.filter(e => e.id !== id));

    const { error } = await supabase
      .from("employees")
      .update({ 
        deleted_at: new Date().toISOString(),
        deleted_by: user?.id || null
      })
      .eq("id", id);

    if (error) {
      console.error("[EmpleadosContext] Error soft-deleting employee:", error);
      toast.error("Error al eliminar el empleado. Solo administradores pueden eliminar.");
      // Revert optimistic update
      if (empleadoToDelete) {
        setEmpleados(prev => [empleadoToDelete, ...prev]);
      }
      return;
    }

    // Log audit for employee deletion
    if (user && empleadoToDelete) {
      await supabase.from("user_audit_log").insert({
        action: "employee_deleted",
        actor_id: user.id,
        actor_email: user.email || "",
        target_id: id,
        target_email: empleadoToDelete.correo || null,
        panel: "empleados",
        details: { 
          nombre: empleadoToDelete.nombre,
          cargo: empleadoToDelete.cargo,
        },
      });
    }

    console.log("[EmpleadosContext] Soft-deleted employee:", id);
  }, [empleados, user]);

  return (
    <EmpleadosContext.Provider value={{ 
      empleados, 
      loading,
      addEmpleado, 
      updateEmpleado, 
      deleteEmpleado,
      refetch: fetchEmpleados,
      getEmpleadoNameById,
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
