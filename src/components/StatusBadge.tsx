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
  pendiente_facturar: { label: "Por Facturar", className: "status-billing" },
  facturado: { label: "Facturado", className: "status-completed" },
  // Gris a proposito: "no se factura" no es un logro ni un problema, es un
  // evento que sale de la fila de cobro. En rojo pareceria un error.
  no_se_factura: { label: "No se Factura", className: "status-neutral" },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <span 
      className={cn("status-badge whitespace-nowrap mobile-visible", config.className, className)}
      role="status"
      data-status-badge={status}
    >
      {config.label}
    </span>
  );
}
