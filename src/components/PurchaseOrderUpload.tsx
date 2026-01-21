import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Loader2, Check, X, Paperclip, Eye, Download, Trash2, Info } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Attachment, InventarioItem } from "@/types";

const BUCKET_NAME = "project-attachments";

interface ExtractedInventarioItem {
  material: string;
  cantidad: number;
}

interface ExtractedData {
  ingresoBruto: number | null;
  ingresoTotal: number | null;
  moneda: string;
  confianza: string;
  detallesExtraidos: string;
  inventarioItems?: ExtractedInventarioItem[];
}

interface PurchaseOrderUploadProps {
  onDataExtracted: (
    ingresoBruto: number | null, 
    ingresoTotal: number | null,
    inventarioItems?: InventarioItem[]
  ) => void;
  currentIngresoBruto?: number;
  currentIngresoTotal?: number;
  attachments?: Attachment[];
  onAttachmentsChange?: (attachments: Attachment[]) => void;
  projectId?: string;
}

export function PurchaseOrderUpload({ 
  onDataExtracted, 
  currentIngresoBruto, 
  currentIngresoTotal,
  attachments = [],
  onAttachmentsChange,
  projectId = "general",
}: PurchaseOrderUploadProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [editedIngresoBruto, setEditedIngresoBruto] = useState<string>("");
  const [editedIngresoTotal, setEditedIngresoTotal] = useState<string>("");
  const [pendingAttachment, setPendingAttachment] = useState<Attachment | null>(null);
  const [loadingUrls, setLoadingUrls] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calculate totals from all attachments
  const calculateTotals = (atts: Attachment[]) => {
    const totalBruto = atts.reduce((sum, att) => sum + (att.ingresoBruto || 0), 0);
    const totalTotal = atts.reduce((sum, att) => sum + (att.ingresoTotal || 0), 0);
    return { totalBruto, totalTotal };
  };

  const getSignedUrl = async (attachment: Attachment): Promise<string | null> => {
    if (!attachment.filePath || !attachment.bucket) {
      return attachment.url || null;
    }
    try {
      const { data, error } = await supabase.functions.invoke("get-signed-url", {
        body: { bucket: attachment.bucket, path: attachment.filePath, expiresIn: 3600 },
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

  const viewAttachment = async (attachment: Attachment) => {
    setLoadingUrls((prev) => ({ ...prev, [attachment.id]: true }));
    const url = await getSignedUrl(attachment);
    setLoadingUrls((prev) => ({ ...prev, [attachment.id]: false }));
    if (url) {
      window.open(url, "_blank");
    } else {
      toast({
        title: "Error",
        description: "No se pudo obtener el archivo",
        variant: "destructive",
      });
    }
  };

  const downloadAttachment = async (attachment: Attachment) => {
    setLoadingUrls((prev) => ({ ...prev, [attachment.id]: true }));
    const url = await getSignedUrl(attachment);
    setLoadingUrls((prev) => ({ ...prev, [attachment.id]: false }));
    if (url) {
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      toast({
        title: "Error",
        description: "No se pudo descargar el archivo",
        variant: "destructive",
      });
    }
  };

  const deleteAttachment = async (attachment: Attachment) => {
    if (attachment.filePath && attachment.bucket) {
      const { error } = await supabase.storage
        .from(attachment.bucket)
        .remove([attachment.filePath]);
      if (error) {
        console.error("Error deleting file:", error);
      }
    }
    if (onAttachmentsChange) {
      const newAttachments = attachments.filter((a) => a.id !== attachment.id);
      onAttachmentsChange(newAttachments);
      
      // Recalculate totals and update project (no inventory items on delete)
      const { totalBruto, totalTotal } = calculateTotals(newAttachments);
      onDataExtracted(totalBruto > 0 ? totalBruto : null, totalTotal > 0 ? totalTotal : null, undefined);
    }
    toast({
      title: "Archivo eliminado",
      description: attachment.name,
    });
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const readExcelAsText = async (file: File): Promise<string> => {
    const text = await file.text();
    return text;
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    const isAllowed = allowedTypes.includes(file.type) || 
                      file.name.endsWith('.xlsx') || 
                      file.name.endsWith('.xls');

    if (!isAllowed) {
      toast({
        title: "Tipo de archivo no soportado",
        description: "Usa PDF, imagen (JPG, PNG) o Excel (XLS, XLSX)",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Archivo muy grande",
        description: "El archivo no debe exceder 10MB",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      const fileExt = file.name.split(".").pop() || "bin";
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${projectId}/cotizaciones/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file);

      if (uploadError) {
        console.error("Upload error:", uploadError);
        toast({
          title: "Error al subir archivo",
          description: uploadError.message,
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      const newAttachment: Attachment = {
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        type: file.type,
        url: "",
        uploadedAt: new Date().toISOString(),
        filePath: filePath,
        bucket: BUCKET_NAME,
        ingresoBruto: 0,
        ingresoTotal: 0,
      };

      setPendingAttachment(newAttachment);

      let fileContent: string;
      let fileType = file.type;

      if (file.type.includes('excel') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        fileContent = await readExcelAsText(file);
        fileType = 'text/plain';
      } else {
        fileContent = await readFileAsBase64(file);
      }

      logger.debug('Sending file to process:', file.name, fileType);

      const { data, error } = await supabase.functions.invoke('process-purchase-order', {
        body: {
          fileContent,
          fileType,
          fileName: file.name,
        },
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Error al procesar el archivo');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Error al extraer datos');
      }

      const extracted = data.data as ExtractedData;
      setExtractedData(extracted);
      setEditedIngresoBruto(extracted.ingresoBruto?.toString() || "");
      setEditedIngresoTotal(extracted.ingresoTotal?.toString() || "");
      setShowConfirmDialog(true);

      toast({
        title: "Documento procesado",
        description: `Confianza: ${extracted.confianza}`,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.error('Error processing file:', error);
      console.error('Error details:', errorMessage);
      
      if (pendingAttachment && onAttachmentsChange) {
        const newAttachments = [...attachments, pendingAttachment];
        onAttachmentsChange(newAttachments);
        setPendingAttachment(null);
      }
      toast({
        title: "Error al procesar documento",
        description: `${errorMessage}. El archivo se guardó pero no se pudieron extraer los datos.`,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleConfirm = () => {
    const ingresoBruto = editedIngresoBruto ? parseFloat(editedIngresoBruto) : 0;
    const ingresoTotal = editedIngresoTotal ? parseFloat(editedIngresoTotal) : 0;
    
    if (pendingAttachment && onAttachmentsChange) {
      // Store income values in the attachment
      const attachmentWithIncome: Attachment = {
        ...pendingAttachment,
        ingresoBruto,
        ingresoTotal,
      };
      
      const newAttachments = [...attachments, attachmentWithIncome];
      onAttachmentsChange(newAttachments);
      
      // Convert extracted inventory items to InventarioItem format
      let inventarioItems: InventarioItem[] | undefined;
      if (extractedData?.inventarioItems && extractedData.inventarioItems.length > 0) {
        inventarioItems = extractedData.inventarioItems.map((item) => ({
          id: crypto.randomUUID(),
          nombreMaterial: item.material,
          cantidad: item.cantidad,
          unidad: 'unidad',
          recibido: false,
          observaciones: '',
          notasAdicionales: '',
        }));
      }
      
      // Calculate totals from all attachments and update project with inventory
      const { totalBruto, totalTotal } = calculateTotals(newAttachments);
      onDataExtracted(
        totalBruto > 0 ? totalBruto : null, 
        totalTotal > 0 ? totalTotal : null,
        inventarioItems
      );
    }
    
    setShowConfirmDialog(false);
    setExtractedData(null);
    setPendingAttachment(null);
    
    const itemCount = extractedData?.inventarioItems?.length || 0;
    toast({
      title: "Valores actualizados",
      description: itemCount > 0 
        ? `Datos registrados. ${itemCount} ítems agregados al inventario.`
        : "Los datos y el archivo se han registrado correctamente",
    });
  };

  const handleCancel = () => {
    if (pendingAttachment && onAttachmentsChange) {
      const newAttachments = [...attachments, pendingAttachment];
      onAttachmentsChange(newAttachments);
    }
    setShowConfirmDialog(false);
    setExtractedData(null);
    setPendingAttachment(null);
    
    toast({
      title: "Archivo adjuntado",
      description: "El archivo se guardó sin actualizar los valores",
    });
  };

  const getConfianzaColor = (confianza: string) => {
    switch (confianza.toLowerCase()) {
      case 'alta': return 'text-green-500';
      case 'media': return 'text-yellow-500';
      case 'baja': return 'text-red-500';
      default: return 'text-muted-foreground';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', { 
      style: 'currency', 
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Get totals for display
  const { totalBruto, totalTotal } = calculateTotals(attachments);
  const hasMultipleWithValues = attachments.filter(a => (a.ingresoBruto || 0) > 0 || (a.ingresoTotal || 0) > 0).length > 1;

  return (
    <>
      <div className="flex items-center gap-1">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.xls,.xlsx"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isProcessing}
        />
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => {
            if (attachments.length > 0) {
              setShowViewDialog(true);
            } else {
              fileInputRef.current?.click();
            }
          }}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Procesando...
            </>
          ) : attachments.length > 0 ? (
            <>
              <Paperclip className="h-3 w-3 mr-1" />
              {attachments.length}
            </>
          ) : (
            <>
              <Upload className="h-3 w-3 mr-1" />
              Cargar OC
            </>
          )}
        </Button>
        
        {/* Tooltip with breakdown when multiple quotations have values */}
        {hasMultipleWithValues && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <Info className="h-3 w-3 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <div className="text-xs space-y-1">
                  <p className="font-semibold border-b pb-1 mb-1">Desglose por cotización:</p>
                  {attachments.map((att, idx) => (
                    ((att.ingresoBruto || 0) > 0 || (att.ingresoTotal || 0) > 0) && (
                      <div key={att.id} className="flex justify-between gap-4">
                        <span className="truncate max-w-[120px]">#{idx + 1} {att.name}</span>
                        <span className="text-muted-foreground">
                          B: {formatCurrency(att.ingresoBruto || 0)} | T: {formatCurrency(att.ingresoTotal || 0)}
                        </span>
                      </div>
                    )
                  ))}
                  <div className="border-t pt-1 mt-1 font-semibold flex justify-between">
                    <span>Total:</span>
                    <span>B: {formatCurrency(totalBruto)} | T: {formatCurrency(totalTotal)}</span>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* View Attachments Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Paperclip className="h-5 w-5" />
              Cotizaciones ({attachments.length})
            </DialogTitle>
          </DialogHeader>
          
          {/* Totals Summary */}
          {attachments.length > 0 && (totalBruto > 0 || totalTotal > 0) && (
            <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
              <p className="text-sm font-medium mb-2">Resumen del Proyecto:</p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Ingreso Bruto Total:</span>
                  <p className="font-semibold text-lg">{formatCurrency(totalBruto)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Ingreso Total:</span>
                  <p className="font-semibold text-lg text-primary">{formatCurrency(totalTotal)}</p>
                </div>
              </div>
            </div>
          )}
          
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {attachments.map((attachment, idx) => (
              <div
                key={attachment.id}
                className="p-3 bg-muted/50 rounded-lg border"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1 min-w-0 mr-2">
                    <p className="text-sm font-medium truncate">
                      <span className="text-muted-foreground mr-1">#{idx + 1}</span>
                      {attachment.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(attachment.size || 0)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => viewAttachment(attachment)}
                      disabled={loadingUrls[attachment.id]}
                    >
                      {loadingUrls[attachment.id] ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Eye className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => downloadAttachment(attachment)}
                      disabled={loadingUrls[attachment.id]}
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => deleteAttachment(attachment)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                {/* Per-quotation income display */}
                {((attachment.ingresoBruto || 0) > 0 || (attachment.ingresoTotal || 0) > 0) && (
                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t">
                    <div>
                      <span className="text-muted-foreground">Bruto: </span>
                      <span className="font-medium">{formatCurrency(attachment.ingresoBruto || 0)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total: </span>
                      <span className="font-medium text-primary">{formatCurrency(attachment.ingresoTotal || 0)}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
            >
              <Upload className="h-3 w-3 mr-1" />
              Agregar cotización
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowViewDialog(false)}>
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* OCR Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Datos Extraídos - Nueva Cotización
            </DialogTitle>
          </DialogHeader>

          {extractedData && (
            <>
              {/* Scrollable content area */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                <div className="p-3 bg-muted/50 rounded-lg text-sm">
                  <p className="text-muted-foreground">{extractedData.detallesExtraidos}</p>
                  <p className={`mt-1 font-medium ${getConfianzaColor(extractedData.confianza)}`}>
                    Confianza: {extractedData.confianza}
                  </p>
                  {extractedData.moneda && (
                    <p className="text-muted-foreground">Moneda detectada: {extractedData.moneda}</p>
                  )}
                </div>

                {/* Show existing totals if there are other quotations */}
                {attachments.length > 0 && (totalBruto > 0 || totalTotal > 0) && (
                  <div className="p-3 bg-primary/10 rounded-lg text-sm border border-primary/20">
                    <p className="font-medium mb-1">Totales actuales del proyecto:</p>
                    <div className="flex gap-4">
                      <span>Bruto: {formatCurrency(totalBruto)}</span>
                      <span className="text-primary">Total: {formatCurrency(totalTotal)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Los valores de esta cotización se sumarán a los existentes.
                    </p>
                  </div>
                )}

                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ingresoBruto">Ingreso Bruto de esta cotización</Label>
                    <Input
                      id="ingresoBruto"
                      type="number"
                      value={editedIngresoBruto}
                      onChange={(e) => setEditedIngresoBruto(e.target.value)}
                      placeholder="Valor extraído o ingrese manualmente"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ingresoTotal">Ingreso Total de esta cotización</Label>
                    <Input
                      id="ingresoTotal"
                      type="number"
                      value={editedIngresoTotal}
                      onChange={(e) => setEditedIngresoTotal(e.target.value)}
                      placeholder="Valor extraído o ingrese manualmente"
                    />
                  </div>
                </div>

                {/* Preview of new totals */}
                {(editedIngresoBruto || editedIngresoTotal) && (
                  <div className="p-3 bg-green-500/10 rounded-lg text-sm border border-green-500/20">
                    <p className="font-medium mb-1">Nuevos totales del proyecto:</p>
                    <div className="flex gap-4">
                      <span>Bruto: {formatCurrency(totalBruto + (parseFloat(editedIngresoBruto) || 0))}</span>
                      <span className="text-primary">Total: {formatCurrency(totalTotal + (parseFloat(editedIngresoTotal) || 0))}</span>
                    </div>
                  </div>
                )}

                {/* Preview of extracted inventory items */}
                {extractedData.inventarioItems && extractedData.inventarioItems.length > 0 && (
                  <div className="p-3 bg-blue-500/10 rounded-lg text-sm border border-blue-500/20">
                    <p className="font-medium mb-2 flex items-center gap-2">
                      📦 Ítems de inventario detectados ({extractedData.inventarioItems.length}):
                    </p>
                    <div className="max-h-40 overflow-y-auto space-y-1.5 border-l-2 border-blue-500/30 pl-3">
                      {extractedData.inventarioItems.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm py-0.5">
                          <span className="flex-1 mr-3">{item.material}</span>
                          <span className="text-blue-400 font-medium whitespace-nowrap">x{item.cantidad}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Estos ítems se agregarán al inventario del proyecto en Panel Operaciones.
                    </p>
                  </div>
                )}
              </div>

              {/* Fixed footer with action buttons */}
              <div className="flex-shrink-0 flex justify-end gap-2 pt-4 mt-4 border-t border-border">
                <Button variant="outline" onClick={handleCancel}>
                  <X className="h-4 w-4 mr-1" />
                  Solo Adjuntar
                </Button>
                <Button onClick={handleConfirm}>
                  <Check className="h-4 w-4 mr-1" />
                  Confirmar Valores
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
