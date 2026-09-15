import { Fragment, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { parseISO, startOfMonth, subMonths, isAfter } from "date-fns";
import { Project } from "@/types";
import { COLORES_DE_COMERCIAL, buscarColor, colorVisualDeEvento } from "@/lib/coloresProyecto";
import { ListaAdjuntos } from "@/components/ListaAdjuntos";
import { StatusBadge } from "@/components/StatusBadge";
import { format, parseISO as parseISOFecha } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronDown, ChevronRight, MapPin } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface GraficaClientesProps {
  projects: Project[];
  /** Mismo periodo que la pestaña de comerciales, para que no se contradigan. */
  meses?: number;
}

/**
 * Rampa ordinal de un solo azul, validada con scripts/validate_palette.js del
 * skill de dataviz (modo ordinal, claro y oscuro): 5 pasos es el maximo que
 * pasa la separacion de luminosidad. De ahi sale el tope de porciones.
 *
 * En claro la porcion mayor va oscura; en oscuro va clara. En los dos casos la
 * mayor es la que mas contrasta contra el fondo.
 */
const RAMPA_CLARO = ["#0d366b", "#184f95", "#256abf", "#3987e5", "#86b6ef"];
const RAMPA_OSCURO = ["#cde2fb", "#9ec5f4", "#6da7ec", "#2a78d6", "#184f95"];

/**
 * Cuantas porciones llevan nombre propio. Cinco es el tope que aguanta la
 * rampa; "Otros" no gasta uno de esos cinco porque va en gris: no es un
 * cliente, es el resto, y pintarlo del mismo azul lo hacia parecer el mayor.
 */
const PORCIONES = 5;

/** Gris del "Otros". No sale de la rampa a proposito. */
const GRIS_CLARO = "#6e6d67";
const GRIS_OSCURO = "#8a8982";

const pesos = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

function aFecha(valor?: string | null): Date | null {
  if (!valor) return null;
  try {
    const d = parseISO(valor.length > 10 ? valor : `${valor}T00:00:00`);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

/** Agrupa ignorando mayusculas y tildes. */
function clave(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Valor reservado del filtro: todos los comerciales juntos. */
const TODOS = "__todos__";
/** Eventos sin comercial atribuido. */
const SIN_COMERCIAL = "__sin_comercial__";

/**
 * A que comercial pertenece un evento. Mismo criterio que la pestana de
 * comerciales: manda el color puesto a mano y si no hay, el correo de quien lo
 * subio. Devuelve null cuando no pertenece a ninguno (sin color, o en rojo,
 * que es solo una marca).
 */
function comercialDe(p: Project): { valor: string; nombre: string } | null {
  const visual = colorVisualDeEvento(p);
  const color = buscarColor(visual?.color);
  return color && color.comercial ? { valor: color.valor, nombre: color.nombre } : null;
}

interface FilaCliente {
  /** Clave con la que se agrupo, para poder volver a sus eventos. */
  k: string;
  nombre: string;
  valor: number;
  eventos: number;
  porcentaje: number;
}

/** "2026-09-08" -> "8 sep 2026" */
function diaCorto(valor?: string | null): string {
  if (!valor) return "sin fecha";
  try {
    const d = parseISOFecha(valor.length > 10 ? valor : `${valor}T00:00:00`);
    return isNaN(d.getTime()) ? "sin fecha" : format(d, "d MMM yyyy", { locale: es });
  } catch {
    return "sin fecha";
  }
}

export function GraficaClientes({ projects, meses = 12 }: GraficaClientesProps) {
  const [oscuro, setOscuro] = useState(false);
  const [comercial, setComercial] = useState<string>(TODOS);
  /** Cliente cuyo detalle esta abierto en la tabla. */
  const [clienteAbierto, setClienteAbierto] = useState<string | null>(null);
  useEffect(() => {
    const mirar = () => setOscuro(document.documentElement.classList.contains("dark"));
    mirar();
    const obs = new MutationObserver(mirar);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  /** Eventos con ingreso dentro del periodo. Base de todo lo de abajo. */
  const delPeriodo = useMemo(() => {
    const desde = startOfMonth(subMonths(new Date(), meses - 1));
    return projects.filter((p) => {
      if (p.isDeleted) return false;
      const fecha = aFecha(p.fechaEjecucionInicio);
      if (!fecha || !isAfter(fecha, subMonths(desde, 1))) return false;
      return (Number(p.ingresoTotal) || 0) > 0;
    });
  }, [projects, meses]);

  /**
   * Los comerciales, con lo que lleva cada uno en el periodo.
   *
   * No sale del campo productor: ese fue texto libre durante mucho tiempo y
   * guarda lo que cada quien escribio (nombres de logisticos, pruebas, siglas),
   * que no son comerciales. La atribucion de una venta es el color, igual que
   * en la otra pestana.
   */
  const comerciales = useMemo(() => {
    const mapa = new Map<string, { valor: string; nombre: string; total: number; eventos: number }>();
    COLORES_DE_COMERCIAL.forEach((c) => {
      mapa.set(c.valor, { valor: c.valor, nombre: c.nombre, total: 0, eventos: 0 });
    });
    let sinNadie = { valor: 0, eventos: 0 };

    delPeriodo.forEach((p) => {
      const monto = Number(p.ingresoTotal) || 0;
      const quien = comercialDe(p);
      if (!quien) {
        sinNadie = { valor: sinNadie.valor + monto, eventos: sinNadie.eventos + 1 };
        return;
      }
      const fila = mapa.get(quien.valor);
      if (fila) {
        fila.total += monto;
        fila.eventos += 1;
      }
    });

    return {
      lista: [...mapa.values()].filter((c) => c.eventos > 0).sort((a, b) => b.total - a.total),
      sinNadie,
    };
  }, [delPeriodo]);

  /** Lo que entra en la torta segun el comercial elegido. */
  const elegidos = useMemo(() => {
    if (comercial === TODOS) return delPeriodo;
    if (comercial === SIN_COMERCIAL) return delPeriodo.filter((p) => !comercialDe(p));
    return delPeriodo.filter((p) => comercialDe(p)?.valor === comercial);
  }, [delPeriodo, comercial]);

  /** Los eventos de cada cliente, para poder mostrarlos al pulsar su fila. */
  const eventosPorCliente = useMemo(() => {
    const mapa = new Map<string, Project[]>();
    elegidos.forEach((p) => {
      const nombre = (p.cliente || "").trim();
      if (!nombre) return;
      const k = clave(nombre);
      const lista = mapa.get(k);
      if (lista) lista.push(p);
      else mapa.set(k, [p]);
    });
    // Del mas caro al mas barato: el que explica la cifra va primero.
    mapa.forEach((lista) =>
      lista.sort((a, b) => (Number(b.ingresoTotal) || 0) - (Number(a.ingresoTotal) || 0))
    );
    return mapa;
  }, [elegidos]);

  const { filas, total, sinCliente } = useMemo(() => {
    const porCliente = new Map<string, FilaCliente>();
    let anonimo = 0;

    elegidos.forEach((p) => {
      const monto = Number(p.ingresoTotal) || 0;
      const nombre = (p.cliente || "").trim();
      if (!nombre) {
        anonimo += monto;
        return;
      }
      // Se agrupa sin distinguir mayusculas ni tildes: "compumundo" y
      // "COMPUMUNDO" son el mismo cliente, y si se separan las dos cifras
      // quedan mal las dos.
      const k = clave(nombre);
      const actual = porCliente.get(k);
      if (actual) {
        actual.valor += monto;
        actual.eventos += 1;
      } else {
        porCliente.set(k, { k, nombre, valor: monto, eventos: 1, porcentaje: 0 });
      }
    });

    const lista = [...porCliente.values()].sort((a, b) => b.valor - a.valor);
    const suma = lista.reduce((s, f) => s + f.valor, 0) + anonimo;
    lista.forEach((f) => {
      f.porcentaje = suma > 0 ? (f.valor / suma) * 100 : 0;
    });

    return { filas: lista, total: suma, sinCliente: anonimo };
  }, [elegidos]);

  // La torta solo aguanta unas pocas porciones antes de volverse ilegible; el
  // detalle completo vive en la tabla de abajo.
  const porciones = useMemo(() => {
    const cabeza = filas.slice(0, PORCIONES);
    const cola = filas.slice(PORCIONES);
    const resto = cola.reduce((s, f) => s + f.valor, 0) + sinCliente;
    const trozos: { nombre: string; valor: number; esOtros?: boolean }[] =
      cabeza.map((f) => ({ nombre: f.nombre, valor: f.valor }));
    if (resto > 0) {
      trozos.push({
        nombre: `Otros (${cola.length + (sinCliente > 0 ? 1 : 0)})`,
        valor: resto,
        esOtros: true,
      });
    }
    return trozos;
  }, [filas, sinCliente]);

  const rampa = oscuro ? RAMPA_OSCURO : RAMPA_CLARO;
  const gris = oscuro ? GRIS_OSCURO : GRIS_CLARO;
  const colorDe = (i: number, esOtros?: boolean) =>
    esOtros ? gris : rampa[Math.min(i, rampa.length - 1)];


  const nombreElegido =
    comercial === TODOS
      ? "Todos los comerciales"
      : comercial === SIN_COMERCIAL
        ? "Sin comercial asignado"
        : (comerciales.lista.find((x) => x.valor === comercial)?.nombre ?? "—");

  return (
    <div className="space-y-3">
      {/* El filtro va arriba de la grafica: lo que se elige aqui manda sobre
          todo lo de abajo. */}
      <Select value={comercial} onValueChange={setComercial}>
        <SelectTrigger className="h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todos los comerciales</SelectItem>
          {comerciales.lista.map((c) => (
            <SelectItem key={c.valor} value={c.valor}>
              {c.nombre} · {pesos.format(c.total)}
            </SelectItem>
          ))}
          {comerciales.sinNadie.eventos > 0 && (
            <SelectItem value={SIN_COMERCIAL}>
              Sin comercial asignado · {pesos.format(comerciales.sinNadie.valor)}
            </SelectItem>
          )}
        </SelectContent>
      </Select>

      <div className="rounded-lg border border-border p-3">
        <div className="text-xs text-muted-foreground">{nombreElegido}</div>
        <div className="mt-0.5 text-2xl font-semibold tabular-nums">{pesos.format(total)}</div>
        <div className="text-[11px] text-muted-foreground">
          {filas.length} cliente{filas.length === 1 ? "" : "s"} en los últimos {meses} meses
        </div>
      </div>

      {filas.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm font-medium">
            {comercial === TODOS
              ? "No hay ventas en el periodo"
              : `${nombreElegido} no tiene ventas en el periodo`}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Se cuentan los eventos con ingreso, por su mes de ejecución, en los
            últimos {meses} meses.
          </p>
        </div>
      )}

      {filas.length > 0 && (
      <div className="h-[230px] w-full sm:h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={porciones}
              dataKey="valor"
              nameKey="nombre"
              innerRadius="45%"
              outerRadius="78%"
              paddingAngle={2}
              stroke="hsl(var(--background))"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {porciones.map((t, i) => (
                <Cell key={i} fill={colorDe(i, t.esOtros)} />
              ))}
            </Pie>
            <Tooltip
              formatter={(valor: number, nombre: string) => [
                `${pesos.format(valor)} · ${total > 0 ? ((valor / total) * 100).toFixed(1) : 0}%`,
                nombre,
              ]}
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              // El texto lleva color de texto, no el de la porcion. Recharts
              // pinta cada renglon del color de su serie, y un gris o un azul
              // oscuro sobre el fondo del globo no se lee. El cuadrito de
              // color que va al lado ya dice de que porcion se trata.
              itemStyle={{ color: "hsl(var(--popover-foreground))" }}
              labelStyle={{ color: "hsl(var(--popover-foreground))", fontWeight: 600 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      )}

      {filas.length > 0 && (
      <>

      {/* Leyenda propia: la de recharts corta los nombres largos de cliente. */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {porciones.map((t, i) => (
          <span key={t.nombre} className="flex items-center gap-1.5 text-xs">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: colorDe(i, t.esOtros) }}
            />
            <span className="text-foreground">{t.nombre}</span>
            <span className="tabular-nums text-muted-foreground">
              {total > 0 ? ((t.valor / total) * 100).toFixed(1) : 0}%
            </span>
          </span>
        ))}
      </div>

      {/* La torta da la forma; esto da el dato exacto, que es lo que se copia a
          un informe. Salen todos los clientes, no solo los de la torta. */}
      <p className="text-[11px] text-muted-foreground">
        Pulsa un cliente para ver sus eventos y sus cotizaciones.
      </p>

      {/* Con un cliente desplegado la tabla necesita mas aire: si no, el
          detalle sale por una rendija de 260 px. */}
      <div
        className={cn(
          "overflow-auto rounded-lg border border-border",
          clienteAbierto ? "max-h-[420px]" : "max-h-[260px]"
        )}
      >
        <table className="w-full min-w-[420px] text-sm">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">Cliente</th>
              <th className="px-3 py-2 text-right font-medium">Eventos</th>
              <th className="px-3 py-2 text-right font-medium">Valor</th>
              <th className="px-3 py-2 text-right font-medium">%</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const abierto = clienteAbierto === f.k;
              const susEventos = eventosPorCliente.get(f.k) ?? [];
              return (
                <Fragment key={f.k}>
                  <tr
                    className="cursor-pointer border-t border-border/60 hover:bg-accent/40"
                    onClick={() => setClienteAbierto(abierto ? null : f.k)}
                    title={abierto ? "Ocultar sus eventos" : "Ver sus eventos y sus cotizaciones"}
                  >
                    <td className="px-3 py-1.5">
                      <span className="flex items-center gap-1.5">
                        {abierto ? (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-40" />
                        )}
                        <span className="min-w-0">{f.nombre}</span>
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                      {f.eventos}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">
                      {pesos.format(f.valor)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">
                      {f.porcentaje.toFixed(1)}%
                    </td>
                  </tr>

                  {abierto && (
                    <tr className="border-t border-border/60 bg-muted/20">
                      <td colSpan={4} className="px-3 py-2">
                        <div className="flex flex-col gap-2">
                          {susEventos.map((p) => {
                            const marca = colorVisualDeEvento(p);
                            return (
                              <div
                                key={p.id}
                                className="rounded-md border border-border/70 bg-background/60 p-2.5"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="min-w-0 flex-1 break-words text-sm font-medium">
                                    {p.evento || "Sin nombre"}
                                  </span>
                                  <span className="whitespace-nowrap text-sm tabular-nums">
                                    {pesos.format(Number(p.ingresoTotal) || 0)}
                                  </span>
                                </div>

                                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                  <StatusBadge status={p.estado} />
                                  <span>{diaCorto(p.fechaEjecucionInicio)}</span>
                                  {p.ubicacion && (
                                    <span className="flex min-w-0 items-center gap-1">
                                      <MapPin className="h-3 w-3 shrink-0" />
                                      <span className="truncate">{p.ubicacion}</span>
                                    </span>
                                  )}
                                  {marca && <span>{marca.nombre}</span>}
                                  {p.productor && <span>· {p.productor}</span>}
                                </div>

                                {p.notas && (
                                  <p className="mt-1.5 whitespace-pre-wrap break-words text-xs text-foreground/70">
                                    {p.notas}
                                  </p>
                                )}

                                <div className="mt-2 space-y-2">
                                  <ListaAdjuntos
                                    adjuntos={p.cotizaciones || []}
                                    etiqueta="Cotización"
                                  />
                                  <ListaAdjuntos
                                    adjuntos={p.ordenesCompra || []}
                                    etiqueta="Orden de compra"
                                  />
                                  {(p.cotizaciones || []).length === 0 &&
                                    (p.ordenesCompra || []).length === 0 && (
                                      <p className="text-[11px] text-muted-foreground">
                                        Este evento no tiene cotización cargada.
                                      </p>
                                    )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {sinCliente > 0 && (
              <tr className="border-t border-border/60 text-muted-foreground">
                <td className="px-3 py-1.5 italic">Sin cliente anotado</td>
                <td className="px-3 py-1.5" />
                <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">{pesos.format(sinCliente)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {total > 0 ? ((sinCliente / total) * 100).toFixed(1) : 0}%
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      </>
      )}

      <p className="text-[11px] text-muted-foreground">
        Es el valor de venta de los eventos, por su mes de ejecución. No dice si
        ya se cobró. La torta muestra los {PORCIONES} clientes más grandes y junta
        el resto en gris; si ese gris pesa más que las porciones con nombre, es
        que la facturación está repartida y la tabla dice más que el dibujo.
      </p>
    </div>
  );
}

export default GraficaClientes;
