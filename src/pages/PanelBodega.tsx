import { useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { PanelHeader } from "@/components/PanelHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Search, Loader2, ArrowUpRight, ArrowDownLeft, AlertTriangle,
  Package, Wrench, History, Boxes, RefreshCw,
} from "lucide-react";
import { useBodega, Activo } from "@/hooks/useBodega";
import { useProjects } from "@/contexts/ProjectsContext";
import { MovimientoDialog } from "@/components/bodega/MovimientoDialog";
import { ActivoDialog } from "@/components/bodega/ActivoDialog";
import { cn } from "@/lib/utils";

const pesos = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v || 0);
const numero = (v: number) => new Intl.NumberFormat("es-CO").format(v || 0);

/** Un numero grande con su etiqueta. */
function Dato({ etiqueta, valor, pie, tono }: { etiqueta: string; valor: string; pie?: string; tono?: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{etiqueta}</p>
        <p className={cn("mt-0.5 text-xl font-bold tabular-nums", tono)}>{valor}</p>
        {pie && <p className="text-[11px] text-muted-foreground">{pie}</p>}
      </CardContent>
    </Card>
  );
}

export default function PanelBodega() {
  const {
    activos, movimientos, categorias, resumen, cargando, error,
    recargar, registrarMovimiento, guardarActivo,
  } = useBodega();
  const { projects } = useProjects();

  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("todas");
  const [estado, setEstado] = useState("todos");

  const [movDe, setMovDe] = useState<{ activo: Activo; tipo: "salida" | "entrada" } | null>(null);
  const [editando, setEditando] = useState<Activo | null>(null);
  const [creando, setCreando] = useState(false);

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return activos.filter((a) => {
      if (!a.activo) return false;
      if (categoria !== "todas" && a.categoria !== categoria) return false;
      if (estado === "disponibles" && a.disponible <= 0) return false;
      if (estado === "en_evento" && a.en_evento <= 0) return false;
      if (estado === "mantenimiento" && a.en_mantenimiento <= 0) return false;
      if (estado === "revisar" && !a.revisar) return false;
      if (estado === "agotados" && a.disponible > 0) return false;
      if (!t) return true;
      return (
        a.elemento.toLowerCase().includes(t) ||
        a.codigo.toLowerCase().includes(t) ||
        a.categoria.toLowerCase().includes(t)
      );
    });
  }, [activos, busca, categoria, estado]);

  /** Lo que esta en la calle, agrupado por evento. */
  const porEvento = useMemo(() => {
    const m = new Map<string, { nombre: string; piezas: { a: Activo; n: number }[]; total: number }>();
    for (const a of activos) {
      if (a.en_evento <= 0) continue;
      // El ultimo movimiento de salida dice a que evento se fue.
      const sal = movimientos.find((x) => x.activo_id === a.id && x.tipo === "salida");
      const clave = sal?.project_id || sal?.evento_nombre || "sin-evento";
      const nombre = sal?.evento_nombre || "Sin evento (préstamo o taller)";
      if (!m.has(clave)) m.set(clave, { nombre, piezas: [], total: 0 });
      const g = m.get(clave)!;
      g.piezas.push({ a, n: a.en_evento });
      g.total += a.en_evento;
    }
    return [...m.values()].sort((x, y) => y.total - x.total);
  }, [activos, movimientos]);

  /** Valor por categoria, de mayor a menor. */
  const valorPorCategoria = useMemo(() => {
    const m = new Map<string, { compra: number; mercado: number; dep: number; n: number }>();
    for (const a of activos) {
      if (!a.activo) continue;
      const g = m.get(a.categoria) || { compra: 0, mercado: 0, dep: 0, n: 0 };
      g.compra += Number(a.precio_unitario) * a.cantidad_total;
      g.mercado += Number(a.valor_mercado);
      g.dep += Number(a.depreciacion);
      g.n += a.cantidad_total;
      m.set(a.categoria, g);
    }
    const filas = [...m.entries()].map(([cat, v]) => ({ cat, ...v })).sort((x, y) => y.compra - x.compra);
    const tope = filas[0]?.compra || 1;
    return { filas, tope };
  }, [activos]);

  const badgeEstado = (a: Activo) => {
    if (a.disponible > 0) return <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400">{a.disponible} libre</Badge>;
    if (a.en_evento > 0) return <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-500">todo afuera</Badge>;
    if (a.en_mantenimiento > 0) return <Badge variant="outline" className="border-rose-500/40 text-rose-700 dark:text-rose-400">en taller</Badge>;
    return <Badge variant="outline" className="text-muted-foreground">sin unidades</Badge>;
  };

  return (
    <Layout>
      <PanelHeader
        title="Bodega"
        description="Qué tenemos, qué está en la calle y qué queda libre."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void recargar()} disabled={cargando}>
              <RefreshCw className={cn("h-4 w-4", cargando && "animate-spin")} />
            </Button>
            <Button size="sm" onClick={() => setCreando(true)}>
              <Plus className="mr-1.5 h-4 w-4" />Nuevo equipo
            </Button>
          </div>
        }
      />

      {error && (
        <Card className="mb-4 border-destructive/40">
          <CardContent className="p-3 text-sm">
            No se pudo leer la bodega: {error}
            <span className="block text-xs text-muted-foreground">
              Si dice que la tabla no existe, falta correr la migración de bodega en la base.
            </span>
          </CardContent>
        </Card>
      )}

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6">
        <Dato etiqueta="Renglones" valor={numero(resumen.renglones)} pie={`${numero(resumen.unidades)} unidades`} />
        <Dato etiqueta="Disponibles" valor={numero(resumen.disponibles)} tono="text-emerald-600 dark:text-emerald-400" />
        <Dato etiqueta="En evento" valor={numero(resumen.enEvento)} tono="text-amber-600 dark:text-amber-500" />
        <Dato etiqueta="En taller" valor={numero(resumen.enMantenimiento)} />
        <Dato etiqueta="Valor de compra" valor={pesos(resumen.valorCompra)} pie={`mercado ${pesos(resumen.valorMercado)}`} />
        <Dato etiqueta="Por revisar" valor={numero(resumen.porRevisar)} tono={resumen.porRevisar ? "text-amber-600 dark:text-amber-500" : undefined} pie="renglones marcados" />
      </div>

      <Tabs defaultValue="inventario">
        <TabsList className="mb-3">
          <TabsTrigger value="inventario"><Package className="mr-1.5 h-4 w-4" />Inventario</TabsTrigger>
          <TabsTrigger value="eventos"><Boxes className="mr-1.5 h-4 w-4" />En eventos</TabsTrigger>
          <TabsTrigger value="movimientos"><History className="mr-1.5 h-4 w-4" />Movimientos</TabsTrigger>
          <TabsTrigger value="valor"><Wrench className="mr-1.5 h-4 w-4" />Valor</TabsTrigger>
        </TabsList>

        {/* ---------------- inventario ---------------- */}
        <TabsContent value="inventario">
          <div className="mb-3 flex flex-wrap gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Buscar por nombre, código o categoría…"
                     value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las categorías</SelectItem>
                {categorias.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={estado} onValueChange={setEstado}>
              <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todo</SelectItem>
                <SelectItem value="disponibles">Con unidades libres</SelectItem>
                <SelectItem value="en_evento">Algo en la calle</SelectItem>
                <SelectItem value="agotados">Sin nada libre</SelectItem>
                <SelectItem value="mantenimiento">En taller</SelectItem>
                <SelectItem value="revisar">Por revisar</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {cargando ? (
            <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />Cargando la bodega…
            </div>
          ) : lista.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
              No hay equipos que coincidan con el filtro.
            </CardContent></Card>
          ) : (
            <div className="mobile-scroll-container rounded-lg border border-border">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="p-2">Código</th>
                    <th className="p-2">Elemento</th>
                    <th className="p-2">Categoría</th>
                    <th className="p-2 text-right">Total</th>
                    <th className="p-2 text-right">Libre</th>
                    <th className="p-2 text-right">Afuera</th>
                    <th className="p-2">Estado</th>
                    <th className="p-2 text-right">Valor</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((a) => (
                    <tr key={a.id} className="border-t border-border hover:bg-accent/40">
                      <td className="p-2 font-mono text-xs">{a.codigo}</td>
                      <td className="p-2">
                        <button className="text-left hover:underline" onClick={() => setEditando(a)}>
                          {a.elemento}
                        </button>
                        {a.revisar && (
                          <span title={a.revisar_motivo || ""}>
                            <AlertTriangle className="ml-1.5 inline h-3.5 w-3.5 text-amber-600" />
                          </span>
                        )}
                      </td>
                      <td className="p-2 text-xs text-muted-foreground">{a.categoria}</td>
                      <td className="p-2 text-right tabular-nums">{a.cantidad_total}</td>
                      <td className="p-2 text-right font-semibold tabular-nums">{a.disponible}</td>
                      <td className="p-2 text-right tabular-nums text-muted-foreground">{a.en_evento || "—"}</td>
                      <td className="p-2">{badgeEstado(a)}</td>
                      <td className="p-2 text-right text-xs tabular-nums text-muted-foreground">
                        {pesos(Number(a.precio_unitario) * a.cantidad_total)}
                      </td>
                      <td className="p-2">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" className="h-7 px-2"
                                  disabled={a.disponible <= 0}
                                  onClick={() => setMovDe({ activo: a, tipo: "salida" })}>
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 px-2"
                                  disabled={a.en_evento <= 0}
                                  onClick={() => setMovDe({ activo: a, tipo: "entrada" })}>
                            <ArrowDownLeft className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">
            {numero(lista.length)} renglón(es). La flecha hacia arriba saca de bodega; la de abajo devuelve.
          </p>
        </TabsContent>

        {/* ---------------- en eventos ---------------- */}
        <TabsContent value="eventos">
          {porEvento.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
              No hay nada fuera de bodega ahora mismo.
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {porEvento.map((g) => (
                <Card key={g.nombre}>
                  <CardContent className="p-3">
                    <div className="mb-2 flex items-baseline justify-between gap-2">
                      <p className="font-semibold">{g.nombre}</p>
                      <span className="text-xs text-muted-foreground">{numero(g.total)} unidad(es)</span>
                    </div>
                    <ul className="space-y-1">
                      {g.piezas.map(({ a, n }) => (
                        <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="min-w-0 truncate">
                            <span className="font-mono text-xs text-muted-foreground">{a.codigo}</span>{" "}
                            {a.elemento}
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            <span className="tabular-nums">{n}</span>
                            <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]"
                                    onClick={() => setMovDe({ activo: a, tipo: "entrada" })}>
                              Devolver
                            </Button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ---------------- movimientos ---------------- */}
        <TabsContent value="movimientos">
          <div className="mobile-scroll-container rounded-lg border border-border">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="p-2">Fecha</th>
                  <th className="p-2">Movimiento</th>
                  <th className="p-2">Equipo</th>
                  <th className="p-2 text-right">Cant.</th>
                  <th className="p-2">Evento</th>
                  <th className="p-2">Quién</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((m) => {
                  const a = activos.find((x) => x.id === m.activo_id);
                  return (
                    <tr key={m.id} className="border-t border-border">
                      <td className="p-2 whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(m.fecha).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}
                      </td>
                      <td className="p-2">
                        <Badge variant="outline" className={cn(
                          m.tipo === "salida" && "border-amber-500/40 text-amber-700 dark:text-amber-500",
                          m.tipo === "entrada" && "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                        )}>
                          {m.tipo}
                        </Badge>
                      </td>
                      <td className="p-2">{a?.elemento || "—"}</td>
                      <td className="p-2 text-right tabular-nums">{m.cantidad}</td>
                      <td className="p-2 text-xs">{m.evento_nombre || "—"}</td>
                      <td className="p-2 text-xs text-muted-foreground">{m.responsable_nombre}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {movimientos.length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">Todavía no hay movimientos.</p>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">
            Los últimos 400 movimientos. Un movimiento no se edita ni se borra: si hubo un error,
            se corrige con el movimiento contrario, y así el historial dice lo que de verdad pasó.
          </p>
        </TabsContent>

        {/* ---------------- valor ---------------- */}
        <TabsContent value="valor">
          <div className="mobile-scroll-container rounded-lg border border-border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="p-2">Categoría</th>
                  <th className="p-2 text-right">Unidades</th>
                  <th className="p-2">Valor de compra</th>
                  <th className="p-2 text-right">Valor de mercado</th>
                  <th className="p-2 text-right">Depreciación</th>
                </tr>
              </thead>
              <tbody>
                {valorPorCategoria.filas.map((f) => (
                  <tr key={f.cat} className="border-t border-border">
                    <td className="p-2 font-medium">{f.cat}</td>
                    <td className="p-2 text-right tabular-nums">{numero(f.n)}</td>
                    <td className="p-2">
                      {/* Una sola barra, un solo tono: aqui el color no
                          identifica nada, solo dice cuanto. */}
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-sm bg-muted">
                          <div className="h-full rounded-sm bg-primary"
                               style={{ width: `${Math.max(2, (f.compra / valorPorCategoria.tope) * 100)}%` }} />
                        </div>
                        <span className="w-32 shrink-0 text-right text-xs tabular-nums">{pesos(f.compra)}</span>
                      </div>
                    </td>
                    <td className="p-2 text-right text-xs tabular-nums">{pesos(f.mercado)}</td>
                    <td className="p-2 text-right text-xs tabular-nums text-muted-foreground">{pesos(f.dep)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-semibold">
                  <td className="p-2">Total</td>
                  <td className="p-2 text-right tabular-nums">{numero(resumen.unidades)}</td>
                  <td className="p-2 text-right tabular-nums">{pesos(resumen.valorCompra)}</td>
                  <td className="p-2 text-right tabular-nums">{pesos(resumen.valorMercado)}</td>
                  <td className="p-2 text-right tabular-nums">{pesos(resumen.depreciacion)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            El valor de compra se calcula como precio unitario × cantidad. El de mercado y la
            depreciación son los que venían del avalúo: son una estimación gerencial, no un avalúo
            formal.
          </p>
        </TabsContent>
      </Tabs>

      <MovimientoDialog
        activo={movDe?.activo ?? null}
        tipo={movDe?.tipo ?? "salida"}
        proyectos={projects}
        abierto={!!movDe}
        onCerrar={() => setMovDe(null)}
        onGuardar={registrarMovimiento}
      />
      <ActivoDialog
        activo={editando}
        categorias={categorias}
        abierto={!!editando || creando}
        onCerrar={() => { setEditando(null); setCreando(false); }}
        onGuardar={guardarActivo}
      />
    </Layout>
  );
}
