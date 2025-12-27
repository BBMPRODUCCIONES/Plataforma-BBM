import { useState, useMemo, useCallback } from "react";
import { useProjects } from "@/contexts/ProjectsContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Download, Image as ImageIcon, Loader2, Eye, DownloadIcon } from "lucide-react";
import { format, parseISO, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";
import * as XLSX from "xlsx";
import { CajaMenorItem, Project, Attachment } from "@/types";
import CajaMenorKPIs from "./CajaMenorKPIs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EventLink } from "@/components/EventLink";

interface FlattenedCajaMenorItem extends CajaMenorItem {
  eventoId: string;
  eventoNombre: string;
  recibo: string;
  fecha: string;
}

const ReporteCajaMenor = () => {
  const { projects, updateProjectMultiple } = useProjects();

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

  // Image gallery states
  const [selectedImages, setSelectedImages] = useState<Attachment[]>([]);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [loadingImages, setLoadingImages] = useState(false);

  const safeLower = (value?: string | null) => (value ?? "").toLowerCase();

  const safeDate = (value?: string | null) => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const formatDateDisplay = (value?: string | null) => {
    const d = safeDate(value);
    return d ? format(d, "dd/MM/yyyy", { locale: es }) : "-";
  };

  const formatDateExport = (value?: string | null) => {
    const d = safeDate(value);
    return d ? format(d, "dd/MM/yyyy", { locale: es }) : "";
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Flatten all caja menor items from all projects
  const allCajaMenorItems = useMemo((): FlattenedCajaMenorItem[] => {
    const items: FlattenedCajaMenorItem[] = [];

    projects.forEach((project: Project) => {
      const caja = Array.isArray(project.cajaMenor) ? project.cajaMenor : [];
      if (caja.length === 0) return;

      caja.forEach((item, index) => {
        // Generate receipt number based on item ID (avoid crashes if id is missing)
        const rawId = typeof item.id === "string" ? item.id : String(item.id ?? index);
        const reciboNum = rawId.replace(/\D/g, "").slice(-6).padStart(6, "0");

        items.push({
          ...item,
          eventoId: project.id,
          eventoNombre: project.evento || "Sin nombre",
          recibo: `RCM-${reciboNum}`,
          fecha: item.createdAt || project.createdAt || "",
        });
      });
    });

    // Sort by date descending (invalid dates go last)
    return items.sort((a, b) => {
      const tb = safeDate(b.fecha)?.getTime() ?? 0;
      const ta = safeDate(a.fecha)?.getTime() ?? 0;
      return tb - ta;
    });
  }, [projects]);

  // Get unique values for filters
  const uniqueEmpleados = useMemo(
    () => [...new Set(allCajaMenorItems.map((i) => i.empleadoNombre).filter(Boolean))].sort(),
    [allCajaMenorItems]
  );

  const uniqueEventos = useMemo(
    () => [...new Set(allCajaMenorItems.map((i) => i.eventoNombre).filter(Boolean))].sort(),
    [allCajaMenorItems]
  );

  // Apply all filters
  const filteredItems = useMemo(() => {
    return allCajaMenorItems.filter((item) => {
      // Global search
      if (globalSearch) {
        const searchLower = globalSearch.toLowerCase();
        const matchesSearch =
          safeLower(item.recibo).includes(searchLower) ||
          safeLower(item.eventoNombre).includes(searchLower) ||
          safeLower(item.empleadoNombre).includes(searchLower) ||
          safeLower(item.concepto).includes(searchLower) ||
          safeLower(item.categoria).includes(searchLower) ||
          safeLower(item.recursos).includes(searchLower) ||
          safeLower(item.estado).includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Date range filter
      if (fechaDesde || fechaHasta) {
        const itemDate = safeDate(item.fecha);
        if (!itemDate) return false;

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
      if (reciboFilter && !safeLower(item.recibo).includes(reciboFilter.toLowerCase())) {
        return false;
      }

      // Dropdown filters - treat empty/undefined procesoPago as "No pagado"
      if (procesoPagoFilter !== "all") {
        const efectivoProcesoPago = item.procesoPago || "No pagado";
        if (efectivoProcesoPago !== procesoPagoFilter) return false;
      }
      if (empleadoFilter !== "all" && item.empleadoNombre !== empleadoFilter) return false;
      if (categoriaFilter !== "all" && item.categoria !== categoriaFilter) return false;
      if (recursosFilter !== "all" && item.recursos !== recursosFilter) return false;
      if (contingenciaFilter !== "all" && item.contingencia !== contingenciaFilter) return false;
      if (estadoFilter !== "all" && item.estado !== estadoFilter) return false;
      if (eventoFilter !== "all" && item.eventoNombre !== eventoFilter) return false;

      return true;
    });
  }, [
    allCajaMenorItems,
    globalSearch,
    fechaDesde,
    fechaHasta,
    reciboFilter,
    procesoPagoFilter,
    empleadoFilter,
    categoriaFilter,
    recursosFilter,
    contingenciaFilter,
    estadoFilter,
    eventoFilter,
  ]);

  // Handle proceso pago change
  const handleProcesoPagoChange = useCallback(async (
    eventoId: string,
    itemId: string,
    newValue: 'Pago' | 'No pago'
  ) => {
    const project = projects.find(p => p.id === eventoId);
    if (!project) return;

    const cajaMenor = Array.isArray(project.cajaMenor) ? [...project.cajaMenor] : [];
    const itemIndex = cajaMenor.findIndex(item => item.id === itemId);
    if (itemIndex === -1) return;

    // Update the procesoPago field
    cajaMenor[itemIndex] = {
      ...cajaMenor[itemIndex],
      procesoPago: newValue === 'Pago' ? 'Pagado' : 'No pagado'
    };

    try {
      await updateProjectMultiple(eventoId, { cajaMenor });
      toast.success(`Estado de pago actualizado a "${newValue}"`);
    } catch (error) {
      toast.error("Error al actualizar el estado de pago");
      console.error(error);
    }
  }, [projects, updateProjectMultiple]);

  // Get signed URL for an attachment
  const getSignedUrl = async (attachment: Attachment): Promise<string | null> => {
    // If we already have a direct URL, use it
    if (attachment.url && attachment.url.startsWith('http')) {
      return attachment.url;
    }
    
    // Otherwise, get a signed URL from the edge function
    if (!attachment.filePath || !attachment.bucket) return null;
    
    try {
      const { data, error } = await supabase.functions.invoke("get-signed-url", {
        body: { 
          bucket: attachment.bucket, 
          path: attachment.filePath, 
          expiresIn: 3600 
        },
      });
      
      if (error || !data?.signedUrl) {
        console.error("Error getting signed URL:", error);
        return null;
      }
      return data.signedUrl;
    } catch (err) {
      console.error("Error invoking get-signed-url:", err);
      return null;
    }
  };

  // Handler to open image gallery
  const handleOpenImages = async (imagenes: Attachment[]) => {
    setSelectedImages(imagenes);
    setImageDialogOpen(true);
    setLoadingImages(true);
    setImageUrls({});
    
    // Load all signed URLs
    const urls: Record<string, string> = {};
    for (const img of imagenes) {
      const url = await getSignedUrl(img);
      if (url) urls[img.id] = url;
    }
    setImageUrls(urls);
    setLoadingImages(false);
  };

  // Download image
  const handleDownloadImage = async (url: string, name: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Error downloading image:", err);
      toast.error("Error al descargar la imagen");
    }
  };

  // Export to Excel
  const handleExport = () => {
    const exportData = filteredItems.map((item) => ({
      "# RECIBO": item.recibo,
      FECHA: formatDateExport(item.fecha),
      EMPLEADO: item.empleadoNombre || "",
      EVENTO: item.eventoNombre,
      CONCEPTO: item.concepto || "",
      IMÁGENES: item.imagenes?.length || 0,
      CATEGORÍA: item.categoria || "",
      RECURSOS: item.recursos || "",
      CONTINGENCIA: item.contingencia || "No",
      "VALOR (COP)": item.valor,
      ESTADO: item.estado || "",
      "PROCESO DE PAGO": item.procesoPago === "Pagado" ? "Pagado" : "No pagado",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte Caja Menor");

    // Auto-size columns
    const colWidths = [
      { wch: 14 }, // # RECIBO
      { wch: 12 }, // FECHA
      { wch: 25 }, // EMPLEADO
      { wch: 25 }, // EVENTO
      { wch: 30 }, // CONCEPTO
      { wch: 10 }, // IMÁGENES
      { wch: 14 }, // CATEGORÍA
      { wch: 16 }, // RECURSOS
      { wch: 12 }, // CONTINGENCIA
      { wch: 15 }, // VALOR
      { wch: 12 }, // ESTADO
      { wch: 16 }, // PROCESO DE PAGO
    ];
    ws["!cols"] = colWidths;

    XLSX.writeFile(wb, `Reporte_Caja_Menor_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
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
              <Input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Fecha Hasta</label>
              <Input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="h-9" />
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
                  <SelectItem value="Pagado">Pago</SelectItem>
                  <SelectItem value="No pagado">No pago</SelectItem>
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
                  {uniqueEmpleados.map((emp) => (
                    <SelectItem key={emp} value={emp!}>
                      {emp}
                    </SelectItem>
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
                  {uniqueEventos.map((evt) => (
                    <SelectItem key={evt} value={evt!}>
                      {evt}
                    </SelectItem>
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
                <TableRow className="bg-[hsl(var(--table-header))]">
                  <TableHead className="whitespace-nowrap"># RECIBO</TableHead>
                  <TableHead className="whitespace-nowrap">FECHA</TableHead>
                  <TableHead className="whitespace-nowrap">EMPLEADO</TableHead>
                  <TableHead className="whitespace-nowrap">EVENTO</TableHead>
                  <TableHead className="whitespace-nowrap">CONCEPTO</TableHead>
                  <TableHead className="whitespace-nowrap text-center">IMÁGENES</TableHead>
                  <TableHead className="whitespace-nowrap">CATEGORÍA</TableHead>
                  <TableHead className="whitespace-nowrap">RECURSOS</TableHead>
                  <TableHead className="whitespace-nowrap">CONTINGENCIA</TableHead>
                  <TableHead className="whitespace-nowrap text-right">VALOR (COP)</TableHead>
                  <TableHead className="whitespace-nowrap">ESTADO</TableHead>
                  <TableHead className="whitespace-nowrap">PROCESO DE PAGO</TableHead>
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
                      {/* # RECIBO */}
                      <TableCell className="whitespace-nowrap font-mono text-xs">{item.recibo}</TableCell>
                      {/* FECHA */}
                      <TableCell className="whitespace-nowrap">{formatDateDisplay(item.fecha)}</TableCell>
                      {/* EMPLEADO */}
                      <TableCell className="max-w-[150px] truncate">{item.empleadoNombre || "-"}</TableCell>
                      {/* EVENTO */}
                      <TableCell className="max-w-[200px]">
                        <EventLink
                          eventId={item.eventoId}
                          eventName={item.eventoNombre}
                          variant="text"
                          source="reportes"
                        />
                      </TableCell>
                      {/* CONCEPTO */}
                      <TableCell className="max-w-[200px] truncate">{item.concepto || "-"}</TableCell>
                      {/* IMÁGENES */}
                      <TableCell className="text-center">
                        {item.imagenes && item.imagenes.length > 0 ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 h-7 px-2"
                            onClick={() => handleOpenImages(item.imagenes!)}
                          >
                            <ImageIcon className="h-3 w-3" />
                            {item.imagenes.length}
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      {/* CATEGORÍA */}
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            item.categoria === "Transporte"
                              ? "border-blue-500/50 text-blue-500"
                              : item.categoria === "Alimentación"
                                ? "border-orange-500/50 text-orange-500"
                                : "border-purple-500/50 text-purple-500"
                          }
                        >
                          {item.categoria || "-"}
                        </Badge>
                      </TableCell>
                      {/* RECURSOS */}
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {item.recursos || "-"}
                        </Badge>
                      </TableCell>
                      {/* CONTINGENCIA */}
                      <TableCell>
                        {item.contingencia === "Sí" ? (
                          <Badge
                            variant="destructive"
                            className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/20"
                          >
                            Sí
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">No</span>
                        )}
                      </TableCell>
                      {/* VALOR (COP) */}
                      <TableCell className="text-right font-medium whitespace-nowrap">
                        {formatCurrency(Number(item.valor || 0))}
                      </TableCell>
                      {/* ESTADO */}
                      <TableCell>
                        <Badge
                          variant={item.estado === "Aprobado" ? "default" : "destructive"}
                          className={
                            item.estado === "Aprobado"
                              ? "bg-green-500/10 text-green-500 hover:bg-green-500/20"
                              : "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                          }
                        >
                          {item.estado || "-"}
                        </Badge>
                      </TableCell>
                      {/* PROCESO DE PAGO - Dropdown editable */}
                      <TableCell>
                        <Select
                          value={item.procesoPago === "Pagado" ? "Pago" : "No pago"}
                          onValueChange={(value: 'Pago' | 'No pago') => handleProcesoPagoChange(item.eventoId, item.id, value)}
                        >
                          <SelectTrigger 
                            className={`h-8 w-[120px] text-xs font-medium border-2 ${
                              item.procesoPago === "Pagado"
                                ? "bg-green-500/20 border-green-500 text-green-600 dark:text-green-400"
                                : "bg-red-500/20 border-red-500 text-red-600 dark:text-red-400"
                            }`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Pago" className="text-green-600 dark:text-green-400 font-medium">
                              Pago
                            </SelectItem>
                            <SelectItem value="No pago" className="text-red-600 dark:text-red-400 font-medium">
                              No pago
                            </SelectItem>
                          </SelectContent>
                        </Select>
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

      {/* Image Gallery Dialog */}
      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Imágenes del registro ({selectedImages.length})
            </DialogTitle>
          </DialogHeader>
          
          {loadingImages ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="mt-3 text-muted-foreground">Cargando imágenes...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-4">
              {selectedImages.map((img) => {
                const url = imageUrls[img.id];
                return (
                  <div 
                    key={img.id} 
                    className="relative group rounded-lg overflow-hidden border bg-muted/30"
                  >
                    {url ? (
                      <>
                        <img
                          src={url}
                          alt={img.name}
                          className="w-full h-40 object-cover transition-transform group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Button 
                            size="icon" 
                            variant="secondary" 
                            className="h-9 w-9"
                            onClick={() => window.open(url, "_blank")}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="secondary" 
                            className="h-9 w-9"
                            onClick={() => handleDownloadImage(url, img.name)}
                          >
                            <DownloadIcon className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2 truncate">
                          {img.name}
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-40 flex items-center justify-center text-muted-foreground">
                        <span className="text-sm">Error al cargar</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReporteCajaMenor;
