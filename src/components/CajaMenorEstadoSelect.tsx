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
}

const ESTADO_OPTIONS = [
  { value: 'Aprobado', label: 'Aprobado', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  { value: 'No aprobado', label: 'No aprobado', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
] as const;

export function CajaMenorEstadoSelect({ value, onChange, className }: CajaMenorEstadoSelectProps) {
  const currentOption = ESTADO_OPTIONS.find(o => o.value === value);

  return (
    <Select
      value={value}
      onValueChange={onChange}
    >
      <SelectTrigger 
        className={cn(
          "h-7 text-xs w-full border font-medium",
          currentOption?.className || "border-border",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <SelectValue placeholder="Seleccionar" />
      </SelectTrigger>
      <SelectContent className="bg-popover border-border z-50">
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
