import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Wallet, Clock, CheckCircle, XCircle } from "lucide-react";

interface AprobacionRow {
  item: { estado: string; valor: number; recursos?: string };
  legalizacionTotal: number;
  saldoAFavor: number;
}

interface AprobacionesKPIsProps {
  rows: AprobacionRow[];
}

type Categoria = "Solicitud de anticipos" | "Recursos propios";

const CATEGORIAS: { key: Categoria; recursos: string[]; icon: typeof FileText; borderColor: string; bgColor: string; iconBg: string; iconColor: string }[] = [
  { key: "Solicitud de anticipos", recursos: ["Anticipo BBM", "Anticipo"], icon: FileText, borderColor: "border-blue-500/20", bgColor: "bg-blue-500/5", iconBg: "bg-blue-500/20", iconColor: "text-blue-500" },
  { key: "Recursos propios", recursos: ["Recursos propios"], icon: Wallet, borderColor: "border-emerald-500/20", bgColor: "bg-emerald-500/5", iconBg: "bg-emerald-500/20", iconColor: "text-emerald-500" },
];

const AprobacionesKPIs = ({ rows }: AprobacionesKPIsProps) => {
  const [selectedCategoria, setSelectedCategoria] = useState<Categoria | null>(null);

  const statsByCategoria = useMemo(() => {
    const result: Record<Categoria, { total: number; pendientes: number; aprobados: number; noAprobados: number; valorTotal: number; valorAprobado: number }> = {
      "Solicitud de anticipos": { total: 0, pendientes: 0, aprobados: 0, noAprobados: 0, valorTotal: 0, valorAprobado: 0 },
      "Recursos propios": { total: 0, pendientes: 0, aprobados: 0, noAprobados: 0, valorTotal: 0, valorAprobado: 0 },
    };

    rows.forEach(r => {
      const recursos = r.item.recursos || "";
      let cat = CATEGORIAS.find(c => c.recursos.some(rc => rc === recursos));
      if (!cat) cat = CATEGORIAS[0];
      const s = result[cat.key];
      s.total++;
      s.valorTotal += r.item.valor || 0;
      if (r.item.estado === "Pendiente") s.pendientes++;
      else if (r.item.estado === "Aprobado") { s.aprobados++; s.valorAprobado += r.item.valor || 0; }
      else if (r.item.estado === "No aprobado") s.noAprobados++;
    });

    return result;
  }, [rows]);

  const selectedStats = selectedCategoria ? statsByCategoria[selectedCategoria] : null;

  if (rows.length === 0) return null;

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {CATEGORIAS.map(cat => {
          const stats = statsByCategoria[cat.key];
          const Icon = cat.icon;
          return (
            <Card
              key={cat.key}
              className={`${cat.borderColor} ${cat.bgColor} cursor-pointer hover:opacity-80 transition-opacity`}
              onClick={() => setSelectedCategoria(cat.key)}
            >
              <CardContent className="p-3 flex items-center gap-3">
                <div className={`p-2 rounded-lg ${cat.iconBg}`}>
                  <Icon className={`h-4 w-4 ${cat.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-muted-foreground truncate">{cat.key}</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-sm font-bold">{stats.total}</p>
                    {stats.valorAprobado > 0 && (
                      <p className="text-[10px] text-green-400 truncate">$ {stats.valorAprobado.toLocaleString('es-CO')}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!selectedCategoria} onOpenChange={() => setSelectedCategoria(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">{selectedCategoria}</DialogTitle>
          </DialogHeader>
          {selectedStats && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-yellow-500/10">
                <Clock className="h-4 w-4 text-yellow-500" />
                <span className="text-sm text-muted-foreground">Pendientes</span>
                <span className="ml-auto text-sm font-bold text-yellow-500">{selectedStats.pendientes}</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                <span className="text-sm text-muted-foreground">Aprobados</span>
                <span className="ml-auto text-sm font-bold text-emerald-500">{selectedStats.aprobados}</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-red-500/10">
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm text-muted-foreground">No aprobados</span>
                <span className="ml-auto text-sm font-bold text-red-500">{selectedStats.noAprobados}</span>
              </div>
              <div className="border-t pt-2 mt-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total solicitudes</span>
                  <span className="font-bold">{selectedStats.total}</span>
                </div>
                {selectedStats.valorAprobado > 0 && (
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-muted-foreground">Valor aprobado</span>
                    <span className="font-bold text-green-400">$ {selectedStats.valorAprobado.toLocaleString('es-CO')}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AprobacionesKPIs;
