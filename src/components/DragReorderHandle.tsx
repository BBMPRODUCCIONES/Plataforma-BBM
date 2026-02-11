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
 * A drag handle (two horizontal lines) that supports click-and-drag to reorder rows.
 * On mousedown + mousemove, calculates how many rows to move based on vertical distance.
 */
export function DragReorderHandle({ index, totalItems, onReorder, className }: DragReorderHandleProps) {
  const startY = useRef(0);
  const currentIndex = useRef(index);
  const isDragging = useRef(false);
  const rowHeight = 52; // approximate row height in px

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startY.current = e.clientY;
    currentIndex.current = index;
    isDragging.current = true;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDragging.current) return;
      const deltaY = moveEvent.clientY - startY.current;
      const steps = Math.round(deltaY / rowHeight);
      const newIndex = Math.max(0, Math.min(totalItems - 1, index + steps));
      
      if (newIndex !== currentIndex.current) {
        onReorder(currentIndex.current, newIndex);
        currentIndex.current = newIndex;
        startY.current = moveEvent.clientY;
      }
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [index, totalItems, onReorder]);

  // Touch support
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    const touch = e.touches[0];
    startY.current = touch.clientY;
    currentIndex.current = index;
    isDragging.current = true;

    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (!isDragging.current) return;
      moveEvent.preventDefault();
      const t = moveEvent.touches[0];
      const deltaY = t.clientY - startY.current;
      const steps = Math.round(deltaY / rowHeight);
      const newIndex = Math.max(0, Math.min(totalItems - 1, index + steps));

      if (newIndex !== currentIndex.current) {
        onReorder(currentIndex.current, newIndex);
        currentIndex.current = newIndex;
        startY.current = t.clientY;
      }
    };

    const handleTouchEnd = () => {
      isDragging.current = false;
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };

    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);
  }, [index, totalItems, onReorder]);

  return (
    <div
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      className={cn(
        "cursor-grab active:cursor-grabbing flex items-center justify-center p-1 rounded hover:bg-muted/50 select-none",
        className
      )}
      title="Mantener clic y arrastrar para reordenar"
    >
      <GripHorizontal className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}
