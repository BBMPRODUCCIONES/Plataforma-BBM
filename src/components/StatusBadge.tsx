import { ProjectStatus } from "@/types";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: ProjectStatus;
  className?: string;
}

const statusConfig: Record<ProjectStatus, { label: string; className: string }> = {
  activo: { label: "Activo", className: "status-active" },
  pendiente: { label: "Pendiente", className: "status-pending" },
  completado: { label: "Completado", className: "status-completed" },
  cancelado: { label: "Cancelado", className: "status-cancelled" },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <span className={cn("status-badge", config.className, className)}>
      {config.label}
    </span>
  );
}
