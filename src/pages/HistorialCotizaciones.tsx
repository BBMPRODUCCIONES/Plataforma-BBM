import { useState, useEffect, useMemo } from "react";
import Layout from "@/components/Layout";
import { PanelHeader } from "@/components/PanelHeader";
import { supabase } from "@/integrations/supabase/client";
import { useProveedores } from "@/contexts/ProveedoresContext";
import { useProjects } from "@/contexts/ProjectsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Download, Eye, Trash2, Loader2, ArrowLeft, FileText, Filter, X, Info, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import * as XLSX from "xlsx";

interface CotizacionHistoryRecord {
  id: string;
  proveedor_id: string;
  evento_id: string | null;
  personal_item_id: string | null;
  fecha: string;
  proveedor_nombre: string;
  proveedor_categoria: string;
  proveedor_telefono: string;
  proveedor_correo: string;
  proveedor_tipo_producto_servicio: string;
  file_name: string;
  file_url: string;
  file_path: string;
  file_size: number;
  uploaded_by: string | null;
  uploaded_by_email: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  deleted_by_email: string | null;
  created_at: string;
  // Joined from projects
  evento_nombre?: string;
}

interface FileInfo {
  id: string;
  name: string;
  path: string;
  size: number;
  uploadedAt: string;
}

interface GroupedCotizacionRecord {
  groupKey: string;
  proveedor_id: string;
  proveedor_nombre: string;
  proveedor_categoria: string;
  proveedor_telefono: string;
  proveedor_correo: string;
  proveedor_tipo_producto_servicio: string;
  evento_id: string | null;
  evento_nombre: string;
  personal_item_id: string | null;
  latestDate: string;
  files: FileInfo[];
}

const HistorialCotizaciones = () => {
  const { proveedores, loading: proveedoresLoading } = useProveedores();
  const { projects } = useProjects();
  const { user } = useAuth();
  const { role, canEdit } = useUserRole();
  const isAdmin = role?.toLowerCase() === "administrador";
  const canEditFiles = canEdit();

  // Search & filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProveedorId, setSelectedProveedorId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [eventoFilter, setEventoFilter] = useState<string>("todos");
  const [categoriaFilter, setCategoriaFilter] = useState<string>("todos");
  const [tipoProductoFilter, setTipoProductoFilter] = useState<string>("todos");
  
  const [records, setRecords] = useState<CotizacionHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  // Get unique values for filters
  const uniqueEventos = useMemo(() => {
    const eventos = new Set<string>();
    records.forEach(r => {
      if (r.evento_nombre && r.evento_nombre !== "Sin evento") {
        eventos.add(r.evento_nombre);
      }
    });
    return Array.from(eventos).sort();
  }, [records]);

  const uniqueCategorias = useMemo(() => {
    const categorias = new Set<string>();
    records.forEach(r => {
      if (r.proveedor_categoria) {
        categorias.add(r.proveedor_categoria);
      }
    });
    return Array.from(categorias).sort();
  }, [records]);

  const uniqueTiposProducto = useMemo(() => {
    const tipos = new Set<string>();
    records.forEach(r => {
      if (r.proveedor_tipo_producto_servicio) {
        tipos.add(r.proveedor_tipo_producto_servicio);
      }
    });
    return Array.from(tipos).sort();
  }, [records]);

  // Filter proveedores for autocomplete
  const filteredProveedores = useMemo(() => {
    if (!searchTerm) return proveedores;
    const normalizedSearch = searchTerm.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return proveedores.filter((p) => {
      const normalizedName = p.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const normalizedCorreo = (p.correo || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const normalizedTipo = (p.tipoProductoServicio || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return normalizedName.includes(normalizedSearch) || 
             normalizedCorreo.includes(normalizedSearch) ||
             normalizedTipo.includes(normalizedSearch);
    });
  }, [proveedores, searchTerm]);

  const selectedProveedor = useMemo(() => {
    return proveedores.find((p) => p.id === selectedProveedorId);
  }, [proveedores, selectedProveedorId]);

  // Fetch history records
  useEffect(() => {
    fetchRecords();
  }, [selectedProveedorId]);

  // Group records by evento+proveedor+personal_item
  const groupRecords = (records: CotizacionHistoryRecord[]): GroupedCotizacionRecord[] => {
    const groups = new Map<string, GroupedCotizacionRecord>();
    
    records.forEach(record => {
      // Grouping key: evento + proveedor + personal_item (legacy records use fallback)
      const key = `${record.evento_id || 'sin-evento'}-${record.proveedor_id}-${record.personal_item_id || 'legacy-' + record.id}`;
      
      if (!groups.has(key)) {
        groups.set(key, {
          groupKey: key,
          proveedor_id: record.proveedor_id,
          proveedor_nombre: record.proveedor_nombre,
          proveedor_categoria: record.proveedor_categoria,
          proveedor_telefono: record.proveedor_telefono,
          proveedor_correo: record.proveedor_correo,
          proveedor_tipo_producto_servicio: record.proveedor_tipo_producto_servicio,
          evento_id: record.evento_id,
          evento_nombre: record.evento_nombre || "Sin evento",
          personal_item_id: record.personal_item_id,
          latestDate: record.fecha,
          files: []
        });
      }
      
      const group = groups.get(key)!;
      group.files.push({
        id: record.id,
        name: record.file_name,
        path: record.file_path,
        size: record.file_size,
        uploadedAt: record.fecha
      });
      
      // Update to latest date
      if (record.fecha > group.latestDate) {
        group.latestDate = record.fecha;
      }
    });
    
    // Sort groups by latest date descending, and files within each group
    return Array.from(groups.values())
      .sort((a, b) => new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime())
      .map(group => ({
        ...group,
        files: group.files.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
      }));
  };

  // Apply additional filters to records and group them
  const filteredRecords = useMemo(() => {
    const filtered = records.filter(r => {
      if (eventoFilter !== "todos" && r.evento_nombre !== eventoFilter) return false;
      if (categoriaFilter !== "todos" && r.proveedor_categoria !== categoriaFilter) return false;
      if (tipoProductoFilter !== "todos" && r.proveedor_tipo_producto_servicio !== tipoProductoFilter) return false;
      return true;
    });
    return filtered;
  }, [records, eventoFilter, categoriaFilter, tipoProductoFilter]);

  const groupedRecords = useMemo(() => {
    return groupRecords(filteredRecords);
  }, [filteredRecords]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("supplier_cotizacion_history")
        .select("*")
        .is("deleted_at", null)
        .order("fecha", { ascending: false });

      if (selectedProveedorId) {
        query = query.eq("proveedor_id", selectedProveedorId);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching history:", error);
        toast.error("Error al cargar el historial");
        return;
      }

      // Enrich with evento_nombre from projects
      const enrichedRecords = (data || []).map((record) => {
        const project = projects.find((p) => p.id === record.evento_id);
        return {
          ...record,
          evento_nombre: project?.evento || "Sin evento",
        };
      });

      setRecords(enrichedRecords);

      // Pre-load signed URLs
      loadSignedUrls(enrichedRecords);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error al cargar el historial");
    } finally {
      setLoading(false);
    }
  };

  const parseStorageRef = (filePath: string): { bucket: string; path: string } => {
    const knownBuckets = new Set(["supplier-cotizaciones", "project-attachments", "notes-images"]);

    if (!filePath) {
      return { bucket: "project-attachments", path: "" };
    }

    const [first, ...rest] = filePath.split("/");
    
    // Si el primer segmento es un bucket conocido
    if (rest.length > 0 && knownBuckets.has(first)) {
      return { bucket: first, path: rest.join("/") };
    }

    // Detectar patrón de AttachmentManager: {uuid}/personal-*-adjuntos/{filename}
    // Este patrón indica que el archivo está en project-attachments
    if (filePath.includes("/personal-") && filePath.includes("-adjuntos/")) {
      return { bucket: "project-attachments", path: filePath };
    }

    // Detectar patrón UUID como primer segmento (archivos de proyectos)
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidPattern.test(first) && rest.length > 0) {
      return { bucket: "project-attachments", path: filePath };
    }

    // Default para adjuntos del panel de operaciones
    return { bucket: "project-attachments", path: filePath };
  };

  const loadSignedUrls = async (records: CotizacionHistoryRecord[]) => {
    const newSignedUrls: Record<string, string> = {};

    for (const record of records) {
      try {
        const { bucket, path } = parseStorageRef(record.file_path);
        if (!path) continue;

        const { data, error } = await supabase.functions.invoke("get-signed-url", {
          body: { bucket, path, expiresIn: 3600 },
        });

        if (!error && data?.signedUrl) {
          newSignedUrls[record.id] = data.signedUrl;
        }
      } catch (err) {
        console.error("Error getting signed URL:", err);
      }
    }

    setSignedUrls(newSignedUrls);
  };

  const handleViewFile = async (file: FileInfo) => {
    let url = signedUrls[file.id];

    if (!url) {
      const { bucket, path } = parseStorageRef(file.path);
      const { data, error } = await supabase.functions.invoke("get-signed-url", {
        body: { bucket, path, expiresIn: 3600 },
      });
      if (!error && data?.signedUrl) {
        url = data.signedUrl;
        setSignedUrls((prev) => ({ ...prev, [file.id]: url }));
      }
    }

    if (url) {
      window.open(url, "_blank");
    } else {
      toast.error("Error al abrir el archivo");
    }
  };

  const handleDownloadFile = async (file: FileInfo) => {
    let url = signedUrls[file.id];

    if (!url) {
      const { bucket, path } = parseStorageRef(file.path);
      const { data, error } = await supabase.functions.invoke("get-signed-url", {
        body: { bucket, path, expiresIn: 3600 },
      });
      if (!error && data?.signedUrl) {
        url = data.signedUrl;
        setSignedUrls((prev) => ({ ...prev, [file.id]: url }));
      }
    }

    if (url) {
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      toast.error("Error al descargar el archivo");
    }
  };

  const handleView = async (record: CotizacionHistoryRecord) => {
    await handleViewFile({
      id: record.id,
      name: record.file_name,
      path: record.file_path,
      size: record.file_size,
      uploadedAt: record.fecha
    });
  };

  const handleDownload = async (record: CotizacionHistoryRecord) => {
    await handleDownloadFile({
      id: record.id,
      name: record.file_name,
      path: record.file_path,
      size: record.file_size,
      uploadedAt: record.fecha
    });
  };

  const handleDeleteFile = async (fileId: string, fileName: string, group: GroupedCotizacionRecord) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar "${fileName}"?`)) return;

    try {
      const { error } = await supabase
        .from("supplier_cotizacion_history")
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user?.id || null,
          deleted_by_email: user?.email || null,
        })
        .eq("id", fileId);

      if (error) {
        console.error("Error deleting record:", error);
        toast.error("Error al eliminar el registro");
        return;
      }

      await supabase.from("user_audit_log").insert({
        action: "DELETE_COTIZACION_HISTORY",
        actor_id: user?.id || "",
        actor_email: user?.email || "",
        target_id: fileId,
        panel: "historial-cotizaciones",
        details: {
          proveedor_id: group.proveedor_id,
          proveedor_nombre: group.proveedor_nombre,
          file_name: fileName,
          evento_id: group.evento_id,
        },
      });

      toast.success("Archivo eliminado");
      fetchRecords();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error al eliminar el archivo");
    }
  };

  const handleDelete = async (record: CotizacionHistoryRecord) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este registro?")) return;

    try {
      // Soft delete - update deleted_at field
      const { error } = await supabase
        .from("supplier_cotizacion_history")
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user?.id || null,
          deleted_by_email: user?.email || null,
        })
        .eq("id", record.id);

      if (error) {
        console.error("Error deleting record:", error);
        toast.error("Error al eliminar el registro");
        return;
      }

      // Log to audit
      await supabase.from("user_audit_log").insert({
        action: "DELETE_COTIZACION_HISTORY",
        actor_id: user?.id || "",
        actor_email: user?.email || "",
        target_id: record.id,
        panel: "historial-cotizaciones",
        details: {
          proveedor_id: record.proveedor_id,
          proveedor_nombre: record.proveedor_nombre,
          file_name: record.file_name,
          evento_id: record.evento_id,
        },
      });

      toast.success("Registro eliminado");
      fetchRecords();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error al eliminar el registro");
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: es });
    } catch {
      return dateStr;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const clearFilters = () => {
    setSelectedProveedorId(null);
    setSearchTerm("");
    setEventoFilter("todos");
    setCategoriaFilter("todos");
    setTipoProductoFilter("todos");
  };

  const hasActiveFilters = selectedProveedorId || eventoFilter !== "todos" || categoriaFilter !== "todos" || tipoProductoFilter !== "todos";

  // Excel export function
  const exportToExcel = () => {
    if (filteredRecords.length === 0) {
      toast.error("No hay registros para exportar");
      return;
    }

    try {
      // Prepare data for export
      const exportData = filteredRecords.map((record) => ({
        "FECHA": formatDate(record.fecha),
        "EVENTO": record.evento_nombre || "Sin evento",
        "CATEGORÍA": record.proveedor_categoria || "-",
        "NOMBRE": record.proveedor_nombre,
        "TELÉFONO": record.proveedor_telefono || "-",
        "CORREO": record.proveedor_correo || "-",
        "TIPO DE PRODUCTO O SERVICIO": record.proveedor_tipo_producto_servicio || "-",
        "ARCHIVO": record.file_name,
        "TAMAÑO": formatFileSize(record.file_size),
        "SUBIDO POR": record.uploaded_by_email || "-",
      }));

      // Create workbook and worksheet
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Historial Cotizaciones");

      // Set column widths
      const colWidths = [
        { wch: 18 }, // Fecha
        { wch: 25 }, // Evento
        { wch: 15 }, // Categoría
        { wch: 25 }, // Nombre
        { wch: 15 }, // Teléfono
        { wch: 30 }, // Correo
        { wch: 30 }, // Tipo Producto
        { wch: 35 }, // Archivo
        { wch: 12 }, // Tamaño
        { wch: 25 }, // Subido por
      ];
      ws["!cols"] = colWidths;

      // Generate filename with date and filters
      const dateStr = format(new Date(), "yyyy-MM-dd");
      let filename = `historial_cotizaciones_${dateStr}`;
      if (selectedProveedor) {
        filename += `_${selectedProveedor.nombre.replace(/[^a-zA-Z0-9]/g, "_")}`;
      }
      filename += ".xlsx";

      // Download file
      XLSX.writeFile(wb, filename);
      toast.success(`Exportado ${filteredRecords.length} registro(s) a Excel`);
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      toast.error("Error al exportar a Excel");
    }
  };

  if (proveedoresLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <PanelHeader
          title="Historial de Cotizaciones"
          description="Historial automático de cotizaciones vinculadas desde Panel de Operaciones"
          panelLinks={[
            { label: "Volver a Proveedores", to: "/proveedores" },
          ]}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={exportToExcel}
                disabled={filteredRecords.length === 0}
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Exportar Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.history.back()}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver
              </Button>
            </div>
          }
        />

        {/* Info Banner */}
        <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border border-border">
          <Info className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Historial automático</p>
            <p>
              Este historial se genera automáticamente cuando se agregan adjuntos a personal tipo{" "}
              <Badge variant="secondary" className="mx-1">Proveedor</Badge> o{" "}
              <Badge variant="secondary" className="mx-1">Transporte</Badge>{" "}
              en el Panel de Operaciones. No se pueden crear registros manualmente.
            </p>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Search by Proveedor */}
          <div className="relative flex-1 min-w-[250px] max-w-md">
            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <PopoverTrigger asChild>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre, correo o tipo..."
                    value={selectedProveedor ? selectedProveedor.nombre : searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setSelectedProveedorId(null);
                      setSearchOpen(true);
                    }}
                    onFocus={() => setSearchOpen(true)}
                    className="pl-9 h-10"
                  />
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <div className="max-h-[300px] overflow-y-auto">
                  {/* Option to show all */}
                  <div
                    className="px-3 py-2 cursor-pointer hover:bg-muted border-b"
                    onClick={() => {
                      setSelectedProveedorId(null);
                      setSearchTerm("");
                      setSearchOpen(false);
                    }}
                  >
                    <span className="text-sm font-medium">Mostrar todos los proveedores</span>
                  </div>
                  
                  {filteredProveedores.length === 0 ? (
                    <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                      No se encontraron proveedores
                    </div>
                  ) : (
                    filteredProveedores.map((p) => (
                      <div
                        key={p.id}
                        className={`px-3 py-2 cursor-pointer hover:bg-muted ${
                          selectedProveedorId === p.id ? "bg-primary/10" : ""
                        }`}
                        onClick={() => {
                          setSelectedProveedorId(p.id);
                          setSearchTerm("");
                          setSearchOpen(false);
                        }}
                      >
                        <div className="text-sm font-medium">{p.nombre}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.correo && <span>{p.correo} • </span>}
                          {p.categoria} • {p.tipoProductoServicio}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Evento Filter */}
          <Select value={eventoFilter} onValueChange={setEventoFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Evento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los eventos</SelectItem>
              {uniqueEventos.map((evento) => (
                <SelectItem key={evento} value={evento}>{evento}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Categoria Filter */}
          <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              {uniqueCategorias.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Tipo Producto Filter */}
          <Select value={tipoProductoFilter} onValueChange={setTipoProductoFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Tipo producto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los tipos</SelectItem>
              {uniqueTiposProducto.map((tipo) => (
                <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="gap-1"
            >
              <X className="h-4 w-4" />
              Limpiar filtros
            </Button>
          )}
        </div>

        {/* Results Table */}
        <div className="panel-card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[140px]">FECHA</TableHead>
                    <TableHead className="w-[180px]">EVENTO</TableHead>
                    <TableHead className="w-[120px]">CATEGORÍA</TableHead>
                    <TableHead className="w-[180px]">NOMBRE</TableHead>
                    <TableHead className="w-[120px]">TELÉFONO</TableHead>
                    <TableHead className="w-[180px]">CORREO</TableHead>
                    <TableHead className="w-[200px]">TIPO DE PRODUCTO O SERVICIO</TableHead>
                    <TableHead className="w-[250px]">COTIZACIONES</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-32 text-center">
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          <FileText className="h-8 w-8 mb-2" />
                          <p className="text-sm font-medium mb-1">
                            {records.length === 0 
                              ? "No hay cotizaciones registradas"
                              : "No hay registros con los filtros seleccionados"
                            }
                          </p>
                          <p className="text-xs max-w-md">
                            {records.length === 0 
                              ? "Las cotizaciones se crean automáticamente al agregar adjuntos a personal tipo Proveedor o Transporte en Panel de Operaciones."
                              : "Prueba ajustando los filtros para ver más resultados."
                            }
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    groupedRecords.map((group) => (
                    <TableRow key={group.groupKey} className="hover:bg-muted/30">
                      <TableCell className="text-xs">
                        {formatDate(group.latestDate)}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="font-normal">
                          {group.evento_nombre || "Sin evento"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {group.proveedor_categoria || "-"}
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {group.proveedor_nombre}
                      </TableCell>
                      <TableCell className="text-xs">
                        {group.proveedor_telefono || "-"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {group.proveedor_correo || "-"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {group.proveedor_tipo_producto_servicio || "-"}
                      </TableCell>
                      <TableCell>
                        {group.files.length === 1 ? (
                          // Single file: show inline
                          <div className="flex items-center gap-2">
                            <span className="text-xs truncate max-w-[100px]" title={group.files[0].name}>
                              {group.files[0].name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              ({formatFileSize(group.files[0].size)})
                            </span>
                            <div className="flex items-center gap-1 ml-auto">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleViewFile(group.files[0])}
                                title="Ver"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleDownloadFile(group.files[0])}
                                title="Descargar"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteFile(group.files[0].id, group.files[0].name, group)}
                                  title="Eliminar"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ) : (
                          // Multiple files: show dropdown
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" size="sm" className="h-7 gap-1.5">
                                <FileText className="h-3.5 w-3.5" />
                                <span className="text-xs">{group.files.length} archivos</span>
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[320px] p-0" align="start">
                              <div className="p-2 border-b bg-muted/30">
                                <span className="text-xs font-medium">{group.files.length} archivos adjuntos</span>
                              </div>
                              <div className="max-h-[250px] overflow-y-auto">
                                {group.files.map((file) => (
                                  <div key={file.id} className="flex items-center justify-between px-3 py-2 border-b last:border-b-0 hover:bg-muted/30">
                                    <div className="flex-1 min-w-0 mr-2">
                                      <p className="text-xs font-medium truncate" title={file.name}>
                                        {file.name}
                                      </p>
                                      <p className="text-[10px] text-muted-foreground">
                                        {formatFileSize(file.size)} • {formatDate(file.uploadedAt)}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-0.5 flex-shrink-0">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => handleViewFile(file)}
                                        title="Ver"
                                      >
                                        <Eye className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => handleDownloadFile(file)}
                                        title="Descargar"
                                      >
                                        <Download className="h-3 w-3" />
                                      </Button>
                                      {isAdmin && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6 text-destructive hover:text-destructive"
                                          onClick={() => handleDeleteFile(file.id, file.name, group)}
                                          title="Eliminar"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Summary */}
        {groupedRecords.length > 0 && (
          <div className="text-sm text-muted-foreground">
            Mostrando {groupedRecords.length} grupo(s) ({filteredRecords.length} archivo(s)) de {records.length} registro(s)
            {selectedProveedor && ` para ${selectedProveedor.nombre}`}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default HistorialCotizaciones;