import { useState, useMemo } from "react";
import { useProjects } from "@/contexts/ProjectsContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Download, Image as ImageIcon, Calendar } from "lucide-react";
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";
import * as XLSX from "xlsx";
import { CajaMenorItem, Project } from "@/types";
import CajaMenorKPIs from "./CajaMenorKPIs";

interface FlattenedCajaMenorItem extends CajaMenorItem {
  eventoId: string;
  eventoNombre: string;
  recibo: string;
  fecha: string;
}

const ReporteCajaMenor = () => {
  const { projects } = useProjects();
  
  // Filter states
  const [globalSearch, setGlobalSearch] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [reciboFilter, setReciboFilter] = useState("");
  const [procesoPagoFilter, setProcesoPagoFilter] = useState<string>("all");
  const [empleadoFilter, setEmpleadoFilter] = useState<string>("all");
  const [categoriaFilter, setCategoriaFilter] = useState<string>("all");
  const [recursosFilter, setRecursosFilter] = useState<string>("all");
  const [contingenciaFilter, setContingenciaFilter] = useState<string>("all");
  const [estadoFilter, setEstadoFilter] = useState<string>("all");
  const [eventoFilter, setEventoFilter] = useState<string>("all");

  // Flatten all caja menor items from all projects
  const allCajaMenorItems = useMemo((): FlattenedCajaMenorItem[] => {
    const items: FlattenedCajaMenorItem[] = [];
    
    projects.forEach((project: Project) => {
      if (project.cajaMenor && project.cajaMenor.length > 0) {
        project.cajaMenor.forEach((item, index) => {
          // Generate receipt number based on item ID
          const reciboNum = item.id.replace(/\D/g, '').slice(-6).padStart(6, '0');
          
          items.push({
            ...item,
            eventoId: project.id,
            eventoNombre: project.evento || 'Sin nombre',
            recibo: `RCM-${reciboNum}`,
            fecha: item.createdAt || project.createdAt,
          });
        });
      }
    });
    
    // Sort by date descending
    return items.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [projects]);

  // Get unique values for filters
  const uniqueEmpleados = useMemo(() => 
    [...new Set(allCajaMenorItems.map(i => i.empleadoNombre).filter(Boolean))].sort(),
    [allCajaMenorItems]
  );
  
  const uniqueEventos = useMemo(() => 
    [...new Set(allCajaMenorItems.map(i => i.eventoNombre).filter(Boolean))].sort(),
    [allCajaMenorItems]
  );

  // Apply all filters
  const filteredItems = useMemo(() => {
    return allCajaMenorItems.filter(item => {
      // Global search
      if (globalSearch) {
        const searchLower = globalSearch.toLowerCase();
        const matchesSearch = 
          item.recibo.toLowerCase().includes(searchLower) ||
          item.eventoNombre.toLowerCase().includes(searchLower) ||
          (item.empleadoNombre?.toLowerCase() || '').includes(searchLower) ||
          (item.concepto?.toLowerCase() || '').includes(searchLower) ||
          item.categoria.toLowerCase().includes(searchLower) ||
          item.recursos.toLowerCase().includes(searchLower) ||
          item.estado.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Date range filter
      if (fechaDesde || fechaHasta) {
        const itemDate = new Date(item.fecha);
        if (fechaDesde) {
          const fromDate = startOfDay(parseISO(fechaDesde));
          if (itemDate < fromDate) return false;
        }
        if (fechaHasta) {
          const toDate = endOfDay(parseISO(fechaHasta));
          if (itemDate > toDate) return false;
        }
      }

      // Recibo filter
      if (reciboFilter && !item.recibo.toLowerCase().includes(reciboFilter.toLowerCase())) {
        return false;
      }

      // Dropdown filters
      if (procesoPagoFilter !== "all" && (item.procesoPago || '') !== procesoPagoFilter) return false;
      if (empleadoFilter !== "all" && item.empleadoNombre !== empleadoFilter) return false;
      if (categoriaFilter !== "all" && item.categoria !== categoriaFilter) return false;
      if (recursosFilter !== "all" && item.recursos !== recursosFilter) return false;
      if (contingenciaFilter !== "all" && item.contingencia !== contingenciaFilter) return false;
      if (estadoFilter !== "all" && item.estado !== estadoFilter) return false;
      if (eventoFilter !== "all" && item.eventoNombre !== eventoFilter) return false;

      return true;
    });
  }, [allCajaMenorItems, globalSearch, fechaDesde, fechaHasta, reciboFilter, procesoPagoFilter, 
      empleadoFilter, categoriaFilter, recursosFilter, contingenciaFilter, estadoFilter, eventoFilter]);

  // Export to Excel
  const handleExport = () => {
    const exportData = filteredItems.map(item => ({
      'FECHA': item.fecha ? format(new Date(item.fecha), 'dd/MM/yyyy', { locale: es }) : '',
      'RECIBO': item.recibo,
      'PROCESO DE PAGO': item.procesoPago || '',
      'EMPLEADO': item.empleadoNombre || '',
      'CONCEPTO': item.concepto || '',
      'IMÁGENES': item.imagenes?.length || 0,
      'VALOR (COP)': item.valor,
      'CATEGORÍA': item.categoria,
      'RECURSOS': item.recursos,
      'CONTINGENCIA': item.contingencia || 'No',
      'ESTADO': item.estado,
      'EVENTO': item.eventoNombre,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte Caja Menor");
    
    // Auto-size columns
    const colWidths = [
      { wch: 12 }, // FECHA
      { wch: 14 }, // RECIBO
      { wch: 16 }, // PROCESO DE PAGO
      { wch: 25 }, // EMPLEADO
      { wch: 30 }, // CONCEPTO
      { wch: 10 }, // IMÁGENES
      { wch: 15 }, // VALOR
      { wch: 14 }, // CATEGORÍA
      { wch: 16 }, // RECURSOS
      { wch: 12 }, // CONTINGENCIA
      { wch: 12 }, // ESTADO
      { wch: 25 }, // EVENTO
    ];
    ws['!cols'] = colWidths;
    
    XLSX.writeFile(wb, `Reporte_Caja_Menor_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* KPIs Dashboard */}
      <CajaMenorKPIs items={filteredItems} />

      {/* Filters Section */}
      <Card>
        <CardContent className="p-4 space-y-4">
          {/* Global Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar en reporte... (recibo, evento, empleado, concepto, categoría, recursos, estado)"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Column Filters */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {/* Date Range */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Fecha Desde</label>
              <Input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Fecha Hasta</label>
              <Input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="h-9"
              />
            </div>

            {/* Recibo */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Recibo</label>
              <Input
                placeholder="RCM-..."
                value={reciboFilter}
                onChange={(e) => setReciboFilter(e.target.value)}
                className="h-9"
              />
            </div>

            {/* Proceso de Pago */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Proceso de Pago</label>
              <Select value={procesoPagoFilter} onValueChange={setProcesoPagoFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="Pagado">Pagado</SelectItem>
                  <SelectItem value="No pagado">No pagado</SelectItem>
                  <SelectItem value="">Sin asignar</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Empleado */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Empleado</label>
              <Select value={empleadoFilter} onValueChange={setEmpleadoFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {uniqueEmpleados.map(emp => (
                    <SelectItem key={emp} value={emp!}>{emp}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Categoría */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Categoría</label>
              <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="Transporte">Transporte</SelectItem>
                  <SelectItem value="Alimentación">Alimentación</SelectItem>
                  <SelectItem value="Compras">Compras</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Recursos */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Recursos</label>
              <Select value={recursosFilter} onValueChange={setRecursosFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="Recursos propios">Recursos propios</SelectItem>
                  <SelectItem value="BBM">BBM</SelectItem>
                  <SelectItem value="Anticipo BBM">Anticipo BBM</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Contingencia */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Contingencia</label>
              <Select value={contingenciaFilter} onValueChange={setContingenciaFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="Sí">Sí</SelectItem>
                  <SelectItem value="No">No</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Estado */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Estado</label>
              <Select value={estadoFilter} onValueChange={setEstadoFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="Aprobado">Aprobado</SelectItem>
                  <SelectItem value="No aprobado">No aprobado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Evento */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Evento</label>
              <Select value={eventoFilter} onValueChange={setEventoFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {uniqueEventos.map(evt => (
                    <SelectItem key={evt} value={evt!}>{evt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Export Button */}
          <div className="flex justify-end">
            <Button onClick={handleExport} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Exportar Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="whitespace-nowrap">FECHA</TableHead>
                  <TableHead className="whitespace-nowrap">RECIBO</TableHead>
                  <TableHead className="whitespace-nowrap">PROCESO DE PAGO</TableHead>
                  <TableHead className="whitespace-nowrap">EMPLEADO</TableHead>
                  <TableHead className="whitespace-nowrap">CONCEPTO</TableHead>
                  <TableHead className="whitespace-nowrap text-center">IMÁGENES</TableHead>
                  <TableHead className="whitespace-nowrap text-right">VALOR (COP)</TableHead>
                  <TableHead className="whitespace-nowrap">CATEGORÍA</TableHead>
                  <TableHead className="whitespace-nowrap">RECURSOS</TableHead>
                  <TableHead className="whitespace-nowrap">CONTINGENCIA</TableHead>
                  <TableHead className="whitespace-nowrap">ESTADO</TableHead>
                  <TableHead className="whitespace-nowrap">EVENTO</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                      No hay registros de caja menor
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => (
                    <TableRow key={`${item.eventoId}-${item.id}`}>
                      <TableCell className="whitespace-nowrap">
                        {item.fecha ? format(new Date(item.fecha), 'dd/MM/yyyy', { locale: es }) : '-'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs">
                        {item.recibo}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={item.procesoPago === 'Pagado' ? 'default' : 'secondary'}
                          className={
                            item.procesoPago === 'Pagado' 
                              ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20' 
                              : 'bg-muted text-muted-foreground'
                          }
                        >
                          {item.procesoPago || 'Sin asignar'}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate">
                        {item.empleadoNombre || '-'}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {item.concepto || '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        {item.imagenes && item.imagenes.length > 0 ? (
                          <Badge variant="outline" className="gap-1">
                            <ImageIcon className="h-3 w-3" />
                            {item.imagenes.length}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium whitespace-nowrap">
                        {formatCurrency(item.valor)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          item.categoria === 'Transporte' ? 'border-blue-500/50 text-blue-500' :
                          item.categoria === 'Alimentación' ? 'border-orange-500/50 text-orange-500' :
                          'border-purple-500/50 text-purple-500'
                        }>
                          {item.categoria}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {item.recursos || '-'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {item.contingencia === 'Sí' ? (
                          <Badge variant="destructive" className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/20">
                            Sí
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">No</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={item.estado === 'Aprobado' ? 'default' : 'destructive'}
                          className={
                            item.estado === 'Aprobado' 
                              ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20' 
                              : 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                          }
                        >
                          {item.estado}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate font-medium">
                        {item.eventoNombre}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          {/* Results count */}
          <div className="p-4 border-t text-sm text-muted-foreground">
            Mostrando {filteredItems.length} de {allCajaMenorItems.length} registros
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReporteCajaMenor;
