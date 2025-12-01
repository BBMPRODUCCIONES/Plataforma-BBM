import { useState, useCallback, useMemo } from "react";
import { CellType } from "@/components/EditableCell";
import { ColumnConfig } from "@/components/ColumnManagerDialog";

interface BaseColumn {
  key: string;
  header: string;
  width: string;
  type?: CellType;
  options?: string[];
}

export function useColumnManager(baseColumns: BaseColumn[], storageKey: string) {
  // Initialize columns with base columns and load custom columns from state
  const [customColumns, setCustomColumns] = useState<ColumnConfig[]>([]);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});
  const [columnOrder, setColumnOrder] = useState<string[]>([]);

  // Convert base columns to ColumnConfig format
  const allColumns = useMemo(() => {
    const baseConfigs: ColumnConfig[] = baseColumns.map((col, index) => ({
      key: col.key,
      header: col.header,
      type: col.type || "text",
      width: col.width,
      options: col.options,
      visible: columnVisibility[col.key] !== false,
      isCustom: false,
      order: columnOrder.indexOf(col.key) !== -1 
        ? columnOrder.indexOf(col.key) 
        : index,
    }));

    const customConfigs: ColumnConfig[] = customColumns.map((col, index) => ({
      ...col,
      visible: columnVisibility[col.key] !== false,
      order: columnOrder.indexOf(col.key) !== -1 
        ? columnOrder.indexOf(col.key) 
        : baseConfigs.length + index,
    }));

    return [...baseConfigs, ...customConfigs].sort((a, b) => a.order - b.order);
  }, [baseColumns, customColumns, columnVisibility, columnOrder]);

  const handleColumnsChange = useCallback((newColumns: ColumnConfig[]) => {
    // Extract custom columns
    const newCustomColumns = newColumns.filter(col => col.isCustom);
    setCustomColumns(newCustomColumns);

    // Extract visibility state
    const newVisibility: Record<string, boolean> = {};
    newColumns.forEach(col => {
      newVisibility[col.key] = col.visible;
    });
    setColumnVisibility(newVisibility);

    // Extract order
    const newOrder = newColumns
      .sort((a, b) => a.order - b.order)
      .map(col => col.key);
    setColumnOrder(newOrder);
  }, []);

  const getVisibleColumns = useCallback(() => {
    return allColumns.filter(col => col.visible);
  }, [allColumns]);

  const addCustomColumn = useCallback((column: Omit<ColumnConfig, 'visible' | 'isCustom' | 'order'>) => {
    const newColumn: ColumnConfig = {
      ...column,
      visible: true,
      isCustom: true,
      order: allColumns.length,
    };
    setCustomColumns(prev => [...prev, newColumn]);
  }, [allColumns.length]);

  return {
    allColumns,
    customColumns,
    visibleColumns: getVisibleColumns(),
    handleColumnsChange,
    addCustomColumn,
    columnVisibility,
    setColumnVisibility,
  };
}
