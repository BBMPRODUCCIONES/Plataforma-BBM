import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ColumnConfig } from "@/components/ColumnManagerDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { Json } from "@/integrations/supabase/types";

interface GlobalColumnsState {
  columns: ColumnConfig[];
  loading: boolean;
  error: string | null;
}

export function useGlobalColumns(panelKey: string, defaultColumns: ColumnConfig[]) {
  const { user } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const [state, setState] = useState<GlobalColumnsState>({
    columns: defaultColumns,
    loading: true,
    error: null,
  });

  const isAdmin = role === "administrador";

  // Fetch columns from database
  const fetchColumns = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("panel_column_configs")
        .select("columns")
        .eq("panel_key", panelKey)
        .maybeSingle();

      if (error) {
        console.error("[useGlobalColumns] Error fetching:", error);
        setState(prev => ({ ...prev, loading: false, error: error.message }));
        return;
      }

      if (data && data.columns) {
        // Cast JSONB to ColumnConfig[]
        const savedColumns = data.columns as unknown as ColumnConfig[];
        const savedKeys = new Set(savedColumns.map(c => c.key));
        
        // Add any missing default columns (new features)
        const missingDefaults = defaultColumns.filter(
          dc => !dc.isCustom && !savedKeys.has(dc.key)
        );
        
        const merged = missingDefaults.length > 0
          ? [...savedColumns, ...missingDefaults.map((c, i) => ({ ...c, order: savedColumns.length + i }))]
          : savedColumns;

        console.log(`[useGlobalColumns] Loaded ${merged.length} columns for ${panelKey}`);
        setState({ columns: merged, loading: false, error: null });
      } else {
        // No config exists yet, use defaults
        console.log(`[useGlobalColumns] No config found for ${panelKey}, using defaults`);
        setState({ columns: defaultColumns, loading: false, error: null });
      }
    } catch (err) {
      console.error("[useGlobalColumns] Unexpected error:", err);
      setState(prev => ({ ...prev, loading: false, error: "Error inesperado" }));
    }
  }, [panelKey, defaultColumns]);

  // Initial fetch
  useEffect(() => {
    if (!roleLoading) {
      fetchColumns();
    }
  }, [fetchColumns, roleLoading]);

  // Real-time subscription for changes
  useEffect(() => {
    const channel = supabase
      .channel(`panel-columns-${panelKey}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "panel_column_configs",
          filter: `panel_key=eq.${panelKey}`,
        },
        (payload) => {
          console.log(`[useGlobalColumns] Realtime update for ${panelKey}:`, payload.eventType);
          
          if (payload.eventType === "DELETE") {
            setState({ columns: defaultColumns, loading: false, error: null });
          } else if (payload.new && (payload.new as any).columns) {
            const newColumns = (payload.new as any).columns as ColumnConfig[];
            setState({ columns: newColumns, loading: false, error: null });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [panelKey, defaultColumns]);

  // Save columns to database (admin only)
  const setColumns = useCallback(async (newColumns: ColumnConfig[]) => {
    if (!isAdmin) {
      toast.error("Solo los administradores pueden modificar la estructura");
      return;
    }

    if (!user) {
      toast.error("Debe iniciar sesión para guardar cambios");
      return;
    }

    // Optimistic update
    setState(prev => ({ ...prev, columns: newColumns }));

    try {
      const { error } = await supabase
        .from("panel_column_configs")
        .upsert(
          {
            panel_key: panelKey,
            columns: newColumns as unknown as Json,
            updated_by: user.id,
            updated_by_email: user.email,
          },
          { onConflict: "panel_key" }
        );

      if (error) {
        console.error("[useGlobalColumns] Error saving:", error);
        toast.error("Error al guardar la configuración");
        // Revert on error
        fetchColumns();
        return;
      }

      console.log(`[useGlobalColumns] Saved ${newColumns.length} columns for ${panelKey}`);
      toast.success("Estructura actualizada para todos los usuarios");
    } catch (err) {
      console.error("[useGlobalColumns] Unexpected save error:", err);
      toast.error("Error inesperado al guardar");
      fetchColumns();
    }
  }, [isAdmin, user, panelKey, fetchColumns]);

  return {
    columns: state.columns,
    setColumns,
    loading: state.loading || roleLoading,
    error: state.error,
    isAdmin,
    refetch: fetchColumns,
  };
}
