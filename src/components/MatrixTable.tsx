import { ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

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
  /** Custom class name generator for rows */
  getRowClassName?: (item: T) => string;
}

export function MatrixTable<T extends { id: string }>({
  data,
  columns,
  onRowClick,
  className,
  highlightedId,
  noHorizontalScroll = false,
  getRowClassName,
}: MatrixTableProps<T>) {
  const isMobile = useIsMobile();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasScrolledRight, setHasScrolledRight] = useState(false);

  // Calculate minimum table width for mobile
  const totalWidth = columns.reduce((acc, col) => {
    const width = col.width ? parseInt(col.width) : 100;
    return acc + width;
  }, 0);

  // Track scroll position for visual indicator
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !isMobile) return;

    const handleScroll = () => {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      const isScrolledToEnd = scrollLeft + clientWidth >= scrollWidth - 20;
      setHasScrolledRight(isScrolledToEnd);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [isMobile]);

  // Mobile-optimized render - ALWAYS use horizontal scroll on mobile for usability
  // noHorizontalScroll only applies to desktop
  if (isMobile) {
    return (
      <div 
        ref={scrollRef}
        className={cn(
          "mobile-scroll-container",
          hasScrolledRight && "scrolled-right",
          className
        )}
      >
        <div 
          className="mobile-scroll-inner"
          style={{ minWidth: `${Math.max(totalWidth, 800)}px` }}
        >
          <table className="matrix-table mobile-matrix-table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    style={{ width: col.width, minWidth: col.width }}
                    className={cn("mobile-table-th", col.className)}
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
                      style={{ width: col.width, minWidth: col.width }} 
                      className={cn("mobile-table-td touch-manipulation", col.className)}
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

  // Desktop render (unchanged)
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
                  style={{ width: col.width }} 
                  className={cn("touch-manipulation", col.className)}
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
  );
}

