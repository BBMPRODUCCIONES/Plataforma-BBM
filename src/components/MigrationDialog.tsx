import { useState, useEffect } from "react";
import { useCotizacionMigration } from "@/hooks/useCotizacionMigration";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Database, Loader2, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface MigrationDialogProps {
  onComplete?: () => void;
}

export function MigrationDialog({ onComplete }: MigrationDialogProps) {
  const { isRunning, progress, stats, runMigration, checkPendingCount } = useCotizacionMigration();
  const [open, setOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [checkingCount, setCheckingCount] = useState(false);

  useEffect(() => {
    if (open && pendingCount === null) {
      checkPending();
    }
  }, [open]);

  const checkPending = async () => {
    setCheckingCount(true);
    try {
      const count = await checkPendingCount();
      setPendingCount(count);
    } finally {
      setCheckingCount(false);
    }
  };

  const handleRunMigration = async () => {
    const result = await runMigration();
    
    if (result.errors > 0) {
      toast.warning(`Migración completada con ${result.errors} error(es)`);
    } else {
      toast.success(`Migración completada: ${result.migrated} registro(s) actualizados`);
    }
    
    // Refresh pending count
    await checkPending();
    
    if (onComplete) {
      onComplete();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Database className="h-4 w-4 mr-2" />
          Migrar Historial
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Migración de Historial de Cotizaciones
          </DialogTitle>
          <DialogDescription>
            Esta herramienta actualiza los registros antiguos para que sean compatibles con el nuevo sistema de agrupación de archivos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Pending Count */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
            <div>
              <p className="text-sm font-medium">Registros pendientes</p>
              <p className="text-xs text-muted-foreground">
                Registros que necesitan actualización
              </p>
            </div>
            <div className="flex items-center gap-2">
              {checkingCount ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <span className="text-2xl font-bold">{pendingCount ?? "—"}</span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={checkPending}
                    disabled={isRunning}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Progress */}
          {isRunning && progress && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Progreso</span>
                <span>{progress.current} / {progress.total} ({progress.percentage}%)</span>
              </div>
              <Progress value={progress.percentage} className="h-2" />
            </div>
          )}

          {/* Results */}
          {stats && !isRunning && (
            <div className="space-y-3">
              {stats.errors === 0 ? (
                <Alert className="border-green-500/50 bg-green-500/10">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <AlertTitle>Migración completada</AlertTitle>
                  <AlertDescription>
                    {stats.migrated} registro(s) actualizados, {stats.skipped} omitidos
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Migración con errores</AlertTitle>
                  <AlertDescription>
                    <p>{stats.migrated} actualizados, {stats.skipped} omitidos, {stats.errors} error(es)</p>
                    {stats.errorDetails.length > 0 && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs">Ver errores</summary>
                        <ul className="mt-1 text-xs max-h-24 overflow-y-auto">
                          {stats.errorDetails.slice(0, 10).map((err, i) => (
                            <li key={i} className="truncate">{err}</li>
                          ))}
                          {stats.errorDetails.length > 10 && (
                            <li className="text-muted-foreground">
                              ...y {stats.errorDetails.length - 10} más
                            </li>
                          )}
                        </ul>
                      </details>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Info */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• La migración extrae el ID del personal desde la ruta del archivo</p>
            <p>• Los registros ya migrados se omiten automáticamente</p>
            <p>• Esta acción se registra en el log de auditoría</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isRunning}>
            Cerrar
          </Button>
          <Button 
            onClick={handleRunMigration} 
            disabled={isRunning || pendingCount === 0}
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Migrando...
              </>
            ) : (
              <>
                <Database className="h-4 w-4 mr-2" />
                Iniciar Migración
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
