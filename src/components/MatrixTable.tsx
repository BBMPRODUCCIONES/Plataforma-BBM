import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Columns3, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { fondoDeColor } from "@/lib/coloresProyecto";

interface Column<T> {
  key: string;
  header: ReactNode;
  /**
   * Titulo en texto plano. El header suele ser un boton con flechas de orden,
   * que en una tarjeta no sirve: ahi hace falta la palabra sola.
   */
  label?: string;
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
  /**
   * Columnas que se muestran por defecto en celular ("vista rapida").
   * Sin esto, el celular hereda las 21 columnas del escritorio y toca
   * deslizar media docena de pantallas para llegar al final.
   */
  mobileKeys?: string[];
  /** Clave para recordar si el usuario prefiere ver todas las columnas. */
  mobilePreferenceKey?: string;
  /**
   * Franja de color al inicio de la fila (por ejemplo, el autor del evento).
   * Devolver null para las filas que no llevan color.
   */
  getRowAccent?: (item: T) => { color: string; label: string } | null;
  /**
   * Estilo que se aplica a toda la fila (por ejemplo, el color manual del
   * Panel Directivo). Se pinta celda por celda para que la columna congelada
   * tambien quede del mismo color.
   */
  getRowStyle?: (item: T) => React.CSSProperties | undefined;
  /**
   * En celular, la vista rapida se dibuja como tarjetas en vez de tabla.
   * Una tabla de cuatro columnas en 380 px parte las palabras y descuadra las
   * casillas; la tarjeta usa el ancho completo y se lee de un vistazo.
   * Pasar false para conservar la tabla reducida de siempre.
   */
  mobileCards?: boolean;
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
  mobileKeys,
  mobilePreferenceKey,
  getRowAccent,
  getRowStyle,
  mobileCards = true,
}: MatrixTableProps<T>) {
  const isMobile = useIsMobile();

  const preferenceKey = mobilePreferenceKey ? `bbm_matrix_all_cols_${mobilePreferenceKey}` : null;
  const [showAllColumns, setShowAllColumns] = useState<boolean>(() => {
    if (!preferenceKey) return false;
    try {
      return localStorage.getItem(preferenceKey) === "1";
    } catch {
      return false;
    }
  });

  const toggleAllColumns = useCallback(() => {
    setShowAllColumns((prev) => {
      const next = !prev;
      if (preferenceKey) {
        try {
          localStorage.setItem(preferenceKey, next ? "1" : "0");
        } catch {
          /* modo incognito */
        }
      }
      return next;
    });
  }, [preferenceKey]);

  const hasQuickView = Boolean(isMobile && mobileKeys && mobileKeys.length > 0);
  const isQuickView = hasQuickView && !showAllColumns;
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
  // En vista rapida solo quedan las columnas clave, en el orden en que se pidieron.
  const baseColumns = isQuickView
    ? (mobileKeys as string[])
        .map((key) => columns.find((col) => col.key === key))
        .filter((col): col is Column<T> => Boolean(col))
    : columns;

  const orderedColumns = (() => {
    if (!isMobile) return baseColumns;
    const idx = baseColumns.findIndex((col) => col.className?.includes(STICKY_COL_CLASS));
    if (idx <= 0) return baseColumns;
    return [baseColumns[idx], ...baseColumns.filter((_, i) => i !== idx)];
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

  // Reparto de ancho en vista rapida: la columna del evento se lleva el 38%
  // y el resto se divide en partes iguales. Asi cabe todo sin scroll lateral.
  const quickWidth = (index: number) => {
    if (!isQuickView) return undefined;
    if (resolvedColumns.length === 1) return "100%";
    return index === 0 ? "38%" : `${(62 / (resolvedColumns.length - 1)).toFixed(2)}%`;
  };

  const etiquetaDe = (col: Column<T>): string =>
    col.label ?? (typeof col.header === "string" ? col.header : col.key);

  const valorDe = (col: Column<T>, item: T, idx: number): ReactNode =>
    col.render
      ? col.render(item, idx)
      : ((item as Record<string, unknown>)[col.key]?.toString() || "—");

  /** Cabecera compartida por la tabla reducida y las tarjetas. */
  const barraVistaRapida = hasQuickView ? (
    <div className="flex items-center justify-between gap-2 px-1 py-1.5">
      <span className="text-[11px] text-muted-foreground">
        {isQuickView
          ? `${data.length} evento${data.length === 1 ? "" : "s"}`
          : `Todas las columnas (${columns.length})`}
      </span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={toggleAllColumns}
        className="h-8 shrink-0 gap-1.5 px-3 text-xs"
      >
        {isQuickView ? <Columns3 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
        {isQuickView ? "Ver tabla" : "Ver tarjetas"}
      </Button>
    </div>
  ) : null;

  /**
   * Celular, vista rapida: tarjetas.
   * La primera columna (el evento) es el titulo; las demas van como
   * etiqueta/valor en dos columnas. El color del comercial se ve tres veces —
   * franja lateral, fondo suave y nombre — para que no dependa de fijarse.
   */
  if (isMobile && isQuickView && mobileCards) {
    const [principal, ...secundarias] = resolvedColumns;
    return (
      <div className="flex flex-col">
        {barraVistaRapida}
        {data.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No hay eventos que coincidan con el filtro.
          </div>
        ) : (
          <div className="flex flex-col gap-2 pb-2">
            {data.map((item, idx) => {
              const acento = getRowAccent?.(item) ?? null;
              const estilo = getRowStyle?.(item);
              const resaltada = highlightedId === item.id;
              return (
                <div
                  key={item.id}
                  data-project-id={item.id}
                  onClick={() => onRowClick?.(item)}
                  className={cn(
                    "matrix-card rounded-xl border border-border/70 bg-card px-3 py-2.5 shadow-sm",
                    onRowClick && "cursor-pointer touch-manipulation active:opacity-80",
                    resaltada && "ring-2 ring-primary",
                    getRowClassName?.(item)
                  )}
                  style={{
                    ...(estilo || {}),
                    ...(acento
                      ? { borderLeftWidth: 4, borderLeftStyle: "solid", borderLeftColor: acento.color }
                      : {}),
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 break-words text-[15px] font-semibold leading-snug">
                      {principal ? valorDe(principal, item, idx) : null}
                    </div>
                    {acento && (
                      <span
                        className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                        style={{
                          color: acento.color,
                          borderColor: acento.color,
                          backgroundColor: fondoDeColor(acento.color, 0.14),
                        }}
                      >
                        {acento.label}
                      </span>
                    )}
                  </div>

                  {secundarias.length > 0 && (
                    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
                      {secundarias.map((col) => (
                        <div key={col.key} className="min-w-0">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            {etiquetaDe(col)}
                          </div>
                          <div className="mt-0.5 min-w-0 break-words text-sm leading-tight">
                            {valorDe(col, item, idx)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Mobile: Always render as matrix with horizontal touch scroll
  if (isMobile) {
    return (
      <div className="flex flex-col">
        {barraVistaRapida}
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
          style={isQuickView ? { minWidth: "100%", width: "100%", display: "block" } : { minWidth: `${Math.max(totalWidth, 800)}px` }}
        >
          <table className={cn("matrix-table mobile-matrix-table", isQuickView && "mobile-matrix-reduced")}>
            <thead>
              <tr>
                {resolvedColumns.map((col, colIdx) => {
                  const qw = quickWidth(colIdx);
                  const mobileW = qw || col.mobileWidth || col.width;
                  return (
                    <th
                      key={col.key}
                      style={qw ? { width: qw } : { width: mobileW, minWidth: mobileW }}
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
                  {resolvedColumns.map((col, colIdx) => {
                    const qw = quickWidth(colIdx);
                    const mobileW = qw || col.mobileWidth || col.width;
                    const accent = colIdx === 0 ? getRowAccent?.(item) : null;
                    const rowStyle = getRowStyle?.(item);
                    return (
                      <td 
                        key={col.key} 
                        style={{
                          ...(qw ? { width: qw } : { width: mobileW, minWidth: mobileW }),
                          ...(rowStyle || {}),
                          ...(accent ? { borderLeft: `4px solid ${accent.color}` } : {}),
                        }}
                        title={accent?.label}
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
                {resolvedColumns.map((col, colIdx) => {
                  const accent = colIdx === 0 ? getRowAccent?.(item) : null;
                  const rowStyle = getRowStyle?.(item);
                  return (
                  <td
                    key={col.key}
                    style={{
                      width: col.width,
                      minWidth: col.width,
                      ...(rowStyle || {}),
                      ...(accent ? { borderLeft: `4px solid ${accent.color}` } : {}),
                    }}
                    title={accent?.label}
                    className={cn("touch-manipulation", col.className)}
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
