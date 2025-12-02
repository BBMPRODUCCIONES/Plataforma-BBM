import { useState, useEffect, useCallback } from "react";
import { ColumnConfig } from "@/components/ColumnManagerDialog";

export function usePersistedColumns(storageKey: string, defaultColumns: ColumnConfig[]) {
  // Initialize from localStorage or use default columns
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
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
