import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface CajaMenorEstadoSelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  readOnly?: boolean;
}

const ESTADO_OPTIONS = [
  { value: 'Pendiente', label: 'Pendiente', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  { value: 'Aprobado', label: 'Aprobado', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  { value: 'No aprobado', label: 'No aprobado', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
] as const;

export function CajaMenorEstadoSelect({ value, onChange, className, readOnly }: CajaMenorEstadoSelectProps) {
  const safeValue = ESTADO_OPTIONS.some(o => o.value === value) ? value : "Pendiente";
  const currentOption = ESTADO_OPTIONS.find(o => o.value === safeValue);

  if (readOnly) {
    return (
      <span className={cn(
        "text-xs font-medium px-2 py-0.5 rounded inline-block",
        currentOption?.className || "bg-yellow-500/20 text-yellow-400",
        className
      )}>
        {currentOption?.label || "Pendiente"}
      </span>
    );
  }

  return (
    <Select
      value={safeValue}
      onValueChange={onChange}
    >
      <SelectTrigger 
        className={cn(
          "h-7 text-xs w-full border font-medium",
          currentOption?.className || "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <span>{currentOption?.label || "Pendiente"}</span>
      </SelectTrigger>
      <SelectContent className="bg-popover border-border z-[9999]">
        {ESTADO_OPTIONS.map((option) => (
          <SelectItem 
            key={option.value} 
            value={option.value}
            className={cn("text-xs font-medium", option.className)}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
