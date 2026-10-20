import { ProjectStatus } from "@/types";
import { estadoDe } from "@/lib/estadosEvento";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: ProjectStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const estado = estadoDe(status);

  return (
    <span
      className={cn("status-badge whitespace-nowrap mobile-visible", estado.badge, className)}
      role="status"
      data-status-badge={estado.value}
    >
      {estado.label}
    </span>
  );
}
