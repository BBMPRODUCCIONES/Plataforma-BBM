import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { GastoMenor } from "./useGastosMenores";

export interface CajaMenorConfig {
  id: string;
  base_asignada: number;
  responsable_user_id: string | null;
  responsable_nombre: string;
  responsable_timestamp: string | null;
  estado_cierre: string;
  desembolso: number;
  desembolsado_por: string;
  fecha_cierre: string | null;
  created_at: string;
  updated_at: string;
}

export interface CajaMenorCierre {
  id: string;
  fecha_cierre: string;
  responsable_nombre: string;
  responsable_user_id: string | null;
  valor_total: number;
  estado: string;
  desembolsado_por: string;
  cambios_base: string;
  created_at: string;
}

export function useCajaMenorConfig(gastos: GastoMenor[]) {
  const { user } = useAuth();
  const [config, setConfig] = useState<CajaMenorConfig | null>(null);
  const [cierres, setCierres] = useState<CajaMenorCierre[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConfig = useCallback(async () => {
    const { data, error } = await supabase
      .from("caja_menor_config")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error && data) {
      setConfig(data as unknown as CajaMenorConfig);
    }
    setLoading(false);
  }, []);

  const fetchCierres = useCallback(async () => {
    const { data, error } = await supabase
      .from("caja_menor_cierres")
      .select("*")
      .order("fecha_cierre", { ascending: false });
    if (!error && data) {
      setCierres(data as unknown as CajaMenorCierre[]);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
    fetchCierres();
  }, [fetchConfig, fetchCierres]);

  // Realtime
  useEffect(() => {
    const ch1 = supabase
      .channel("caja_menor_config_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "caja_menor_config" }, () => fetchConfig())
      .subscribe();
    const ch2 = supabase
      .channel("caja_menor_cierres_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "caja_menor_cierres" }, () => fetchCierres())
      .subscribe();
    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
    };
  }, [fetchConfig, fetchCierres]);

  // Derived stats
  const stats = useMemo(() => {
    const base = config?.base_asignada || 0;
    const totalAprobados = gastos
      .filter((g) => g.estado === "Aprobado" || g.estado === "Legalizado" || g.estado === "Reembolsado")
      .reduce((s, g) => s + g.valor, 0);
    const totalPendientes = gastos
      .filter((g) => g.estado === "Pendiente")
      .reduce((s, g) => s + g.valor, 0);
    const efectivoEnCaja = base - totalAprobados;
    const reembolsado = config?.desembolso || 0;

    return { base, totalAprobados, totalPendientes, efectivoEnCaja, reembolsado };
  }, [config, gastos]);

  const updateBaseAndReembolso = useCallback(async (newBase: number, newReembolso: number) => {
    if (!config) {
      const { error } = await supabase.from("caja_menor_config").insert({
        base_asignada: newBase,
        desembolso: newReembolso,
      } as any);
      if (error) { toast.error("Error: " + error.message); return false; }
    } else {
      const { error } = await supabase.from("caja_menor_config").update({
        base_asignada: newBase,
        desembolso: newReembolso,
      } as any).eq("id", config.id);
      if (error) { toast.error("Error: " + error.message); return false; }
    }
    // Toast is handled by the caller (AjusteBaseDialog) for richer info
    return true;
  }, [config]);

  const registerResponsable = useCallback(async () => {
    const { data: empData } = await supabase.rpc("get_my_employee");
    const nombre = empData?.[0]?.nombre || user?.email || "";

    if (!config) {
      const { error } = await supabase.from("caja_menor_config").insert({
        base_asignada: 0,
        responsable_user_id: user?.id,
        responsable_nombre: nombre,
        responsable_timestamp: new Date().toISOString(),
      } as any);
      if (error) { toast.error("Error: " + error.message); return false; }
    } else {
      const { error } = await supabase.from("caja_menor_config").update({
        responsable_user_id: user?.id,
        responsable_nombre: nombre,
        responsable_timestamp: new Date().toISOString(),
      } as any).eq("id", config.id);
      if (error) { toast.error("Error: " + error.message); return false; }
    }
    toast.success("Responsable registrado");
    return true;
  }, [config, user]);

  const realizarCierre = useCallback(async (estado: "Legalizado" | "Reembolsado") => {
    const responsableNombre = config?.responsable_nombre || "";
    const gastosAprobados = gastos.filter((g) => g.estado === "Aprobado");
    const valorTotal = gastosAprobados.reduce((s, g) => s + g.valor, 0);

    if (gastosAprobados.length === 0) {
      toast.error("No hay gastos aprobados para realizar el cierre");
      return false;
    }

    // 1. Change all approved gastos to the cierre estado
    const idsAprobados = gastosAprobados.map((g) => g.id);
    const { error: updateError } = await supabase
      .from("gastos_menores")
      .update({ estado } as any)
      .in("id", idsAprobados);
    if (updateError) { toast.error("Error actualizando gastos: " + updateError.message); return false; }

    // Build snapshot of current caja state
    const base = config?.base_asignada || 0;
    const totalAprobados = gastos
      .filter((g) => g.estado === "Aprobado" || g.estado === "Legalizado" || g.estado === "Reembolsado")
      .reduce((s, g) => s + g.valor, 0);
    const totalPendientes = gastos
      .filter((g) => g.estado === "Pendiente")
      .reduce((s, g) => s + g.valor, 0);
    const reembolsado = config?.desembolso || 0;
    const snapshot = {
      base_asignada: base,
      total_aprobados: totalAprobados,
      total_pendientes: totalPendientes,
      saldo_en_caja: base - totalAprobados,
      reembolsado,
      responsable_nombre: responsableNombre,
      responsable_timestamp: config?.responsable_timestamp || null,
      estado_cierre: estado,
      gastos_count: gastosAprobados.length,
    };

    // 2. Create cierre record with snapshot
    const { error: cierreError } = await supabase.from("caja_menor_cierres").insert({
      responsable_nombre: responsableNombre,
      responsable_user_id: user?.id,
      valor_total: valorTotal,
      estado,
      desembolsado_por: config?.desembolsado_por || "",
      cambios_base: `Base: ${config?.base_asignada || 0}`,
      snapshot,
    } as any);
    if (cierreError) { toast.error("Error en cierre: " + cierreError.message); return false; }

    // 3. Update current config as closed
    if (config) {
      await supabase.from("caja_menor_config").update({
        estado_cierre: estado,
        fecha_cierre: new Date().toISOString(),
      } as any).eq("id", config.id);
    }

    // 4. Create a NEW caja config with the remaining balance (efectivo en caja)
    const efectivoRestante = (config?.base_asignada || 0) - valorTotal;
    const { error: newConfigError } = await supabase.from("caja_menor_config").insert({
      base_asignada: Math.max(efectivoRestante, 0),
      responsable_user_id: null,
      responsable_nombre: "",
      responsable_timestamp: null,
      estado_cierre: "Abierta",
      desembolso: 0,
      desembolsado_por: "",
    } as any);
    if (newConfigError) { toast.error("Error creando nueva caja: " + newConfigError.message); return false; }

    toast.success(`Cierre de caja: ${estado}. Nueva caja abierta con ${new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(Math.max(efectivoRestante, 0))}`);
    await fetchConfig();
    return true;
  }, [config, gastos, user, fetchConfig]);

  return { config, cierres, loading, stats, updateBaseAndReembolso, registerResponsable, realizarCierre, refetch: fetchConfig };
}
