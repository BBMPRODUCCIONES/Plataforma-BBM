import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveUndoLog } from "@/hooks/useActiveUndoLog";
import { toast } from "sonner";

export interface GastoMenor {
  id: string;
  centro_costos: string;
  evento_id: string | null;
  usuario_id: string;
  usuario_nombre: string;
  concepto: string;
  categoria: string;
  valor: number;
  imagen_url: string | null;
  estado: string;
  aprobado_por_id: string | null;
  aprobado_por_nombre: string;
  nombre_comercio: string;
  nit_cc: string;
  tipo_centro: string;
  created_at: string;
  updated_at: string;
}

export const CATEGORIAS_EVENTOS = [
  "Insumos",
  "Alimentación",
  "Transporte",
] as const;

export const CATEGORIAS_ADMIN = [
  "Aseo",
  "Cafetería",
  "Papelería",
] as const;

export const CATEGORIAS_GASTOS_MENORES = [
  ...CATEGORIAS_EVENTOS,
  ...CATEGORIAS_ADMIN,
] as const;

export function useGastosMenores(centroCostos?: string, options?: { applyUndoOverlay?: boolean }) {
  const [rawGastos, setRawGastos] = useState<GastoMenor[]>([]);
  const [loading, setLoading] = useState(false);
  const { getEffectiveEstadoForGasto } = useActiveUndoLog();
  const applyOverlay = options?.applyUndoOverlay ?? false;

  const fetchGastos = async (filterCentroCostos?: string) => {
    setLoading(true);
    try {
      let query = supabase.from("gastos_menores").select("*").order("created_at", { ascending: false });
      if (filterCentroCostos) {
        query = query.eq("centro_costos", filterCentroCostos);
      }
      const { data, error } = await query;
      if (error) throw error;
      setRawGastos((data as GastoMenor[]) || []);
    } catch (err: any) {
      console.error("Error fetching gastos menores:", err);
    } finally {
      setLoading(false);
    }
  };

  // Apply undo log overlay when enabled: show previous estado while undo timer is active
  const gastos = useMemo(() => {
    if (!applyOverlay) return rawGastos;
    return rawGastos.map(g => ({
      ...g,
      estado: getEffectiveEstadoForGasto(g.id, g.estado),
    }));
  }, [rawGastos, getEffectiveEstadoForGasto, applyOverlay]);

  const addGasto = async (gasto: Omit<GastoMenor, "id" | "created_at" | "updated_at" | "aprobado_por_id" | "aprobado_por_nombre">) => {
    try {
      const { error } = await supabase.from("gastos_menores").insert(gasto as any);
      if (error) throw error;
      toast.success("Gasto menor registrado exitosamente");
      await fetchGastos(centroCostos);
      return true;
    } catch (err: any) {
      console.error("Error adding gasto menor:", err);
      toast.error("Error al registrar el gasto: " + err.message);
      return false;
    }
  };

  const deleteGasto = async (id: string) => {
    try {
      const { error } = await supabase.from("gastos_menores").delete().eq("id", id);
      if (error) throw error;
      toast.success("Gasto eliminado exitosamente");
      return true;
    } catch (err: any) {
      console.error("Error deleting gasto menor:", err);
      toast.error("Error al eliminar el gasto: " + err.message);
      return false;
    }
  };

  useEffect(() => {
    fetchGastos(centroCostos);
  }, [centroCostos]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('gastos_menores_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'gastos_menores' },
        () => {
          fetchGastos(centroCostos);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [centroCostos]);

  return { gastos, loading, addGasto, deleteGasto, refetch: () => fetchGastos(centroCostos) };
}
