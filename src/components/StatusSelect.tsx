import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProjectStatus } from "@/types";
import { ESTADOS, normalizarEstado } from "@/lib/estadosEvento";
import { cn } from "@/lib/utils";

interface StatusSelectProps {
  value: ProjectStatus;
  onChange: (value: ProjectStatus) => void;
  className?: string;
}

const STATUS_OPTIONS = ESTADOS.map((e) => ({
  value: e.value,
  label: e.label,
  className: e.clase,
}));

export function StatusSelect({ value, onChange, className }: StatusSelectProps) {
  // Un evento guardado con un estado viejo se dibuja en el que le
  // corresponde, en vez de salir en blanco. Ver lib/estadosEvento.
  const estado = normalizarEstado(value);
  const currentOption = STATUS_OPTIONS.find(o => o.value === estado);

  return (
    <Select
      value={estado}
      onValueChange={(val) => onChange(val as ProjectStatus)}
    >
      <SelectTrigger 
        className={cn(
          "h-7 text-xs w-[140px] border-border min-w-[110px] touch-manipulation",
          currentOption?.className,
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <SelectValue placeholder="Seleccionar" />
      </SelectTrigger>
      <SelectContent className="bg-popover border-border z-[100]">
        {STATUS_OPTIONS.map((option) => (
          <SelectItem 
            key={option.value} 
            value={option.value}
            className={cn("text-xs touch-manipulation", option.className)}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function getStatusLabel(value: ProjectStatus): string {
  const option = STATUS_OPTIONS.find(o => o.value === normalizarEstado(value));
  return option?.label || '-';
}
