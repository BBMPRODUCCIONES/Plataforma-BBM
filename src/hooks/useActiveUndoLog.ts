import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ActiveUndoEntry {
  id: string;
  item_id: string;
  source: string;
  project_id: string | null;
  previous_estado: string;
  new_estado: string;
  expires_at: string;
}

/**
 * Fetches active (non-expired, non-undone) undo log entries.
 * Used by views outside AprobacionesPendientes to show the previous estado
 * while the 2-hour undo window is still active.
 */
export function useActiveUndoLog() {
  const [entries, setEntries] = useState<ActiveUndoEntry[]>([]);

  const fetch = useCallback(async () => {
    const now = new Date().toISOString();
    const { data } = await supabase
      .from("aprobacion_undo_log")
      .select("id, item_id, source, project_id, previous_estado, new_estado, expires_at")
      .eq("undone", false)
      .gte("expires_at", now);
    setEntries((data as ActiveUndoEntry[]) || []);
  }, []);

  useEffect(() => {
    fetch();
    // Refresh every 30s to catch expirations
    const interval = setInterval(fetch, 30_000);
    return () => clearInterval(interval);
  }, [fetch]);

  // Realtime subscription for immediate updates
  useEffect(() => {
    const channel = supabase
      .channel("undo_log_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "aprobacion_undo_log" }, () => {
        fetch();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetch]);

  /**
   * Given a gastoMenor id and its current estado, returns the effective estado
   * (previous_estado if there's an active undo entry, otherwise current).
   */
  const getEffectiveEstadoForGasto = useCallback((gastoId: string, currentEstado: string): string => {
    // In undo log, gastoMenor items use id prefixed with 'gm-'
    const entry = entries.find(e => e.source === "gastoMenor" && e.item_id === `gm-${gastoId}`);
    return entry ? entry.previous_estado : currentEstado;
  }, [entries]);

  /**
   * Given a cajaMenor item id, project_id, and current estado, returns the effective estado.
   */
  const getEffectiveEstadoForCajaMenor = useCallback((itemId: string, projectId: string, currentEstado: string): string => {
    const entry = entries.find(e =>
      (e.source === "cajaMenor" || e.source === "legalizacion") &&
      e.item_id === itemId &&
      e.project_id === projectId
    );
    return entry ? entry.previous_estado : currentEstado;
  }, [entries]);

  return { entries, getEffectiveEstadoForGasto, getEffectiveEstadoForCajaMenor, refetch: fetch };
}
