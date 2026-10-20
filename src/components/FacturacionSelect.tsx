import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  EstadoFacturacion,
  FACTURACION,
  facturacionDe,
  normalizarFacturacion,
} from "@/lib/facturacionEvento";

interface FacturacionSelectProps {
  value?: string | null;
  onChange: (value: EstadoFacturacion) => void;
  disabled?: boolean;
  className?: string;
}

/** En que va el cobro del evento. Ver lib/facturacionEvento. */
export function FacturacionSelect({
  value,
  onChange,
  disabled = false,
  className,
}: FacturacionSelectProps) {
  const actual = facturacionDe(value);

  if (disabled) {
    return (
      <span
        className={cn(
          "inline-flex h-7 items-center rounded px-2 text-xs",
          actual.clase,
          className
        )}
        title={`Facturación: ${actual.label}`}
      >
        {actual.label}
      </span>
    );
  }

  return (
    <Select
      value={normalizarFacturacion(value)}
      onValueChange={(v) => onChange(v as EstadoFacturacion)}
    >
      <SelectTrigger
        className={cn(
          "h-7 w-full min-w-[110px] border-border text-xs touch-manipulation",
          actual.clase,
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="z-[100] border-border bg-popover">
        {FACTURACION.map((f) => (
          <SelectItem
            key={f.value}
            value={f.value}
            className={cn("text-xs touch-manipulation", f.clase)}
          >
            {f.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default FacturacionSelect;
