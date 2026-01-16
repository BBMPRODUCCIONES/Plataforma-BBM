import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ColumnConfig } from "@/components/ColumnManagerDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { Json } from "@/integrations/supabase/types";
import { logger } from "@/lib/logger";

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

  // Initialize config in DB if it doesn't exist (admin only)
  const initializeConfig = useCallback(async () => {
    if (!user || !isAdmin) return false;
    
    try {
      const { error } = await supabase
        .from("panel_column_configs")
        .insert({
          panel_key: panelKey,
          columns: defaultColumns as unknown as Json,
          updated_by: user.id,
          updated_by_email: user.email,
        });

      if (error) {
        // Ignore duplicate key error (another admin might have initialized)
        if (error.code !== '23505') {
          console.error("[useGlobalColumns] Error initializing:", error);
          return false;
        }
      }
      
      logger.debug(`[useGlobalColumns] Initialized config for ${panelKey}`);
      return true;
    } catch (err) {
      console.error("[useGlobalColumns] Unexpected init error:", err);
      return false;
    }
  }, [panelKey, defaultColumns, user, isAdmin]);

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
        
        // Add any missing default columns (new features) in correct position
        const missingDefaults = defaultColumns.filter(
          dc => !dc.isCustom && !savedKeys.has(dc.key)
        );
        
        let merged = savedColumns;
        if (missingDefaults.length > 0) {
          // Insert missing columns in their logical position based on defaultColumns order
          merged = [...savedColumns];
          
          for (const missingCol of missingDefaults) {
            // Find the default column that comes before this one
            const defaultIndex = defaultColumns.findIndex(dc => dc.key === missingCol.key);
            let insertAfterKey: string | null = null;
            
            for (let i = defaultIndex - 1; i >= 0; i--) {
              if (merged.some(mc => mc.key === defaultColumns[i].key)) {
                insertAfterKey = defaultColumns[i].key;
                break;
              }
            }
            
            if (insertAfterKey) {
              // Insert after the found column
              const insertIndex = merged.findIndex(mc => mc.key === insertAfterKey) + 1;
              merged.splice(insertIndex, 0, { ...missingCol, order: insertIndex });
            } else {
              // No previous column found, insert at beginning
              merged.unshift({ ...missingCol, order: 0 });
            }
          }
          
          // Recalculate order for all columns
          merged = merged.map((col, idx) => ({ ...col, order: idx }));
          
          logger.debug(`[useGlobalColumns] Added ${missingDefaults.length} missing columns to ${panelKey}`);
        }

        logger.debug(`[useGlobalColumns] Loaded ${merged.length} columns for ${panelKey}`);
        setState({ columns: merged, loading: false, error: null });
      } else {
        // No config exists yet - auto-initialize if admin
        logger.debug(`[useGlobalColumns] No config found for ${panelKey}`);
        
        if (isAdmin && user) {
          logger.debug(`[useGlobalColumns] Admin detected, initializing config...`);
          const initialized = await initializeConfig();
          if (initialized) {
            // Fetch again after initialization
            const { data: newData } = await supabase
              .from("panel_column_configs")
              .select("columns")
              .eq("panel_key", panelKey)
              .maybeSingle();
            
            if (newData?.columns) {
              setState({ columns: newData.columns as unknown as ColumnConfig[], loading: false, error: null });
              toast.success("Estructura inicializada globalmente");
              return;
            }
          }
        }
        
        // Fallback to defaults
        setState({ columns: defaultColumns, loading: false, error: null });
      }
    } catch (err) {
      console.error("[useGlobalColumns] Unexpected error:", err);
      setState(prev => ({ ...prev, loading: false, error: "Error inesperado" }));
    }
  }, [panelKey, defaultColumns, isAdmin, user, initializeConfig]);

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
          logger.debug(`[useGlobalColumns] Realtime update for ${panelKey}:`, payload.eventType);
          
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

  // Save columns to database (admin only) - returns true on success, false on failure
  const setColumns = useCallback(async (newColumns: ColumnConfig[]): Promise<boolean> => {
    if (!isAdmin) {
      toast.error("Solo los administradores pueden modificar la estructura");
      return false;
    }

    if (!user) {
      toast.error("Debe iniciar sesión para guardar cambios");
      return false;
    }

    // Store previous state for rollback
    const previousColumns = state.columns;
    
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
        toast.error("Error al guardar la configuración: " + error.message);
        // Revert on error
        setState(prev => ({ ...prev, columns: previousColumns }));
        return false;
      }

      logger.debug(`[useGlobalColumns] Saved ${newColumns.length} columns for ${panelKey}`);
      toast.success("Estructura actualizada para todos los usuarios");
      return true;
    } catch (err) {
      console.error("[useGlobalColumns] Unexpected save error:", err);
      toast.error("Error inesperado al guardar");
      setState(prev => ({ ...prev, columns: previousColumns }));
      return false;
    }
  }, [isAdmin, user, panelKey, state.columns]);

  return {
    columns: state.columns,
    setColumns,
    loading: state.loading || roleLoading,
    error: state.error,
    isAdmin,
    refetch: fetchColumns,
  };
}
