import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProjectStatus } from "@/types";
import { cn } from "@/lib/utils";

interface StatusSelectProps {
  value: ProjectStatus;
  onChange: (value: ProjectStatus) => void;
  className?: string;
}

const STATUS_OPTIONS = [
  { value: 'por_planear', label: 'Por Planear', className: 'bg-yellow-500/20 text-yellow-400' },
  { value: 'por_ejecutar', label: 'Por Ejecutar', className: 'bg-orange-500/20 text-orange-400' },
  { value: 'en_progreso', label: 'En Progreso', className: 'bg-blue-500/20 text-blue-400' },
  { value: 'terminado', label: 'Terminado', className: 'bg-green-500/20 text-green-400' },
  { value: 'facturado', label: 'Facturado', className: 'bg-emerald-500/20 text-emerald-400' },
] as const;

export function StatusSelect({ value, onChange, className }: StatusSelectProps) {
  const currentOption = STATUS_OPTIONS.find(o => o.value === value);

  return (
    <Select
      value={value}
      onValueChange={(val) => onChange(val as ProjectStatus)}
    >
      <SelectTrigger 
        className={cn(
          "h-7 text-xs w-[120px] border-border",
          currentOption?.className,
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <SelectValue placeholder="Seleccionar" />
      </SelectTrigger>
      <SelectContent className="bg-popover border-border z-50">
        {STATUS_OPTIONS.map((option) => (
          <SelectItem 
            key={option.value} 
            value={option.value}
            className={cn("text-xs", option.className)}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function getStatusLabel(value: ProjectStatus): string {
  const option = STATUS_OPTIONS.find(o => o.value === value);
  return option?.label || '-';
}
