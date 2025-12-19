import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useUserRole } from "@/hooks/useUserRole";

interface CajaMenorItem {
  id: string;
  estado?: string;
  [key: string]: any;
}

interface CajaMenorStatusIconProps {
  cajaMenor: CajaMenorItem[];
}

export function CajaMenorStatusIcon({ cajaMenor }: CajaMenorStatusIconProps) {
  const { canApproveCajaMenor } = useUserRole();

  // Only visible to users with approval permission
  if (!canApproveCajaMenor()) {
    return null;
  }

  // Check if any item is pending (not approved)
  const hasPending = cajaMenor.some(item => item.estado !== "Aprobado");
  const isApproved = !hasPending;

  const tooltipText = isApproved 
    ? "Caja menor aprobada" 
    : "Caja menor pendiente por aprobar";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`
              inline-flex items-center justify-center
              w-6 h-6 min-w-[24px] min-h-[24px]
              rounded-full
              ${isApproved ? 'bg-green-500' : 'bg-red-500'}
              cursor-default
              flex-shrink-0
              touch-manipulation
            `}
            role="status"
            aria-label={tooltipText}
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
