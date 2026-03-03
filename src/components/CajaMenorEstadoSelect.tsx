import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

interface CajaMenorEstadoSelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  readOnly?: boolean;
  allowedValues?: string[];
}

const ESTADO_OPTIONS = [
  { value: 'Pendiente', label: 'Pendiente', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  { value: 'Aprobado', label: 'Aprobado', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  { value: 'No aprobado', label: 'No aprobado', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
  { value: 'Legalizado', label: 'Legalizado', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  { value: 'Reembolsado', label: 'Reembolsado', className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
] as const;

export function CajaMenorEstadoSelect({ value, onChange, className, readOnly, allowedValues }: CajaMenorEstadoSelectProps) {
  const filteredOptions = allowedValues ? ESTADO_OPTIONS.filter(o => allowedValues.includes(o.value)) : ESTADO_OPTIONS;
  const safeValue = ESTADO_OPTIONS.some(o => o.value === value) ? value : "Pendiente";
  const [optimisticValue, setOptimisticValue] = useState(safeValue);

  // Sync optimistic value with actual value
  useEffect(() => {
    setOptimisticValue(safeValue);
  }, [safeValue]);

  const handleChange = (newValue: string) => {
    setOptimisticValue(newValue);
    onChange(newValue);
  };

  const currentOption = ESTADO_OPTIONS.find(o => o.value === optimisticValue);

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
      value={optimisticValue}
      onValueChange={handleChange}
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
        {filteredOptions.map((option) => (
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
