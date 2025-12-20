import { useState, useEffect, useCallback } from "react";
import { ColumnConfig } from "@/components/ColumnManagerDialog";
import { logger } from "@/lib/logger";

export function usePersistedColumns(storageKey: string, defaultColumns: ColumnConfig[]) {
  const deletedKey = `${storageKey}-deleted`;
  
  // Initialize from localStorage
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      const deletedStored = localStorage.getItem(deletedKey);
      const deletedKeys = deletedStored ? new Set(JSON.parse(deletedStored)) : new Set();
      
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Check for missing base columns (but skip intentionally deleted ones)
          const existingKeys = new Set(parsed.map((c: ColumnConfig) => c.key));
          const missingBaseColumns = defaultColumns.filter(
            dc => !dc.isCustom && !existingKeys.has(dc.key) && !deletedKeys.has(dc.key)
          );
          
          if (missingBaseColumns.length > 0) {
            logger.debug(`[usePersistedColumns] Adding ${missingBaseColumns.length} missing base columns to ${storageKey}:`, missingBaseColumns.map(c => c.key));
            const merged = [...parsed];
            missingBaseColumns.forEach(mc => {
              const insertIndex = merged.findIndex(c => (c.order || 0) > (mc.order || 0));
              if (insertIndex === -1) {
                merged.push(mc);
              } else {
                merged.splice(insertIndex, 0, mc);
              }
            });
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
      logger.debug(`[usePersistedColumns] Saved ${columns.length} columns to ${storageKey}`);
    } catch (e) {
      console.error(`[usePersistedColumns] Error saving to ${storageKey}:`, e);
    }
  }, [columns, storageKey]);

  // Track deleted base columns so they don't get re-added
  const updateColumns = useCallback((newColumns: ColumnConfig[]) => {
    const copied = newColumns.map(col => ({ ...col }));
    
    // Find deleted base columns
    const currentKeys = new Set(copied.map(c => c.key));
    const deletedBaseKeys: string[] = [];
    
    defaultColumns.forEach(dc => {
      if (!dc.isCustom && !currentKeys.has(dc.key)) {
        deletedBaseKeys.push(dc.key);
      }
    });
    
    // Save deleted keys
    if (deletedBaseKeys.length > 0) {
      try {
        const existingDeleted = localStorage.getItem(deletedKey);
        const deletedSet = existingDeleted ? new Set(JSON.parse(existingDeleted)) : new Set();
        deletedBaseKeys.forEach(k => deletedSet.add(k));
        localStorage.setItem(deletedKey, JSON.stringify([...deletedSet]));
      } catch (e) {
        console.error(`[usePersistedColumns] Error saving deleted keys:`, e);
      }
    }
    
    setColumns(copied);
  }, [defaultColumns, deletedKey]);

  return [columns, updateColumns] as const;
}
