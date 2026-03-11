import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserCheck, Lock, RotateCcw, Plus } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CajaMenorConfig } from "@/hooks/useCajaMenorConfig";

interface EstadoCajaMenorProps {
  config: CajaMenorConfig | null;
  stats: {
    base: number;
    totalAprobados: number;
    totalPendientes: number;
    efectivoEnCaja: number;
    reembolsado: number;
  };
  isAdmin: boolean;
  editingBase: boolean;
  baseInput: string;
  onEditBase: () => void;
  onCancelEditBase: () => void;
  onBaseInputChange: (val: string) => void;
  onSaveBase: () => void;
  onRegisterResponsable: () => void;
  onCierre: (estado: "Legalizado" | "Reembolsado") => void;
  onAgregarGasto: () => void;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

export default function EstadoCajaMenor({
  config, stats, isAdmin,
  editingBase, baseInput, onEditBase, onCancelEditBase, onBaseInputChange, onSaveBase,
  onRegisterResponsable, onCierre, onAgregarGasto,
}: EstadoCajaMenorProps) {
  const cuadreDeCaja = stats.efectivoEnCaja;

  return (
    <div>
      <div className="bg-primary/10 px-4 py-2.5 border-b border-primary/20 flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider">Estado de Caja Menor</h3>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-[11px] h-7" onClick={() => onCierre("Legalizado")}>
            <Lock className="h-3 w-3 mr-1" /> Legalizado
          </Button>
          <Button variant="outline" size="sm" className="text-[11px] h-7" onClick={() => onCierre("Reembolsado")}>
            <RotateCcw className="h-3 w-3 mr-1" /> Reembolsado
          </Button>
          <Button size="sm" className="text-[11px] h-7" onClick={onAgregarGasto}>
            <Plus className="h-3 w-3 mr-1" /> Agregar Gasto
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border/30">
        {/* Left: Persona Responsable + Cierre estado */}
        <div className="p-4 space-y-3">
          <div>
            <p className="text-[11px] text-muted-foreground font-semibold uppercase mb-1.5">Persona Responsable</p>
            {config?.responsable_nombre ? (
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{config.responsable_nombre}</p>
                  {config.responsable_timestamp && (
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(config.responsable_timestamp), "dd/MM/yyyy HH:mm", { locale: es })}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={onRegisterResponsable} className="w-full text-xs">
                <UserCheck className="h-3.5 w-3.5 mr-1" /> Autologueo
              </Button>
            )}
          </div>

          <div>
            <p className="text-[11px] text-muted-foreground font-semibold uppercase mb-1.5">Cierre de Caja</p>
            <p className="text-xs">
              Estado: <span className="font-semibold">{config?.estado_cierre || "Abierta"}</span>
            </p>
          </div>
        </div>

        {/* Center: Financial summary table */}
        <div className="p-4 md:col-span-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Concepto</TableHead>
                <TableHead className="text-xs text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="text-xs py-1.5 font-medium">Base asignada</TableCell>
                <TableCell className="text-xs py-1.5 text-right font-mono">
                  {editingBase ? (
                    <div className="flex items-center gap-1 justify-end">
                      <Input type="number" value={baseInput} onChange={(e) => onBaseInputChange(e.target.value)} className="h-7 text-xs w-32 text-right" />
                      <Button size="sm" className="h-7 text-[10px] px-2" onClick={onSaveBase}>OK</Button>
                      <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2" onClick={onCancelEditBase}>✕</Button>
                    </div>
                  ) : (
                    <span className="cursor-pointer hover:underline" onClick={isAdmin ? onEditBase : undefined}>
                      {fmt(stats.base)}
                    </span>
                  )}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-xs py-1.5">Total gastos aprobados</TableCell>
                <TableCell className="text-xs py-1.5 text-right font-mono text-emerald-500 font-semibold">{fmt(stats.totalAprobados)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-xs py-1.5">Total gastos pendientes</TableCell>
                <TableCell className="text-xs py-1.5 text-right font-mono text-yellow-500">{fmt(stats.totalPendientes)}</TableCell>
              </TableRow>
              <TableRow className="border-t-2 border-border/50">
                <TableCell className="text-xs py-1.5 font-semibold">Efectivo en caja</TableCell>
                <TableCell className="text-xs py-1.5 text-right font-mono font-bold">{fmt(stats.efectivoEnCaja)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-xs py-1.5">Cuadre de caja</TableCell>
                <TableCell className={`text-xs py-1.5 text-right font-mono font-bold ${cuadreDeCaja >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                  {cuadreDeCaja >= 0 ? "" : "- "}{fmt(Math.abs(cuadreDeCaja))}
                </TableCell>
              </TableRow>
              <TableRow className="border-t-2 border-border/50">
                <TableCell className="text-xs py-1.5 font-bold uppercase">Reembolsado</TableCell>
                <TableCell className="text-xs py-1.5 text-right font-mono font-bold text-cyan-500">{fmt(stats.reembolsado)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
