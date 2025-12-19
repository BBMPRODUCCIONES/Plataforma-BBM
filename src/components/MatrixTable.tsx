import { ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChevronRight } from "lucide-react";

interface Column<T> {
  key: string;
  header: string;
  width?: string;
  render?: (item: T, index: number) => ReactNode;
  className?: string;
  /** Priority for mobile card view: 1 = title, 2 = subtitle, 3 = badge/status */
  mobilePriority?: number;
  /** Hide this column in mobile card view */
  hideOnMobile?: boolean;
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
  /** Force table view on mobile instead of cards (for complex tables) */
  forceTableOnMobile?: boolean;
  /** Key for title in mobile card view (defaults to first column) */
  mobileTitleKey?: string;
  /** Key for subtitle in mobile card view */
  mobileSubtitleKey?: string;
  /** Key for badge/status in mobile card view */
  mobileBadgeKey?: string;
}

export function MatrixTable<T extends { id: string }>({
  data,
  columns,
  onRowClick,
  className,
  highlightedId,
  noHorizontalScroll = false,
  getRowClassName,
  forceTableOnMobile = false,
  mobileTitleKey,
  mobileSubtitleKey,
  mobileBadgeKey,
}: MatrixTableProps<T>) {
  const isMobile = useIsMobile();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasScrolledRight, setHasScrolledRight] = useState(false);

  // Calculate minimum table width for mobile table fallback
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

  // Determine which columns to use for card layout
  const titleKey = mobileTitleKey || columns.find(c => c.mobilePriority === 1)?.key || columns[0]?.key;
  const subtitleKey = mobileSubtitleKey || columns.find(c => c.mobilePriority === 2)?.key;
  const badgeKey = mobileBadgeKey || columns.find(c => c.mobilePriority === 3)?.key;

  const titleCol = columns.find(c => c.key === titleKey);
  const subtitleCol = subtitleKey ? columns.find(c => c.key === subtitleKey) : undefined;
  const badgeCol = badgeKey ? columns.find(c => c.key === badgeKey) : undefined;
  
  // Secondary fields for card body (exclude title, subtitle, badge, and hidden columns)
  const secondaryColumns = columns.filter(c => 
    c.key !== titleKey && 
    c.key !== subtitleKey && 
    c.key !== badgeKey &&
    !c.hideOnMobile
  );

  // Helper to render field value
  const renderFieldValue = (item: T, col: Column<T>, idx: number): ReactNode => {
    if (col.render) {
      return col.render(item, idx);
    }
    const value = (item as Record<string, unknown>)[col.key];
    return value?.toString() || "-";
  };

  // Mobile Card View - default for mobile
  if (isMobile && !forceTableOnMobile) {
    if (data.length === 0) {
      return (
        <div className="mobile-card-empty">
          <p className="text-muted-foreground text-sm text-center py-8">
            No hay datos disponibles
          </p>
        </div>
      );
    }

    return (
      <div className={cn("mobile-card-container", className)}>
        {data.map((item, idx) => (
          <div
            key={item.id}
            data-project-id={item.id}
            className={cn(
              "mobile-card",
              onRowClick && "mobile-card-clickable",
              highlightedId === item.id && "mobile-card-highlighted",
              getRowClassName?.(item)
            )}
            onClick={() => onRowClick?.(item)}
          >
            {/* Header: Title + Badge */}
            <div className="mobile-card-header">
              <div className="mobile-card-title-group">
                {titleCol && (
                  <h3 className="mobile-card-title">
                    {renderFieldValue(item, titleCol, idx)}
                  </h3>
                )}
                {subtitleCol && (
                  <p className="mobile-card-subtitle">
                    {renderFieldValue(item, subtitleCol, idx)}
                  </p>
                )}
              </div>
              
              <div className="mobile-card-badge-area">
                {badgeCol && (
                  <div className="mobile-card-badge">
                    {renderFieldValue(item, badgeCol, idx)}
                  </div>
                )}
                {onRowClick && (
                  <ChevronRight className="mobile-card-chevron" />
                )}
              </div>
            </div>

            {/* Body: Secondary fields in grid */}
            {secondaryColumns.length > 0 && (
              <div className="mobile-card-body">
                {secondaryColumns.slice(0, 6).map((col) => (
                  <div key={col.key} className="mobile-card-field">
                    <span className="mobile-card-field-label">{col.header}</span>
                    <span className="mobile-card-field-value">
                      {renderFieldValue(item, col, idx)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Mobile Table Fallback (when forceTableOnMobile is true)
  if (isMobile && forceTableOnMobile) {
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
