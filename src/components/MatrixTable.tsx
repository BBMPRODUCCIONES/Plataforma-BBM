import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Column<T> {
  key: string;
  header: string;
  width?: string;
  render?: (item: T, index: number) => ReactNode;
  className?: string;
}

interface MatrixTableProps<T extends { id: string }> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (item: T) => void;
  className?: string;
  highlightedId?: string;
  /** If true, table will not scroll horizontally and columns will flex */
  noHorizontalScroll?: boolean;
}

export function MatrixTable<T extends { id: string }>({
  data,
  columns,
  onRowClick,
  className,
  highlightedId,
  noHorizontalScroll = false,
}: MatrixTableProps<T>) {
  return (
    <div className={cn(
      noHorizontalScroll ? "overflow-hidden w-full" : "overflow-x-auto scrollbar-thin", 
      className
    )}>
      <table className={cn(
        "matrix-table",
        noHorizontalScroll && "w-full table-fixed"
      )}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{ width: col.width, minWidth: col.width }}
                className={cn(col.className)}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, idx) => (
            <tr
              key={item.id}
              onClick={() => onRowClick?.(item)}
              className={cn(
                onRowClick && "cursor-pointer",
                highlightedId === item.id && "bg-primary/20 ring-2 ring-primary ring-inset"
              )}
            >
              {columns.map((col) => (
                <td key={col.key} style={{ width: col.width }} className={cn(col.className)}>
                  {col.render
                    ? col.render(item, idx)
                    : (item as Record<string, unknown>)[col.key]?.toString() || "-"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
