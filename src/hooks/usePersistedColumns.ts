import { useState, useEffect, useCallback, useRef } from "react";
import { ColumnConfig } from "@/components/ColumnManagerDialog";

export function usePersistedColumns(storageKey: string, defaultColumns: ColumnConfig[]) {
  const hasInitialized = useRef(false);
  
  // Initialize from localStorage, merging missing base columns
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Check for missing base columns and add them
          const existingKeys = new Set(parsed.map((c: ColumnConfig) => c.key));
          const missingBaseColumns = defaultColumns.filter(
            dc => !dc.isCustom && !existingKeys.has(dc.key)
          );
          
          if (missingBaseColumns.length > 0) {
            console.log(`[usePersistedColumns] Adding ${missingBaseColumns.length} missing base columns to ${storageKey}:`, missingBaseColumns.map(c => c.key));
            // Add missing columns at appropriate positions based on their order
            const merged = [...parsed];
            missingBaseColumns.forEach(mc => {
              // Find the right position based on order
              const insertIndex = merged.findIndex(c => (c.order || 0) > (mc.order || 0));
              if (insertIndex === -1) {
                merged.push(mc);
              } else {
                merged.splice(insertIndex, 0, mc);
              }
            });
            // Re-calculate order
            merged.forEach((col, idx) => col.order = idx);
            return merged;
          }
          return parsed;
        }
      }
    } catch (e) {
      console.error(`[usePersistedColumns] Error loading from ${storageKey}:`, e);
    }
    return defaultColumns;
  });

  // Persist to localStorage whenever columns change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(columns));
      console.log(`[usePersistedColumns] Saved ${columns.length} columns to ${storageKey}`);
    } catch (e) {
      console.error(`[usePersistedColumns] Error saving to ${storageKey}:`, e);
    }
  }, [columns, storageKey]);

  // Memoized setter that ensures new references
  const updateColumns = useCallback((newColumns: ColumnConfig[]) => {
    const copied = newColumns.map(col => ({ ...col }));
    setColumns(copied);
  }, []);

  return [columns, updateColumns] as const;
}
