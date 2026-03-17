import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { UserCheck, Lock, Plus, ArrowLeft, Info } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CajaMenorConfig, BASE_ASIGNADA_FIJA } from "@/hooks/useCajaMenorConfig";
import AjusteBaseDialog from "./AjusteBaseDialog";

interface EstadoCajaMenorProps {
  config: CajaMenorConfig | null;
  stats: {
    baseAsignada: number;
    saldoInicial: number;
    reembolsadoCajaAnterior: number;
    totalGastos: number;
    totalPendientes: number;
    saldoEnCaja: number;
  };
  isAdmin: boolean;
  canAjustarBase: boolean;
  selectedGastosCount: number;
  onRegisterResponsable: () => void;
  onCierre: () => void;
  onLegalizar: () => void;
  onAgregarGasto: () => void;
  onSaveBaseAndReembolso: (newBase: number, newReembolso: number) => Promise<boolean>;
  onClose?: () => void;
  readOnly?: boolean;
  hasGastos?: boolean;
  // Role-based UI
  isResponsable?: boolean;
  isAuditor?: boolean;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

export default function EstadoCajaMenor({
  config, stats, isAdmin, canAjustarBase, selectedGastosCount,
  onRegisterResponsable, onCierre, onLegalizar, onAgregarGasto, onSaveBaseAndReembolso,
  onClose,
  readOnly = false,
  hasGastos = false,
  isResponsable = false,
  isAuditor = false,
}: EstadoCajaMenorProps) {
  const [ajusteOpen, setAjusteOpen] = useState(false);
  const [cierreConfirmOpen, setCierreConfirmOpen] = useState(false);

  const handleCierreConfirm = () => {
    setCierreConfirmOpen(false);
    onCierre();
  };

  return (
    <div>
      {/* Header bar */}
      <div className="bg-primary/10 px-4 py-2.5 border-b border-primary/20 flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-bold uppercase tracking-wider">
          {readOnly ? "Detalle del Cierre de Caja" : "Estado de Caja Menor"}
        </h3>
        {!readOnly && (
          <div className="flex items-center gap-2 flex-wrap">
            {onClose && (
              <Button
                variant="ghost"
                size="sm"
                className="text-[11px] h-7"
                onClick={onClose}
                disabled={hasGastos}
                title={hasGastos ? "No se puede volver mientras existan solicitudes de caja menor registradas" : undefined}
              >
                <ArrowLeft className="h-3 w-3 mr-1" /> Volver
              </Button>
            )}
            {/* Responsable: can close caja and add gastos */}
            {isResponsable && (
              <>
                <Button variant="outline" size="sm" className="text-[11px] h-7" onClick={() => setCierreConfirmOpen(true)}>
                  <Lock className="h-3 w-3 mr-1" /> Cerrar Caja
                </Button>
                <Button size="sm" className="text-[11px] h-7" onClick={onAgregarGasto}>
                  <Plus className="h-3 w-3 mr-1" /> Agregar Gasto
                </Button>
              </>
            )}
            {/* Auditor: can legalize, reimburse, but NOT close */}
            {isAuditor && (
              <>
                <Button variant="outline" size="sm" className="text-[11px] h-7" onClick={onLegalizar} disabled={selectedGastosCount === 0}>
                  Legalizado {selectedGastosCount > 0 && `(${selectedGastosCount})`}
                </Button>
                {canAjustarBase && (
                  <Button variant="outline" size="sm" className="text-[11px] h-7" onClick={() => setAjusteOpen(true)}>
                    Reembolsado
                  </Button>
                )}
                <Button size="sm" className="text-[11px] h-7" onClick={onAgregarGasto}>
                  <Plus className="h-3 w-3 mr-1" /> Agregar Gasto
                </Button>
              </>
            )}
            {/* Fallback: admin without specific sub-role sees all except cierre */}
            {!isResponsable && !isAuditor && isAdmin && (
              <>
                <Button variant="outline" size="sm" className="text-[11px] h-7" onClick={() => setCierreConfirmOpen(true)}>
                  <Lock className="h-3 w-3 mr-1" /> Cierre de caja
                </Button>
                <Button variant="outline" size="sm" className="text-[11px] h-7" onClick={onLegalizar} disabled={selectedGastosCount === 0}>
                  Legalizado {selectedGastosCount > 0 && `(${selectedGastosCount})`}
                </Button>
                {canAjustarBase && (
                  <Button variant="outline" size="sm" className="text-[11px] h-7" onClick={() => setAjusteOpen(true)}>
                    Reembolsado
                  </Button>
                )}
                <Button size="sm" className="text-[11px] h-7" onClick={onAgregarGasto}>
                  <Plus className="h-3 w-3 mr-1" /> Agregar Gasto
                </Button>
              </>
            )}
          </div>
        )}
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
            ) : !readOnly ? (
              <Button variant="outline" size="sm" onClick={onRegisterResponsable} className="w-full text-xs">
                <UserCheck className="h-3.5 w-3.5 mr-1" /> Autologueo
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">Sin responsable registrado</p>
            )}
          </div>

          <div>
            <p className="text-[11px] text-muted-foreground font-semibold uppercase mb-1.5">Estado de Caja</p>
            <p className="text-xs">
              Estado: <span className="font-semibold">{config?.estado_cierre || "Abierta"}</span>
            </p>
          </div>

          {/* Informational message for responsable */}
          {isResponsable && !isAuditor && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-2.5 flex items-start gap-2">
              <Info className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-blue-300">
                Eres responsable de esta caja. Puedes agregar gastos y cerrar la caja cuando todos los gastos estén legalizados. Al cerrar, se abrirá una nueva caja y esta pasará a revisión.
              </p>
            </div>
          )}
        </div>

        {/* Center/Right: Financial summary table - NEW ORDER */}
        <div className="p-4 md:col-span-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Concepto</TableHead>
                <TableHead className="text-xs text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* 1. BASE ASIGNADA (fixed, informational) */}
              <TableRow className="bg-primary/5 border-b-2 border-primary/20">
                <TableCell className="text-xs py-2 font-bold uppercase">
                  <div className="flex items-center gap-1.5">
                    Base Asignada
                    <span className="text-[9px] font-normal text-muted-foreground">(fija)</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm py-2 text-right font-mono font-bold">
                  {fmt(stats.baseAsignada)}
                </TableCell>
              </TableRow>

              {/* 2. SALDO INICIAL */}
              <TableRow>
                <TableCell className="text-xs py-1.5">
                  <div className="flex items-center gap-1.5">
                    Saldo inicial
                    <span className="text-[9px] text-muted-foreground">(de caja anterior)</span>
                  </div>
                </TableCell>
                <TableCell className="text-xs py-1.5 text-right font-mono font-semibold text-cyan-500">
                  {fmt(stats.saldoInicial)}
                </TableCell>
              </TableRow>

              {/* 3. REEMBOLSADO CAJA ANTERIOR */}
              <TableRow>
                <TableCell className="text-xs py-1.5">Reembolsado caja anterior</TableCell>
                <TableCell className="text-xs py-1.5 text-right font-mono font-semibold text-purple-400">
                  {fmt(stats.reembolsadoCajaAnterior)}
                </TableCell>
              </TableRow>

              {/* 4. TOTAL DE GASTOS */}
              <TableRow>
                <TableCell className="text-xs py-1.5">Total de gastos</TableCell>
                <TableCell className="text-xs py-1.5 text-right font-mono text-emerald-500 font-semibold">
                  {fmt(stats.totalGastos)}
                </TableCell>
              </TableRow>

              {/* 5. SALDO EN CAJA (= saldo_inicial + reembolsado - total_gastos) */}
              <TableRow className="border-t-2 border-border/50 bg-primary/5">
                <TableCell className="text-xs py-2 font-bold uppercase">Saldo en caja</TableCell>
                <TableCell className={`text-sm py-2 text-right font-mono font-bold ${stats.saldoEnCaja >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                  {stats.saldoEnCaja < 0 ? "- " : ""}{fmt(Math.abs(stats.saldoEnCaja))}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Ajuste Base Dialog (opened by Reembolsado button) */}
      <AjusteBaseDialog
        open={ajusteOpen}
        onOpenChange={setAjusteOpen}
        currentBase={stats.baseAsignada}
        currentReembolso={stats.reembolsadoCajaAnterior}
        saldoEnCaja={stats.saldoEnCaja}
        onSave={onSaveBaseAndReembolso}
      />

      {/* Cierre Confirmation Dialog */}
      <AlertDialog open={cierreConfirmOpen} onOpenChange={setCierreConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar cierre de caja?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Estás a punto de cerrar la caja menor con los siguientes datos:</p>
                <div className="bg-muted/50 rounded-lg p-3 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Base Asignada:</span>
                    <span className="font-mono font-semibold">{fmt(stats.baseAsignada)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Saldo inicial:</span>
                    <span className="font-mono font-semibold text-cyan-500">{fmt(stats.saldoInicial)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reembolsado caja anterior:</span>
                    <span className="font-mono font-semibold text-purple-400">{fmt(stats.reembolsadoCajaAnterior)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total de gastos:</span>
                    <span className="font-mono font-semibold text-emerald-500">{fmt(stats.totalGastos)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Saldo en caja:</span>
                    <span className={`font-mono font-semibold ${stats.saldoEnCaja >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                      {stats.saldoEnCaja < 0 ? "- " : ""}{fmt(Math.abs(stats.saldoEnCaja))}
                    </span>
                  </div>
                  {config?.responsable_nombre && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Responsable:</span>
                      <span className="font-semibold">{config.responsable_nombre}</span>
                    </div>
                  )}
                </div>
                <p className="text-destructive text-xs font-medium">
                  Esta acción cerrará la caja actual, la enviará a revisión por los auditores y creará una nueva con el saldo restante.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCierreConfirm}>
              Confirmar cierre
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
