import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, FileWarning } from "lucide-react";
import { format, parseISO, startOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { Project } from "@/types";
import { COLORES_DE_COMERCIAL, buscarColor, colorVisualDeEvento } from "@/lib/coloresProyecto";
import { montosDelEvento } from "@/lib/montosEvento";
import { cn } from "@/lib/utils";

/**
 * Ventas sin facturar: eventos ya ejecutados (en el periodo elegido) que no
 * tienen la factura subida y no estan marcados "No se factura". Es la plata
 * vendida que todavia no se ha facturado.
 *
 * Se separan los que tienen numero de factura escrito pero sin el PDF: ahi
 * probablemente si se facturo y solo falta subirla.
 */
interface Props {
  projects: Project[];
  meses?: number;
  mes?: string | null;
}

/**
 * Antes de septiembre de 2026 la facturacion se llevaba por fuera del planner
 * (numeros escritos a mano, eventos de prueba). Esos meses no se persiguen:
 * llenarian la lista de pendientes que no son pendientes.
 */
const SIN_FACTURAR_DESDE = "2026-09-01";

const pesos = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const hoyBogota = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
const dias = (a: string, b: string) =>
  Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86_400_000);

export function VentasSinFacturar({ projects, meses = 12, mes = null }: Props) {
  const navigate = useNavigate();
  const [comercial, setComercial] = useState<string>("todos");
  const hoy = hoyBogota();

  const { filas, desde, hasta } = useMemo(() => {
    const desdePeriodo = mes ? `${mes}-01` : format(startOfMonth(subMonths(new Date(), meses - 1)), "yyyy-MM-dd");
    const desde = desdePeriodo < SIN_FACTURAR_DESDE ? SIN_FACTURAR_DESDE : desdePeriodo;
    const hasta = mes
      ? format(new Date(parseISO(`${mes}-01T00:00:00`).getFullYear(), parseISO(`${mes}-01T00:00:00`).getMonth() + 1, 0), "yyyy-MM-dd")
      : hoy;
    const filas = projects
      .filter((p) => {
        if (p.isDeleted) return false;
        const ini = (p.fechaEjecucionInicio || "").slice(0, 10);
        const fin = (p.fechaEjecucionFin || p.fechaEjecucionInicio || "").slice(0, 10);
        if (!ini || ini < desde || ini > hasta) return false;
        if (fin >= hoy) return false; // todavia no termina
        if (p.estadoFacturacion === "no_se_factura") return false;
        return !p.factura?.archivo;
      })
      .map((p) => {
        const color = buscarColor(colorVisualDeEvento(p)?.color);
        const fin = (p.fechaEjecucionFin || p.fechaEjecucionInicio || "").slice(0, 10);
        return {
          p,
          comercial: color?.comercial ? color.valor : "sin",
          comercialNombre: color?.comercial ? color.nombre : "Sin asignar",
          venta: montosDelEvento(p).base,
          diasDesdeFin: dias(fin, hoy),
          conNumero: Boolean((p.numFactura || "").trim()),
        };
      })
      .sort((a, b) => b.diasDesdeFin - a.diasDesdeFin);
    return { filas, desde, hasta };
  }, [projects, meses, mes, hoy]);

  const visibles = comercial === "todos" ? filas : filas.filter((f) => f.comercial === comercial);
  const resumen = [
    ...COLORES_DE_COMERCIAL.map((c) => ({ valor: c.valor, nombre: c.nombre, color: c.graficaOscuro })),
    { valor: "sin", nombre: "Sin asignar", color: "hsl(var(--muted-foreground))" },
  ].map((c) => {
    const de = filas.filter((f) => f.comercial === c.valor);
    return { ...c, n: de.length, total: de.reduce((s, f) => s + f.venta, 0) };
  });
  const total = filas.reduce((s, f) => s + f.venta, 0);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Eventos ya ejecutados entre {format(parseISO(desde), "d MMM yyyy", { locale: es })} y{" "}
        {format(parseISO(hasta), "d MMM yyyy", { locale: es })} que no tienen la factura subida (sin contar los marcados
        "No se factura"). Valores sin IVA. Toca un evento para abrirlo y subir la factura.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <button
          type="button"
          onClick={() => setComercial("todos")}
          className={cn("rounded-lg border p-3 text-left", comercial === "todos" ? "border-primary bg-primary/5" : "border-border")}
        >
          <div className="text-xs text-muted-foreground">Total sin facturar</div>
          <div className="mt-1 text-lg font-semibold tabular-nums text-amber-500">{pesos.format(total)}</div>
          <div className="text-[11px] text-muted-foreground">{filas.length} evento(s)</div>
        </button>
        {resumen.map((c) => (
          <button
            key={c.valor}
            type="button"
            onClick={() => setComercial(c.valor)}
            className={cn("rounded-lg border p-3 text-left", comercial === c.valor ? "border-primary bg-primary/5" : "border-border")}
          >
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
              {c.nombre}
            </div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{pesos.format(c.total)}</div>
            <div className="text-[11px] text-muted-foreground">{c.n} evento(s)</div>
          </button>
        ))}
      </div>

      {visibles.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No hay ventas sin facturar en este periodo. 🎉
        </div>
      ) : (
        <div className="w-full overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/60 text-left text-xs">
              <tr>
                <th className="px-3 py-2 font-medium">Ejecución</th>
                <th className="px-3 py-2 font-medium">Evento</th>
                <th className="px-3 py-2 font-medium">Cliente</th>
                <th className="px-3 py-2 font-medium">Comercial</th>
                <th className="px-3 py-2 text-right font-medium">Venta sin IVA</th>
                <th className="px-3 py-2 text-right font-medium">Días sin facturar</th>
                <th className="px-3 py-2 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibles.map((f) => (
                <tr
                  key={f.p.id}
                  className="cursor-pointer hover:bg-muted/40"
                  title="Abrir el evento en el Panel General"
                  onClick={() => navigate(`/panel-general?eventId=${f.p.id}`)}
                >
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                    {format(parseISO(`${f.p.fechaEjecucionInicio.slice(0, 10)}T00:00:00`), "d MMM yy", { locale: es })}
                  </td>
                  <td className="max-w-[16rem] truncate px-3 py-2">{f.p.evento || "Sin nombre"}</td>
                  <td className="max-w-[12rem] truncate px-3 py-2 text-muted-foreground">{f.p.cliente || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2">{f.comercialNombre}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{pesos.format(f.venta)}</td>
                  <td
                    className={cn(
                      "whitespace-nowrap px-3 py-2 text-right tabular-nums",
                      f.diasDesdeFin > 30 ? "font-semibold text-red-500" : f.diasDesdeFin > 5 ? "text-amber-500" : ""
                    )}
                  >
                    {f.diasDesdeFin}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs">
                    {f.conNumero ? (
                      <span className="inline-flex items-center gap-1 text-amber-500">
                        <FileWarning className="h-3.5 w-3.5" /> # {f.p.numFactura} sin PDF
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-400">
                        <AlertTriangle className="h-3.5 w-3.5" /> Sin factura
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        "# … sin PDF": tiene número de factura escrito pero no se subió el archivo; probablemente sí se facturó y solo falta
        subirla. Días sin facturar = días desde que terminó el evento (en rojo, más de 30).
      </p>
    </div>
  );
}
