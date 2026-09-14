import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface Column<T> {
  key: string;
  header: ReactNode;
  width?: string;
  /** Mobile-specific width (used only in ACW/mobile view) */
  mobileWidth?: string;
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

/**
 * Clase que marca la columna congelada (sticky) al hacer scroll horizontal.
 * El CSS engancha con esta clase, no con :first-child, para que la columna
 * congelada siga siendo la correcta aunque el usuario reordene columnas.
 */
const STICKY_COL_CLASS = "matrix-sticky-col";

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

  // --- Sticky horizontal scrollbar refs/state (desktop only, but hooks must be top-level) ---
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const stickyScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingRef = useRef(false);
  const [tableContentWidth, setTableContentWidth] = useState(0);

  const syncScroll = useCallback((source: "table" | "sticky") => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    const from = source === "table" ? tableScrollRef.current : stickyScrollRef.current;
    const to = source === "table" ? stickyScrollRef.current : tableScrollRef.current;
    if (from && to) {
      to.scrollLeft = from.scrollLeft;
    }
    requestAnimationFrame(() => { isSyncingRef.current = false; });
  }, []);

  // Measure table content width (desktop)
  useEffect(() => {
    if (isMobile || noHorizontalScroll) return;
    const el = tableScrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setTableContentWidth(el.scrollWidth);
    });
    observer.observe(el);
    const table = el.querySelector("table");
    if (table) observer.observe(table);
    return () => observer.disconnect();
  }, [isMobile, noHorizontalScroll, columns.length, data.length]);

  /**
   * En movil la columna marcada con STICKY_COL_CLASS se mueve al primer lugar
   * (en el Panel de Operaciones es "Evento": al deslizar en horizontal hay que
   * seguir viendo de que evento se trata, no su centro de costos).
   * En escritorio se conserva el orden tal cual y se congela la primera columna.
   */
  const orderedColumns = (() => {
    if (!isMobile) return columns;
    const idx = columns.findIndex((col) => col.className?.includes(STICKY_COL_CLASS));
    if (idx <= 0) return columns;
    return [columns[idx], ...columns.filter((_, i) => i !== idx)];
  })();

  const resolvedColumns = orderedColumns.map((col, i) => ({
    ...col,
    className: cn(
      col.className?.split(" ").filter((c) => c !== STICKY_COL_CLASS).join(" "),
      i === 0 && STICKY_COL_CLASS
    ),
  }));

  // Calculate minimum table width for proper horizontal scroll
  // Mobile uses mobileWidth if available, desktop ALWAYS uses width only
  const totalWidth = resolvedColumns.reduce((acc, col) => {
    const widthStr = isMobile ? (col.mobileWidth || col.width) : col.width;
    const width = widthStr ? parseInt(widthStr) : 100;
    return acc + width;
  }, 0);

  // Track scroll position for visual indicators (left and right edges)
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !isMobile) return;

    const handleScroll = () => {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      const isScrolledToEnd = scrollLeft + clientWidth >= scrollWidth - 20;
      const isScrolledFromStart = scrollLeft > 10;
      
      setHasScrolledRight(isScrolledToEnd);
      
      // Toggle left scroll indicator class
      if (isScrolledFromStart) {
        container.classList.add("scrolled-left");
      } else {
        container.classList.remove("scrolled-left");
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initial check
    return () => container.removeEventListener("scroll", handleScroll);
  }, [isMobile]);

  // Mobile: Always render as matrix with horizontal touch scroll
  if (isMobile) {
    return (
      <div 
        ref={scrollRef}
        className={cn(
          "mobile-scroll-container mobile-table-scroll",
          hasScrolledRight && "scrolled-right",
          className
        )}
        style={{ 
          overscrollBehavior: 'contain',
          touchAction: 'pan-x pan-y'
        }}
      >
        <div 
          className="mobile-scroll-inner"
          style={{ minWidth: `${Math.max(totalWidth, 800)}px` }}
        >
          <table className="matrix-table mobile-matrix-table">
            <thead>
              <tr>
                {resolvedColumns.map((col) => {
                  // Use mobileWidth if available, otherwise fall back to width
                  const mobileW = col.mobileWidth || col.width;
                  return (
                    <th
                      key={col.key}
                      style={{ width: mobileW, minWidth: mobileW }}
                      className={cn("mobile-table-th", col.className)}
                    >
                      {col.header}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {data.map((item, idx) => (
                <tr
                  key={item.id}
                  data-project-id={item.id}
                  onClick={() => onRowClick?.(item)}
                  className={cn(
                    "mobile-touch-row",
                    onRowClick && "cursor-pointer touch-manipulation",
                    highlightedId === item.id && "bg-primary/20 ring-2 ring-primary ring-inset animate-pulse",
                    getRowClassName?.(item)
                  )}
                >
                  {resolvedColumns.map((col) => {
                    const mobileW = col.mobileWidth || col.width;
                    return (
                      <td 
                        key={col.key} 
                        style={{ width: mobileW, minWidth: mobileW }} 
                        className={cn("mobile-table-td touch-manipulation mobile-touch-cell", col.className)}
                      >
                        {col.render
                          ? col.render(item, idx)
                          : (item as Record<string, unknown>)[col.key]?.toString() || "-"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }


  // Desktop render - when noHorizontalScroll, columns distribute proportionally (no fixed widths)
  return (
    <div className="matrix-table-sticky-wrapper">
      <div
        ref={tableScrollRef}
        className={cn(
          noHorizontalScroll ? "overflow-hidden w-full" : "matrix-table-main-scroll",
          className
        )}
        onScroll={() => !noHorizontalScroll && syncScroll("table")}
      >
        <table className={cn(
          "matrix-table",
          noHorizontalScroll && "w-full table-fixed"
        )}>
          <thead>
            <tr>
              {resolvedColumns.map((col) => (
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
                {resolvedColumns.map((col) => (
                  <td
                    key={col.key}
                    style={{ width: col.width, minWidth: col.width }}
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

      {/* Sticky horizontal scrollbar - only when horizontal scroll is needed */}
      {!noHorizontalScroll && tableContentWidth > 0 && (
        <div
          ref={stickyScrollRef}
          className="matrix-table-sticky-scrollbar"
          onScroll={() => syncScroll("sticky")}
        >
          <div style={{ width: tableContentWidth, height: 1 }} />
        </div>
      )}
    </div>
  );
}
