import { useState, useEffect, useCallback, useRef } from "react";
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
// Module-level cache to persist columns across component unmount/remount (page navigation)
const columnsCache = new Map<string, ColumnConfig[]>();

// Also persist to localStorage for instant first-paint (avoids layout shift on hard refresh)
function getPersistedCache(panelKey: string): ColumnConfig[] | null {
  try {
    const raw = localStorage.getItem(`global-cols-cache-${panelKey}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}
function setPersistedCache(panelKey: string, cols: ColumnConfig[]) {
  try {
    localStorage.setItem(`global-cols-cache-${panelKey}`, JSON.stringify(cols));
  } catch {}
}

export function useGlobalColumns(panelKey: string, defaultColumnsProp: ColumnConfig[]) {
  // Las paginas arman `defaultColumns` dentro del render, asi que llega un
  // arreglo nuevo en cada render. Antes ese arreglo estaba en las
  // dependencias de fetchColumns y de la suscripcion en vivo: cada render
  // volvia a consultar panel_column_configs, la respuesta hacia otro render, y
  // asi sin parar. Fueron unos 16 millones de consultas y tumbaron la base el
  // 3/11/2026. Ahora se guarda en una ref y los efectos dependen solo del panel
  // y del usuario.
  const defaultColumnsRef = useRef(defaultColumnsProp);
  defaultColumnsRef.current = defaultColumnsProp;
  const { user } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  
  const cachedColumns = columnsCache.get(panelKey) || getPersistedCache(panelKey);
  const initialColumns = cachedColumns || defaultColumnsProp;

  const [state, setState] = useState<GlobalColumnsState>({
    columns: initialColumns,
    loading: !cachedColumns, // not loading if cache hit
    error: null,
  });

  // Helper to update state and cache simultaneously
  const setStateAndCache = useCallback((newState: GlobalColumnsState) => {
    if (newState.columns) {
      columnsCache.set(panelKey, newState.columns);
      setPersistedCache(panelKey, newState.columns);
    }
    setState(newState);
  }, [panelKey]);

  const isAdmin = role === "administrador";

  // Initialize config in DB if it doesn't exist (admin only)
  const initializeConfig = useCallback(async () => {
    if (!user || !isAdmin) return false;
    
    try {
      const { error } = await supabase
        .from("panel_column_configs")
        .insert({
          panel_key: panelKey,
          columns: defaultColumnsRef.current as unknown as Json,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelKey, user?.id, isAdmin]);

  // Fetch columns from database
  const fetchColumns = useCallback(async () => {
    const defaultColumns = defaultColumnsRef.current;
    try {
      const { data, error } = await supabase
        .from("panel_column_configs")
        .select("columns")
        .eq("panel_key", panelKey)
        .maybeSingle();

      if (error) {
        console.error("[useGlobalColumns] Error fetching:", error);
        setStateAndCache({ columns: state.columns, loading: false, error: error.message });
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
        setStateAndCache({ columns: merged, loading: false, error: null });
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
              setStateAndCache({ columns: newData.columns as unknown as ColumnConfig[], loading: false, error: null });
              toast.success("Estructura inicializada globalmente");
              return;
            }
          }
        }
        
        // Fallback to defaults
        setStateAndCache({ columns: defaultColumns, loading: false, error: null });
      }
    } catch (err) {
      console.error("[useGlobalColumns] Unexpected error:", err);
      setStateAndCache({ columns: state.columns, loading: false, error: "Error inesperado" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelKey, isAdmin, user?.id, initializeConfig]);

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
            setStateAndCache({ columns: defaultColumnsRef.current, loading: false, error: null });
          } else if (payload.new && (payload.new as any).columns) {
            const newColumns = (payload.new as any).columns as ColumnConfig[];
            setStateAndCache({ columns: newColumns, loading: false, error: null });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelKey]);

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
    setStateAndCache({ ...state, columns: newColumns });

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
        setStateAndCache({ ...state, columns: previousColumns });
        return false;
      }

      logger.debug(`[useGlobalColumns] Saved ${newColumns.length} columns for ${panelKey}`);
      toast.success("Estructura actualizada para todos los usuarios");
      return true;
    } catch (err) {
      console.error("[useGlobalColumns] Unexpected save error:", err);
      toast.error("Error inesperado al guardar");
      setStateAndCache({ ...state, columns: previousColumns });
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
