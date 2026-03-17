import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { GastoMenor } from "./useGastosMenores";

// Fixed base amount (constant, informational only)
export const BASE_ASIGNADA_FIJA = 1_000_000;

export interface CajaMenorConfig {
  id: string;
  base_asignada: number;
  saldo_inicial: number;
  reembolsado_caja_anterior: number;
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
  estado_revision: string;
  desembolsado_por: string;
  cambios_base: string;
  created_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
  deleted_by_email: string | null;
  deleted_reason: string | null;
  snapshot: any;
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

  // Filter gastos to only include those created after the current config was created
  const currentPeriodGastos = useMemo(() => {
    if (!config?.created_at) return gastos;
    const configCreatedAt = new Date(config.created_at).getTime();
    return gastos.filter(g => new Date(g.created_at).getTime() >= configCreatedAt);
  }, [gastos, config?.created_at]);

  // Derived stats with new formula:
  // Base asignada = 1,000,000 (constant)
  // Saldo inicial = from previous caja's saldo en caja (stored in config)
  // Reembolsado caja anterior = manual value set by auditor
  // Total de gastos = sum of approved/legalized/reembolsado expenses
  // Saldo en caja = saldo_inicial + reembolsado_caja_anterior - total_gastos
  const stats = useMemo(() => {
    const baseAsignada = BASE_ASIGNADA_FIJA;
    const saldoInicial = config?.saldo_inicial ?? baseAsignada; // First caja = base
    const reembolsadoCajaAnterior = config?.reembolsado_caja_anterior ?? 0;
    const totalGastos = currentPeriodGastos
      .filter((g) => g.estado === "Aprobado" || g.estado === "Legalizado" || g.estado === "Reembolsado")
      .reduce((s, g) => s + g.valor, 0);
    const totalPendientes = currentPeriodGastos
      .filter((g) => g.estado === "Pendiente")
      .reduce((s, g) => s + g.valor, 0);
    const saldoEnCaja = saldoInicial + reembolsadoCajaAnterior - totalGastos;

    return { baseAsignada, saldoInicial, reembolsadoCajaAnterior, totalGastos, totalPendientes, saldoEnCaja };
  }, [config, currentPeriodGastos]);

  // Get cierres pending review (for auditors)
  const cierresPendientesRevision = useMemo(() => {
    return cierres.filter(c => !c.deleted_at && (c as any).estado_revision === "En revisión");
  }, [cierres]);

  const updateReembolsoCajaAnterior = useCallback(async (newReembolso: number) => {
    if (!config) return false;
    const { error } = await supabase.from("caja_menor_config").update({
      reembolsado_caja_anterior: newReembolso,
    } as any).eq("id", config.id);
    if (error) { toast.error("Error: " + error.message); return false; }
    return true;
  }, [config]);

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
    return true;
  }, [config]);

  const registerResponsable = useCallback(async () => {
    const { data: empData } = await supabase.rpc("get_my_employee");
    const nombre = empData?.[0]?.nombre || user?.email || "";

    if (!config) {
      const { error } = await supabase.from("caja_menor_config").insert({
        base_asignada: BASE_ASIGNADA_FIJA,
        saldo_inicial: BASE_ASIGNADA_FIJA,
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

  // Cierre by responsable: closes current caja → "En revisión", opens new one
  const realizarCierre = useCallback(async () => {
    const responsableNombre = config?.responsable_nombre || "";

    // Validate: no pending expenses allowed
    const gastosPendientes = currentPeriodGastos.filter((g) => g.estado === "Pendiente");
    if (gastosPendientes.length > 0) {
      toast.error(`No se puede cerrar la caja: hay ${gastosPendientes.length} solicitud(es) pendiente(s). Todas deben estar legalizadas o rechazadas.`);
      return false;
    }

    // Validate: must have at least one legalized expense
    const gastosLegalizados = currentPeriodGastos.filter((g) => g.estado === "Legalizado");
    if (gastosLegalizados.length === 0) {
      toast.error("No se puede cerrar la caja: debe existir al menos una solicitud legalizada.");
      return false;
    }

    const gastosAprobados = currentPeriodGastos.filter((g) => g.estado === "Aprobado");
    if (gastosAprobados.length > 0) {
      toast.error(`No se puede cerrar la caja: hay ${gastosAprobados.length} solicitud(es) aprobada(s) sin legalizar.`);
      return false;
    }

    const gastosParaCierre = gastosLegalizados;
    const valorTotal = gastosParaCierre.reduce((s, g) => s + g.valor, 0);

    // Build snapshot
    const snapshot = {
      base_asignada: stats.baseAsignada,
      saldo_inicial: stats.saldoInicial,
      reembolsado_caja_anterior: stats.reembolsadoCajaAnterior,
      total_gastos: stats.totalGastos,
      saldo_en_caja: stats.saldoEnCaja,
      responsable_nombre: responsableNombre,
      responsable_timestamp: config?.responsable_timestamp || null,
      gastos_count: gastosParaCierre.length,
      gastos: gastosParaCierre.map(g => ({
        id: g.id,
        created_at: g.created_at,
        centro_costos: g.centro_costos,
        concepto: g.concepto,
        categoria: g.categoria,
        nombre_comercio: g.nombre_comercio,
        nit_cc: g.nit_cc,
        valor: g.valor,
        imagen_url: g.imagen_url,
        estado: g.estado,
        aprobado_por_nombre: g.aprobado_por_nombre,
        usuario_nombre: g.usuario_nombre,
      })),
    };

    // 1. Create cierre record with estado_revision = "En revisión"
    const { error: cierreError } = await supabase.from("caja_menor_cierres").insert({
      responsable_nombre: responsableNombre,
      responsable_user_id: user?.id,
      valor_total: valorTotal,
      estado: "Cerrada",
      estado_revision: "En revisión",
      desembolsado_por: config?.desembolsado_por || "",
      cambios_base: `Base: ${BASE_ASIGNADA_FIJA}`,
      snapshot,
    } as any);
    if (cierreError) { toast.error("Error en cierre: " + cierreError.message); return false; }

    // 2. Update current config as closed
    if (config) {
      await supabase.from("caja_menor_config").update({
        estado_cierre: "Cerrada",
        fecha_cierre: new Date().toISOString(),
      } as any).eq("id", config.id);
    }

    // 3. Create a NEW caja config with saldo_inicial = saldo en caja of closed caja
    const nuevoSaldoInicial = Math.max(stats.saldoEnCaja, 0);
    const { error: newConfigError } = await supabase.from("caja_menor_config").insert({
      base_asignada: BASE_ASIGNADA_FIJA,
      saldo_inicial: nuevoSaldoInicial,
      reembolsado_caja_anterior: 0,
      responsable_user_id: null,
      responsable_nombre: "",
      responsable_timestamp: null,
      estado_cierre: "Abierta",
      desembolso: 0,
      desembolsado_por: "",
    } as any);
    if (newConfigError) { toast.error("Error creando nueva caja: " + newConfigError.message); return false; }

    const fmt = (v: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(v);
    toast.success(`Caja cerrada y enviada a revisión. Nueva caja abierta con saldo inicial de ${fmt(nuevoSaldoInicial)}`);
    await fetchConfig();
    return true;
  }, [config, currentPeriodGastos, user, fetchConfig, stats]);

  // Auditor: update cierre review state
  const actualizarEstadoRevision = useCallback(async (cierreId: string, nuevoEstado: "Legalizado" | "Reembolsado") => {
    const { error } = await supabase.from("caja_menor_cierres").update({
      estado_revision: nuevoEstado,
    } as any).eq("id", cierreId);
    if (error) { toast.error("Error: " + error.message); return false; }
    toast.success(`Cierre actualizado a: ${nuevoEstado}`);
    await fetchCierres();
    return true;
  }, [fetchCierres]);

  return {
    config, cierres, loading, stats, currentPeriodGastos,
    cierresPendientesRevision,
    updateBaseAndReembolso, updateReembolsoCajaAnterior,
    registerResponsable, realizarCierre, actualizarEstadoRevision,
    refetch: fetchConfig,
  };
}
