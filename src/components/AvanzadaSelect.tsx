import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Project } from "@/types";

type AvanzadaValue = 'SE_HIZO' | 'NO_SE_HIZO' | 'NO_NECESARIA' | undefined;

interface AvanzadaSelectProps {
  value: AvanzadaValue;
  onChange: (value: AvanzadaValue) => void;
}

const AVANZADA_OPTIONS = [
  { value: 'SE_HIZO', label: 'Se hizo' },
  { value: 'NO_SE_HIZO', label: 'No se hizo' },
  { value: 'NO_NECESARIA', label: 'No es necesario' },
] as const;

export function AvanzadaSelect({ value, onChange }: AvanzadaSelectProps) {
  return (
    <Select
      value={value || ""}
      onValueChange={(val) => onChange(val as AvanzadaValue)}
    >
      <SelectTrigger 
        className="h-7 text-xs w-[120px] bg-background border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <SelectValue placeholder="Seleccionar" />
      </SelectTrigger>
      <SelectContent className="bg-popover border-border z-50">
        {AVANZADA_OPTIONS.map((option) => (
          <SelectItem 
            key={option.value} 
            value={option.value}
            className="text-xs"
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function getAvanzadaLabel(value: AvanzadaValue): string {
  const option = AVANZADA_OPTIONS.find(o => o.value === value);
  return option?.label || '-';
}
