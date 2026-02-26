import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Wallet, Coins, Clock, CheckCircle, XCircle } from "lucide-react";

interface AprobacionRow {
  item: { estado: string; valor: number; recursos?: string };
  legalizacionTotal: number;
  saldoAFavor: number;
}

interface AprobacionesKPIsProps {
  rows: AprobacionRow[];
}

type Categoria = "Solicitud de anticipos" | "Recursos propios" | "Caja menor";

const CATEGORIAS: { key: Categoria; recursos: string[]; icon: typeof FileText; letra: string; borderColor: string; bgColor: string; iconBg: string; iconColor: string; letraBg: string; letraText: string; letraBorder: string }[] = [
  { key: "Solicitud de anticipos", recursos: ["Anticipo BBM", "Anticipo"], icon: FileText, letra: "S", borderColor: "border-blue-500/20", bgColor: "bg-blue-500/5", iconBg: "bg-blue-500/20", iconColor: "text-blue-500", letraBg: "bg-blue-500/20", letraText: "text-blue-400", letraBorder: "border-blue-500/40" },
  { key: "Recursos propios", recursos: ["Recursos propios"], icon: Wallet, letra: "R", borderColor: "border-emerald-500/20", bgColor: "bg-emerald-500/5", iconBg: "bg-emerald-500/20", iconColor: "text-emerald-500", letraBg: "bg-emerald-500/20", letraText: "text-emerald-400", letraBorder: "border-emerald-500/40" },
  { key: "Caja menor", recursos: ["BBM"], icon: Coins, letra: "C", borderColor: "border-amber-500/20", bgColor: "bg-amber-500/5", iconBg: "bg-amber-500/20", iconColor: "text-amber-500", letraBg: "bg-amber-500/20", letraText: "text-amber-400", letraBorder: "border-amber-500/40" },
];

const AprobacionesKPIs = ({ rows }: AprobacionesKPIsProps) => {
  const [selectedCategoria, setSelectedCategoria] = useState<Categoria | null>(null);

  const statsByCategoria = useMemo(() => {
    const result: Record<Categoria, { total: number; pendientes: number; aprobados: number; noAprobados: number; valorTotal: number; valorAprobado: number }> = {
      "Solicitud de anticipos": { total: 0, pendientes: 0, aprobados: 0, noAprobados: 0, valorTotal: 0, valorAprobado: 0 },
      "Recursos propios": { total: 0, pendientes: 0, aprobados: 0, noAprobados: 0, valorTotal: 0, valorAprobado: 0 },
      "Caja menor": { total: 0, pendientes: 0, aprobados: 0, noAprobados: 0, valorTotal: 0, valorAprobado: 0 },
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
      <div className="grid grid-cols-3 gap-3">
        {CATEGORIAS.map(cat => {
          const stats = statsByCategoria[cat.key];
          return (
            <Card
              key={cat.key}
              className={`${cat.borderColor} ${cat.bgColor} cursor-pointer hover:opacity-80 transition-opacity`}
              onClick={() => setSelectedCategoria(cat.key)}
            >
              <CardContent className="p-3 flex items-center gap-3">
                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-md border font-bold text-sm ${cat.letraBg} ${cat.letraText} ${cat.letraBorder}`}>
                  {cat.letra}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-muted-foreground truncate">{cat.key}</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-sm font-bold">{stats.total}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!selectedCategoria} onOpenChange={() => setSelectedCategoria(null)}>
        <DialogContent className="sm:max-w-sm [&>button]:right-4 [&>button]:top-4">
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AprobacionesKPIs;
