import { useRef, useCallback } from "react";
import { GripHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

interface DragReorderHandleProps {
  index: number;
  totalItems: number;
  onReorder: (fromIndex: number, toIndex: number) => void;
  className?: string;
}

/**
 * Drag handle with visual animation:
 * - Row "lifts" on grab (shadow + scale)
 * - A ghost clone follows the cursor
 * - Drop target is highlighted
 * - Smooth settle animation on release
 */
export function DragReorderHandle({ index, totalItems, onReorder, className }: DragReorderHandleProps) {
  const startY = useRef(0);
  const currentFromIndex = useRef(index);
  const isDragging = useRef(false);
  const cloneRef = useRef<HTMLElement | null>(null);
  const sourceRowRef = useRef<HTMLElement | null>(null);
  const allRowsRef = useRef<HTMLElement[]>([]);
  const lastHighlightedRef = useRef<HTMLElement | null>(null);

  const getParentRow = (el: HTMLElement): HTMLElement | null => {
    let node: HTMLElement | null = el;
    while (node && node.tagName !== "TR") {
      node = node.parentElement;
    }
    return node;
  };

  const getAllSiblingRows = (row: HTMLElement): HTMLElement[] => {
    const tbody = row.parentElement;
    if (!tbody) return [];
    return Array.from(tbody.querySelectorAll("tr"));
  };

  const getRowHeight = (): number => {
    if (allRowsRef.current.length > 0) {
      return allRowsRef.current[0].getBoundingClientRect().height;
    }
    return 52;
  };

  const createClone = (row: HTMLElement, clientY: number) => {
    const rect = row.getBoundingClientRect();
    const clone = row.cloneNode(true) as HTMLElement;
    
    clone.style.position = "fixed";
    clone.style.top = `${rect.top}px`;
    clone.style.left = `${rect.left}px`;
    clone.style.width = `${rect.width}px`;
    clone.style.height = `${rect.height}px`;
    clone.style.zIndex = "9999";
    clone.style.pointerEvents = "none";
    clone.style.transition = "none";
    clone.style.boxShadow = "0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.12)";
    clone.style.transform = "scale(1.02)";
    clone.style.opacity = "0.95";
    clone.style.borderRadius = "6px";
    clone.style.background = "hsl(var(--card))";
    clone.style.willChange = "top";
    
    document.body.appendChild(clone);
    cloneRef.current = clone;

    // Store offset from cursor to row top
    (clone as any).__offsetY = clientY - rect.top;
  };

  const moveClone = (clientY: number) => {
    const clone = cloneRef.current;
    if (!clone) return;
    const offset = (clone as any).__offsetY || 0;
    clone.style.top = `${clientY - offset}px`;
  };

  const highlightTarget = (targetIdx: number) => {
    // Remove previous highlight
    if (lastHighlightedRef.current) {
      lastHighlightedRef.current.style.boxShadow = "";
      lastHighlightedRef.current.style.borderTop = "";
      lastHighlightedRef.current.style.borderBottom = "";
    }

    const rows = allRowsRef.current;
    const targetRow = rows[targetIdx];
    if (!targetRow || targetIdx === currentFromIndex.current) {
      lastHighlightedRef.current = null;
      return;
    }

    if (targetIdx < currentFromIndex.current) {
      targetRow.style.borderTop = "2px solid hsl(var(--primary))";
    } else {
      targetRow.style.borderBottom = "2px solid hsl(var(--primary))";
    }
    lastHighlightedRef.current = targetRow;
  };

  const cleanupClone = (targetRect?: DOMRect) => {
    const clone = cloneRef.current;
    if (!clone) return;
    
    if (targetRect) {
      // Animate clone to target position
      clone.style.transition = "top 0.2s cubic-bezier(0.2,0,0,1), transform 0.2s ease, opacity 0.2s ease, box-shadow 0.2s ease";
      clone.style.top = `${targetRect.top}px`;
      clone.style.transform = "scale(1)";
      clone.style.opacity = "0.7";
      clone.style.boxShadow = "0 1px 3px rgba(0,0,0,0.08)";
      
      setTimeout(() => {
        clone.remove();
        cloneRef.current = null;
      }, 200);
    } else {
      clone.remove();
      cloneRef.current = null;
    }
  };

  const cleanupSource = () => {
    const src = sourceRowRef.current;
    if (src) {
      src.style.opacity = "";
      src.style.background = "";
      sourceRowRef.current = null;
    }
  };

  const cleanupHighlight = () => {
    if (lastHighlightedRef.current) {
      lastHighlightedRef.current.style.boxShadow = "";
      lastHighlightedRef.current.style.borderTop = "";
      lastHighlightedRef.current.style.borderBottom = "";
      lastHighlightedRef.current = null;
    }
  };

  const handlePointerDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const target = e.currentTarget as HTMLElement;
    const row = getParentRow(target);
    if (!row) return;

    startY.current = clientY;
    currentFromIndex.current = index;
    isDragging.current = true;
    sourceRowRef.current = row;
    allRowsRef.current = getAllSiblingRows(row);

    // Dim original row
    row.style.opacity = "0.3";
    row.style.background = "hsl(var(--muted))";

    // Create floating clone
    createClone(row, clientY);

    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      if (!isDragging.current) return;
      if ("touches" in moveEvent) moveEvent.preventDefault();

      const cy = "touches" in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
      moveClone(cy);

      const rowHeight = getRowHeight();
      const deltaY = cy - startY.current;
      const steps = Math.round(deltaY / rowHeight);
      const newIndex = Math.max(0, Math.min(totalItems - 1, index + steps));

      highlightTarget(newIndex);

      // Only commit reorder when target changes
      if (newIndex !== currentFromIndex.current) {
        onReorder(currentFromIndex.current, newIndex);
        currentFromIndex.current = newIndex;
        // Re-read rows after DOM update
        if (sourceRowRef.current?.parentElement) {
          allRowsRef.current = Array.from(sourceRowRef.current.parentElement.querySelectorAll("tr"));
        }
      }
    };

    const handleUp = () => {
      isDragging.current = false;
      
      // Animate clone to final position
      const rows = allRowsRef.current;
      const targetRow = rows[currentFromIndex.current];
      const targetRect = targetRow?.getBoundingClientRect();
      
      cleanupHighlight();
      cleanupSource();
      cleanupClone(targetRect);

      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
      document.removeEventListener("touchmove", handleMove);
      document.removeEventListener("touchend", handleUp);
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
    document.addEventListener("touchmove", handleMove, { passive: false });
    document.addEventListener("touchend", handleUp);
  }, [index, totalItems, onReorder]);

  return (
    <div
      onMouseDown={handlePointerDown}
      onTouchStart={handlePointerDown as any}
      className={cn(
        "cursor-grab active:cursor-grabbing flex items-center justify-center p-1 rounded hover:bg-muted/60 select-none transition-colors",
        className
      )}
      title="Mantener clic y arrastrar para reordenar"
    >
      <GripHorizontal className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}
