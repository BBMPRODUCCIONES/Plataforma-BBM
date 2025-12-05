import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Cliente } from "@/types";

interface ClientesContextType {
  clientes: Cliente[];
  loading: boolean;
  addCliente: (cliente: Omit<Cliente, "id" | "createdAt">) => Promise<Cliente | null>;
  updateCliente: (id: string, data: Partial<Cliente>) => Promise<void>;
  deleteCliente: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

const ClientesContext = createContext<ClientesContextType | undefined>(undefined);

// Convert database row to Cliente type
function dbRowToCliente(row: any): Cliente {
  return {
    id: row.id,
    nombre: row.nombre || "",
    nit: row.nit || "",
    createdAt: row.created_at,
  };
}

export function ClientesProvider({ children }: { children: ReactNode }) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClientes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[ClientesContext] Error fetching clients:", error);
        toast.error("Error al cargar clientes");
        return;
      }

      const clientesList = (data || []).map(dbRowToCliente);
      setClientes(clientesList);
      console.log("[ClientesContext] Loaded", clientesList.length, "clients from database");
    } catch (err) {
      console.error("[ClientesContext] Unexpected error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch and realtime subscription
  useEffect(() => {
    fetchClientes();

    // Subscribe to realtime changes
    const channel = supabase
      .channel("clients-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "clients" },
        (payload) => {
          console.log("[ClientesContext] Realtime event:", payload.eventType);
          
          if (payload.eventType === "INSERT") {
            const newCliente = dbRowToCliente(payload.new);
            setClientes(prev => [newCliente, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            const updatedCliente = dbRowToCliente(payload.new);
            setClientes(prev => prev.map(c => c.id === updatedCliente.id ? updatedCliente : c));
          } else if (payload.eventType === "DELETE") {
            const deletedId = payload.old.id;
            setClientes(prev => prev.filter(c => c.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchClientes]);

  const addCliente = useCallback(async (clienteData: Omit<Cliente, "id" | "createdAt">): Promise<Cliente | null> => {
    const { data, error } = await supabase
      .from("clients")
      .insert({
        nombre: clienteData.nombre,
        nit: clienteData.nit,
      })
      .select()
      .single();

    if (error) {
      console.error("[ClientesContext] Error creating client:", error);
      toast.error("Error al crear el cliente");
      return null;
    }

    console.log("[ClientesContext] Created new client:", data.id);
    return dbRowToCliente(data);
  }, []);

  const updateCliente = useCallback(async (id: string, data: Partial<Cliente>) => {
    // Optimistic update - update local state immediately
    setClientes(prev => prev.map(c => 
      c.id === id ? { ...c, ...data } : c
    ));

    const updateData: Record<string, any> = {};
    if (data.nombre !== undefined) updateData.nombre = data.nombre;
    if (data.nit !== undefined) updateData.nit = data.nit;

    const { error } = await supabase
      .from("clients")
      .update(updateData)
      .eq("id", id);

    if (error) {
      console.error("[ClientesContext] Error updating client:", error);
      toast.error("Error al actualizar el cliente");
      await fetchClientes(); // Revert on error
      return;
    }

    console.log("[ClientesContext] Updated client:", id);
  }, [fetchClientes]);

  const deleteCliente = useCallback(async (id: string) => {
    const { error } = await supabase
      .from("clients")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[ClientesContext] Error deleting client:", error);
      toast.error("Error al eliminar el cliente");
      return;
    }

    console.log("[ClientesContext] Deleted client:", id);
  }, []);

  return (
    <ClientesContext.Provider value={{ 
      clientes, 
      loading,
      addCliente, 
      updateCliente, 
      deleteCliente,
      refetch: fetchClientes,
    }}>
      {children}
    </ClientesContext.Provider>
  );
}

export function useClientes() {
  const context = useContext(ClientesContext);
  if (!context) {
    throw new Error("useClientes must be used within ClientesProvider");
  }
  return context;
}
