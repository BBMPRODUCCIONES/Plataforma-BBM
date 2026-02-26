import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useUserRole } from "@/hooks/useUserRole";

interface CajaMenorItem {
  id: string;
  estado?: string;
  [key: string]: any;
}

interface LegalizacionItem {
  id: string;
  estado?: string;
  [key: string]: any;
}

interface CajaMenorStatusIconProps {
  cajaMenor: CajaMenorItem[];
  legalizacion?: LegalizacionItem[];
}

export function CajaMenorStatusIcon({ cajaMenor, legalizacion = [] }: CajaMenorStatusIconProps) {
  const { canApproveCajaMenor } = useUserRole();

  if (!canApproveCajaMenor()) {
    return null;
  }

  // No items at all → don't show
  if (cajaMenor.length === 0 && legalizacion.length === 0) {
    return null;
  }

  const pendingStatuses = ["Pendiente", "Revisando"];

  const hasPendingCajaMenor = cajaMenor.some(item => pendingStatuses.includes(item.estado || "Pendiente"));
  const hasPendingLegalizacion = legalizacion.some(item => pendingStatuses.includes(item.estado || "Pendiente"));
  const hasPending = hasPendingCajaMenor || hasPendingLegalizacion;

  const tooltipText = hasPending
    ? "Hay solicitudes o legalizaciones pendientes de revisar"
    : "Todas las solicitudes y legalizaciones están revisadas";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`
              inline-flex items-center justify-center
              w-7 h-7 min-w-[28px] min-h-[28px]
              rounded-full
              ${hasPending ? 'bg-yellow-500' : 'bg-green-500'}
              cursor-default
              flex-shrink-0
              touch-manipulation
              mobile-visible
              caja-menor-status
            `}
            role="status"
            aria-label={tooltipText}
            data-status-badge="caja-menor"
          >
            <span className="text-black font-bold text-xs select-none">$</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="z-50">
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
