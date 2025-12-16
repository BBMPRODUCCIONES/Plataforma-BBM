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
import { Search, Download, Eye, Trash2, Loader2, ArrowLeft, FileText } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface CotizacionHistoryRecord {
  id: string;
  proveedor_id: string;
  evento_id: string | null;
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

const HistorialCotizaciones = () => {
  const { proveedores, loading: proveedoresLoading } = useProveedores();
  const { projects } = useProjects();
  const { user } = useAuth();
  const { role, canEdit } = useUserRole();
  const isAdmin = role?.toLowerCase() === "administrador";
  const canEditFiles = canEdit();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProveedorId, setSelectedProveedorId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [records, setRecords] = useState<CotizacionHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  // Filter proveedores for autocomplete
  const filteredProveedores = useMemo(() => {
    if (!searchTerm) return proveedores;
    const normalizedSearch = searchTerm.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return proveedores.filter((p) => {
      const normalizedName = p.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return normalizedName.includes(normalizedSearch);
    });
  }, [proveedores, searchTerm]);

  const selectedProveedor = useMemo(() => {
    return proveedores.find((p) => p.id === selectedProveedorId);
  }, [proveedores, selectedProveedorId]);

  // Fetch history records
  useEffect(() => {
    fetchRecords();
  }, [selectedProveedorId]);

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

  const loadSignedUrls = async (records: CotizacionHistoryRecord[]) => {
    const newSignedUrls: Record<string, string> = {};

    for (const record of records) {
      try {
        const { data, error } = await supabase.functions.invoke("get-signed-url", {
          body: {
            bucket: "supplier-cotizaciones",
            path: record.file_path,
            expiresIn: 3600,
          },
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

  const handleView = async (record: CotizacionHistoryRecord) => {
    let url = signedUrls[record.id];
    if (!url) {
      const { data, error } = await supabase.functions.invoke("get-signed-url", {
        body: {
          bucket: "supplier-cotizaciones",
          path: record.file_path,
          expiresIn: 3600,
        },
      });
      if (!error && data?.signedUrl) {
        url = data.signedUrl;
        setSignedUrls((prev) => ({ ...prev, [record.id]: url }));
      }
    }
    if (url) {
      window.open(url, "_blank");
    } else {
      toast.error("Error al abrir el archivo");
    }
  };

  const handleDownload = async (record: CotizacionHistoryRecord) => {
    let url = signedUrls[record.id];
    if (!url) {
      const { data, error } = await supabase.functions.invoke("get-signed-url", {
        body: {
          bucket: "supplier-cotizaciones",
          path: record.file_path,
          expiresIn: 3600,
        },
      });
      if (!error && data?.signedUrl) {
        url = data.signedUrl;
        setSignedUrls((prev) => ({ ...prev, [record.id]: url }));
      }
    }
    if (url) {
      // Create a temporary link to download
      const a = document.createElement("a");
      a.href = url;
      a.download = record.file_name;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      toast.error("Error al descargar el archivo");
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
          description="Historial completo de cotizaciones por proveedor"
          panelLinks={[
            { label: "Volver a Proveedores", to: "/proveedores" },
          ]}
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.history.back()}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
          }
        />

        {/* Search by Proveedor */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <PopoverTrigger asChild>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar proveedor por nombre..."
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
                    <span className="text-sm font-medium">Mostrar todos los registros</span>
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
                          {p.categoria} • {p.tipoProductoServicio}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {selectedProveedor && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedProveedorId(null);
                setSearchTerm("");
              }}
            >
              Limpiar filtro
            </Button>
          )}
        </div>

        {/* Results Table */}
        <div className="panel-card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <FileText className="h-8 w-8 mb-2" />
              <p className="text-sm">
                {selectedProveedorId
                  ? "Este proveedor no tiene cotizaciones registradas"
                  : "Selecciona un proveedor para ver su historial de cotizaciones"}
              </p>
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
                  {records.map((record) => (
                    <TableRow key={record.id} className="hover:bg-muted/30">
                      <TableCell className="text-xs">
                        {formatDate(record.fecha)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {record.evento_nombre || "Sin evento"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {record.proveedor_categoria || "-"}
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {record.proveedor_nombre}
                      </TableCell>
                      <TableCell className="text-xs">
                        {record.proveedor_telefono || "-"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {record.proveedor_correo || "-"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {record.proveedor_tipo_producto_servicio || "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-xs truncate max-w-[100px]" title={record.file_name}>
                            {record.file_name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({formatFileSize(record.file_size)})
                          </span>
                          <div className="flex items-center gap-1 ml-auto">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleView(record)}
                              title="Ver"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleDownload(record)}
                              title="Descargar"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                            {canEditFiles && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => handleDelete(record)}
                                title="Eliminar"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Summary */}
        {records.length > 0 && (
          <div className="text-sm text-muted-foreground">
            Mostrando {records.length} registro(s)
            {selectedProveedor && ` para ${selectedProveedor.nombre}`}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default HistorialCotizaciones;
