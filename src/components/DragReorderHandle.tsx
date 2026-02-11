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
 * Drag handle with free multi-position movement.
 * - Row lifts with shadow on grab
 * - Clone follows cursor freely, clamped to the inventory table bounds
 * - Drop indicator shows target position
 * - Reorder commits only on release for smooth experience
 */
export function DragReorderHandle({ index, totalItems, onReorder, className }: DragReorderHandleProps) {
  const startY = useRef(0);
  const targetIndex = useRef(index);
  const isDragging = useRef(false);
  const cloneRef = useRef<HTMLElement | null>(null);
  const sourceRowRef = useRef<HTMLElement | null>(null);
  const allRowsRef = useRef<HTMLElement[]>([]);
  const lastHighlightedRef = useRef<HTMLElement | null>(null);
  const containerBounds = useRef<{ top: number; bottom: number } | null>(null);

  const getParentRow = (el: HTMLElement): HTMLElement | null => {
    let node: HTMLElement | null = el;
    while (node && node.tagName !== "TR") node = node.parentElement;
    return node;
  };

  const getTableContainer = (row: HTMLElement): HTMLElement | null => {
    // Walk up to find the scrollable container or the inventory section
    let node: HTMLElement | null = row;
    while (node) {
      if (node.tagName === "TBODY" || node.tagName === "TABLE") {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  };

  const getAllSiblingRows = (row: HTMLElement): HTMLElement[] => {
    const tbody = row.parentElement;
    if (!tbody) return [];
    return Array.from(tbody.querySelectorAll(":scope > tr"));
  };

  const createClone = (row: HTMLElement, clientY: number) => {
    const rect = row.getBoundingClientRect();
    const clone = row.cloneNode(true) as HTMLElement;

    clone.style.cssText = `
      position: fixed;
      top: ${rect.top}px;
      left: ${rect.left}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      z-index: 9999;
      pointer-events: none;
      box-shadow: 0 12px 40px rgba(0,0,0,0.22), 0 4px 12px rgba(0,0,0,0.15);
      transform: scale(1.03);
      opacity: 0.95;
      border-radius: 6px;
      background: hsl(var(--card));
      will-change: top;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    `;

    document.body.appendChild(clone);
    cloneRef.current = clone;
    (clone as any).__offsetY = clientY - rect.top;
  };

  const moveClone = (clientY: number) => {
    const clone = cloneRef.current;
    if (!clone) return;
    const offset = (clone as any).__offsetY || 0;
    let newTop = clientY - offset;

    // Clamp to container bounds
    const bounds = containerBounds.current;
    if (bounds) {
      const cloneH = clone.getBoundingClientRect().height;
      newTop = Math.max(bounds.top, Math.min(bounds.bottom - cloneH, newTop));
    }

    clone.style.top = `${newTop}px`;
  };

  const computeTargetIndex = (clientY: number): number => {
    const rows = allRowsRef.current;
    if (rows.length === 0) return index;

    // Find which row the cursor is over based on row midpoints
    for (let i = 0; i < rows.length; i++) {
      const rect = rows[i].getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (clientY < midY) return i;
    }
    return rows.length - 1;
  };

  const highlightTarget = (tIdx: number) => {
    // Clear previous
    if (lastHighlightedRef.current) {
      lastHighlightedRef.current.style.borderTop = "";
      lastHighlightedRef.current.style.borderBottom = "";
    }

    const rows = allRowsRef.current;
    if (tIdx === index) {
      lastHighlightedRef.current = null;
      return;
    }

    // Show indicator line at target position
    if (tIdx < index) {
      const row = rows[tIdx];
      if (row) {
        row.style.borderTop = "2.5px solid hsl(var(--primary))";
        lastHighlightedRef.current = row;
      }
    } else {
      const row = rows[tIdx];
      if (row) {
        row.style.borderBottom = "2.5px solid hsl(var(--primary))";
        lastHighlightedRef.current = row;
      }
    }
  };

  const cleanup = () => {
    // Cleanup highlight
    if (lastHighlightedRef.current) {
      lastHighlightedRef.current.style.borderTop = "";
      lastHighlightedRef.current.style.borderBottom = "";
      lastHighlightedRef.current = null;
    }
    // Cleanup source row
    if (sourceRowRef.current) {
      sourceRowRef.current.style.opacity = "";
      sourceRowRef.current.style.background = "";
      sourceRowRef.current = null;
    }
  };

  const cleanupClone = (finalRect?: DOMRect) => {
    const clone = cloneRef.current;
    if (!clone) return;

    if (finalRect) {
      clone.style.transition = "top 0.2s cubic-bezier(0.2,0,0,1), transform 0.2s ease, opacity 0.2s ease, box-shadow 0.2s ease";
      clone.style.top = `${finalRect.top}px`;
      clone.style.transform = "scale(1)";
      clone.style.opacity = "0.6";
      clone.style.boxShadow = "0 1px 3px rgba(0,0,0,0.08)";
      setTimeout(() => { clone.remove(); cloneRef.current = null; }, 220);
    } else {
      clone.remove();
      cloneRef.current = null;
    }
  };

  const handlePointerDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const el = e.currentTarget as HTMLElement;
    const row = getParentRow(el);
    if (!row) return;

    isDragging.current = true;
    startY.current = clientY;
    targetIndex.current = index;
    sourceRowRef.current = row;
    allRowsRef.current = getAllSiblingRows(row);

    // Get container bounds for clamping
    const container = getTableContainer(row);
    if (container) {
      const cRect = container.getBoundingClientRect();
      containerBounds.current = { top: cRect.top, bottom: cRect.bottom };
    }

    // Dim source row
    row.style.opacity = "0.25";
    row.style.background = "hsl(var(--muted))";

    createClone(row, clientY);

    const handleMove = (ev: MouseEvent | TouchEvent) => {
      if (!isDragging.current) return;
      if ("touches" in ev) ev.preventDefault();

      const cy = "touches" in ev ? ev.touches[0].clientY : ev.clientY;
      moveClone(cy);

      const newTarget = computeTargetIndex(cy);
      targetIndex.current = newTarget;
      highlightTarget(newTarget);
    };

    const handleUp = () => {
      isDragging.current = false;

      const finalTarget = targetIndex.current;

      // Get target row rect for settle animation
      const rows = allRowsRef.current;
      const destRow = rows[finalTarget];
      const destRect = destRow?.getBoundingClientRect();

      cleanup();
      cleanupClone(destRect);

      // Commit reorder if position changed
      if (finalTarget !== index) {
        onReorder(index, finalTarget);
      }

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
        "cursor-grab active:cursor-grabbing flex items-center justify-center p-1.5 rounded hover:bg-muted/60 select-none transition-colors",
        className
      )}
      title="Mantener clic y arrastrar para reordenar"
    >
      <GripHorizontal className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}
