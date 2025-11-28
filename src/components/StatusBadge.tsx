import { ProjectStatus } from "@/types";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: ProjectStatus;
  className?: string;
}

const statusConfig: Record<ProjectStatus, { label: string; className: string }> = {
  por_planear: { label: "Por Planear", className: "status-pending" },
  por_ejecutar: { label: "Por Ejecutar", className: "status-pending" },
  en_progreso: { label: "En Progreso", className: "status-active" },
  terminado: { label: "Terminado", className: "status-completed" },
  facturado: { label: "Facturado", className: "status-completed" },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <span className={cn("status-badge", config.className, className)}>
      {config.label}
    </span>
  );
}
