import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check } from "lucide-react";
import { COMERCIALES, buscarComercial, nombreComercial, inicialComercial } from "@/lib/comerciales";
import { cn } from "@/lib/utils";

interface SelectorComercialProps {
  valor?: string | null;
  onCambio: (comercial: string | null) => void;
  disabled?: boolean;
}

/**
 * Boton compacto para decir de quien es la venta. Vive en la columna de
 * Acciones del Panel Directivo; alimenta la grafica de ventas por comercial.
 */
export function SelectorComercial({ valor, onCambio, disabled }: SelectorComercialProps) {
  const actual = buscarComercial(valor);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          title={`Comercial: ${nombreComercial(valor)}`}
          aria-label={`Comercial: ${nombreComercial(valor)}`}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "h-6 w-6 p-0 text-xs font-semibold",
            !actual && "text-muted-foreground"
          )}
          style={actual ? { color: actual.colorClaro } : undefined}
        >
          {inicialComercial(valor)}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel className="text-xs">Venta de</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {COMERCIALES.map((c) => {
          const elegido = actual?.valor === c.valor;
          return (
            <DropdownMenuItem
              key={c.valor}
              onClick={(e) => {
                e.stopPropagation();
                onCambio(elegido ? null : c.valor);
              }}
              className="gap-2 text-sm"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: c.colorClaro }}
              />
              <span className="flex-1">{c.nombre}</span>
              {elegido && <Check className="h-3.5 w-3.5" />}
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onCambio(null);
          }}
          disabled={!actual}
          className="text-sm text-muted-foreground"
        >
          Sin asignar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
