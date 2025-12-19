import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface Column<T> {
  key: string;
  header: string;
  width?: string;
  render?: (item: T, index: number) => ReactNode;
  className?: string;
  /** Priority for mobile: 1 = always visible, 2 = important, 3+ = can scroll */
  mobilePriority?: number;
}

interface MobileTableWrapperProps<T extends { id: string }> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (item: T) => void;
  className?: string;
  highlightedId?: string;
  getRowClassName?: (item: T) => string;
  /** Key field to display as card title on mobile */
  titleKey?: string;
  /** Secondary info to show under title on mobile */
  subtitleKey?: string;
}

/**
 * MobileTableWrapper - Provides mobile-optimized horizontal scroll for tables
 * 
 * On mobile (PWA):
 * - Uses momentum-based horizontal scrolling
 * - Ensures all columns are visible and scrollable
 * - Touch-friendly with proper tap targets
 * 
 * On desktop:
 * - Renders as standard table
 */
export function MobileTableWrapper<T extends { id: string }>({
  data,
  columns,
  onRowClick,
  className,
  highlightedId,
  getRowClassName,
}: MobileTableWrapperProps<T>) {
  const isMobile = useIsMobile();

  // Calculate minimum table width based on column widths
  const totalWidth = columns.reduce((acc, col) => {
    const width = col.width ? parseInt(col.width) : 100;
    return acc + width;
  }, 0);

  return (
    <div 
      className={cn(
        "mobile-table-container",
        isMobile && "mobile-scroll-container",
        className
      )}
    >
      <div 
        className={cn(
          "mobile-table-inner",
          isMobile && "mobile-scroll-inner"
        )}
        style={isMobile ? { minWidth: `${Math.max(totalWidth, 800)}px` } : undefined}
      >
        <table className={cn(
          "matrix-table",
          isMobile && "mobile-matrix-table"
        )}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ 
                    width: col.width, 
                    minWidth: col.width,
                  }}
                  className={cn(
                    "mobile-table-th",
                    col.className
                  )}
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
                data-project-id={item.id}
                onClick={() => onRowClick?.(item)}
                className={cn(
                  onRowClick && "cursor-pointer touch-manipulation",
                  highlightedId === item.id && "bg-primary/20 ring-2 ring-primary ring-inset animate-pulse",
                  getRowClassName?.(item)
                )}
              >
                {columns.map((col) => (
                  <td 
                    key={col.key} 
                    style={{ 
                      width: col.width,
                      minWidth: col.width,
                    }} 
                    className={cn(
                      "mobile-table-td touch-manipulation",
                      col.className
                    )}
                  >
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
    </div>
  );
}
