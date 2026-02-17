import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  created_at: string;
  updated_at: string;
}

export const CATEGORIAS_GASTOS_MENORES = [
  "Transporte",
  "Alimentación",
  "Papelería",
  "Aseo",
  "Servicios",
] as const;

export function useGastosMenores(centroCostos?: string) {
  const [gastos, setGastos] = useState<GastoMenor[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchGastos = async (filterCentroCostos?: string) => {
    setLoading(true);
    try {
      let query = supabase.from("gastos_menores").select("*").order("created_at", { ascending: false });
      if (filterCentroCostos) {
        query = query.eq("centro_costos", filterCentroCostos);
      }
      const { data, error } = await query;
      if (error) throw error;
      setGastos((data as GastoMenor[]) || []);
    } catch (err: any) {
      console.error("Error fetching gastos menores:", err);
    } finally {
      setLoading(false);
    }
  };

  const addGasto = async (gasto: Omit<GastoMenor, "id" | "created_at" | "updated_at">) => {
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

  useEffect(() => {
    fetchGastos(centroCostos);
  }, [centroCostos]);

  return { gastos, loading, addGasto, refetch: () => fetchGastos(centroCostos) };
}
