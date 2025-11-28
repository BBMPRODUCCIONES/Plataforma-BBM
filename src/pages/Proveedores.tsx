import { useState } from "react";
import Layout from "@/components/Layout";
import { PanelHeader } from "@/components/PanelHeader";
import { MatrixTable } from "@/components/MatrixTable";
import { mockProveedores } from "@/data/mockData";
import { Proveedor } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Plus, Phone, Mail, FileText, Tag } from "lucide-react";

const Proveedores = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("todas");
  const [selectedProveedor, setSelectedProveedor] = useState<Proveedor | null>(null);

  const categories = [...new Set(mockProveedores.map((p) => p.categoria))];

  const filteredProveedores = mockProveedores.filter((p) => {
    const matchesSearch =
      p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.tipoProductoServicio.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "todas" || p.categoria === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const columns = [
    {
      key: "categoria",
      header: "CATEGORÍA",
      width: "120px",
      render: (p: Proveedor) => (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-primary/10 text-primary text-xs font-medium">
          <Tag className="h-3 w-3" />
          {p.categoria}
        </span>
      ),
    },
    {
      key: "nombre",
      header: "NOMBRE",
      width: "180px",
      render: (p: Proveedor) => (
        <span className="font-medium text-sm">{p.nombre}</span>
      ),
    },
    {
      key: "telefono",
      header: "TELÉFONO",
      width: "140px",
      render: (p: Proveedor) => (
        <div className="flex items-center gap-2 text-xs">
          <Phone className="h-3 w-3 text-muted-foreground" />
          {p.telefono}
        </div>
      ),
    },
    {
      key: "correo",
      header: "CORREO",
      width: "200px",
      render: (p: Proveedor) => (
        <div className="flex items-center gap-2 text-xs">
          <Mail className="h-3 w-3 text-muted-foreground" />
          <a href={`mailto:${p.correo}`} className="text-primary hover:underline">
            {p.correo}
          </a>
        </div>
      ),
    },
    {
      key: "tipoProductoServicio",
      header: "TIPO DE PRODUCTO O SERVICIO",
      width: "250px",
      render: (p: Proveedor) => (
        <span className="text-xs">{p.tipoProductoServicio}</span>
      ),
    },
    {
      key: "cotizaciones",
      header: "COTIZACIONES",
      width: "120px",
      render: (p: Proveedor) => (
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
          <FileText className="h-3 w-3 mr-1" />
          {p.cotizacionesAnteriores?.length || 0} archivos
        </Button>
      ),
    },
    {
      key: "notas",
      header: "NOTAS",
      width: "200px",
      render: (p: Proveedor) => (
        <span className="text-xs text-muted-foreground truncate block max-w-[180px]">
          {p.notas || "-"}
        </span>
      ),
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <PanelHeader
          title="Panel de Proveedores"
          description="Gestión de proveedores y cotizaciones"
          panelLinks={[
            { label: "Directivo", to: "/panel-directivo" },
            { label: "General", to: "/panel-general" },
            { label: "Operaciones", to: "/panel-operaciones" },
          ]}
          actions={
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Proveedor
            </Button>
          }
        />

        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-40 h-9">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las categorías</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar proveedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>

        {/* Matrix Table */}
        <div className="panel-card">
          <MatrixTable
            data={filteredProveedores}
            columns={columns}
            onRowClick={(p) => setSelectedProveedor(p)}
          />
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categories.map((cat) => {
            const count = mockProveedores.filter((p) => p.categoria === cat).length;
            return (
              <Card
                key={cat}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => setCategoryFilter(cat)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground">{cat}</CardTitle>
                </CardHeader>
                <CardContent>
                  <span className="text-2xl font-bold">{count}</span>
                  <span className="text-xs text-muted-foreground ml-2">proveedores</span>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Proveedor Detail Dialog */}
        <Dialog open={!!selectedProveedor} onOpenChange={() => setSelectedProveedor(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{selectedProveedor?.nombre}</DialogTitle>
            </DialogHeader>

            {selectedProveedor && (
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-muted-foreground">Categoría</span>
                    <p className="text-sm font-medium">{selectedProveedor.categoria}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Tipo</span>
                    <p className="text-sm">{selectedProveedor.tipoProductoServicio}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{selectedProveedor.telefono}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${selectedProveedor.correo}`} className="text-sm text-primary hover:underline">
                      {selectedProveedor.correo}
                    </a>
                  </div>
                </div>

                {selectedProveedor.notas && (
                  <div>
                    <span className="text-xs text-muted-foreground">Notas</span>
                    <p className="text-sm mt-1">{selectedProveedor.notas}</p>
                  </div>
                )}

                <div>
                  <span className="text-xs text-muted-foreground">Cotizaciones Anteriores</span>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedProveedor.cotizacionesAnteriores?.length || 0} archivos adjuntos
                  </p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Proveedores;
