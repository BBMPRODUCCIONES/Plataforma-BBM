import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Loader2, Check, X, Paperclip, Download, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Attachment } from "@/types";

interface ExtractedData {
  ingresoBruto: number | null;
  ingresoTotal: number | null;
  moneda: string;
  confianza: string;
  detallesExtraidos: string;
}

interface PurchaseOrderUploadProps {
  onDataExtracted: (ingresoBruto: number | null, ingresoTotal: number | null) => void;
  currentIngresoBruto?: number;
  currentIngresoTotal?: number;
  attachments?: Attachment[];
  onAttachmentsChange?: (attachments: Attachment[]) => void;
}

export function PurchaseOrderUpload({ 
  onDataExtracted, 
  currentIngresoBruto, 
  currentIngresoTotal,
  attachments = [],
  onAttachmentsChange,
}: PurchaseOrderUploadProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [editedIngresoBruto, setEditedIngresoBruto] = useState<string>("");
  const [editedIngresoTotal, setEditedIngresoTotal] = useState<string>("");
  const [pendingAttachment, setPendingAttachment] = useState<Attachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    // Validate file type
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

    // Validate file size (max 10MB)
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
      // Create attachment object
      const newAttachment: Attachment = {
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        type: file.type,
        url: URL.createObjectURL(file),
        uploadedAt: new Date().toISOString(),
      };

      // Store the pending attachment
      setPendingAttachment(newAttachment);

      let fileContent: string;
      let fileType = file.type;

      // Read file content
      if (file.type.includes('excel') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        fileContent = await readExcelAsText(file);
        fileType = 'text/plain';
      } else {
        fileContent = await readFileAsBase64(file);
      }

      console.log('Sending file to process:', file.name, fileType);

      // Call edge function
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
      console.error('Error processing file:', error);
      // Still add the attachment even if AI processing fails
      if (pendingAttachment && onAttachmentsChange) {
        onAttachmentsChange([...attachments, pendingAttachment]);
        setPendingAttachment(null);
      }
      toast({
        title: "Archivo adjuntado",
        description: "El archivo se guardó pero no se pudieron extraer los datos automáticamente",
        variant: "default",
      });
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleConfirm = () => {
    const ingresoBruto = editedIngresoBruto ? parseFloat(editedIngresoBruto) : null;
    const ingresoTotal = editedIngresoTotal ? parseFloat(editedIngresoTotal) : null;
    
    console.log('handleConfirm called with:', { ingresoBruto, ingresoTotal });
    
    // Update the values
    onDataExtracted(ingresoBruto, ingresoTotal);
    
    // Add the attachment
    if (pendingAttachment && onAttachmentsChange) {
      onAttachmentsChange([...attachments, pendingAttachment]);
    }
    
    setShowConfirmDialog(false);
    setExtractedData(null);
    setPendingAttachment(null);
    
    toast({
      title: "Valores actualizados",
      description: "Los datos y el archivo se han registrado correctamente",
    });
  };

  const handleCancel = () => {
    // Still add the attachment even if user cancels the values
    if (pendingAttachment && onAttachmentsChange) {
      onAttachmentsChange([...attachments, pendingAttachment]);
    }
    setShowConfirmDialog(false);
    setExtractedData(null);
    setPendingAttachment(null);
    
    toast({
      title: "Archivo adjuntado",
      description: "El archivo se guardó sin actualizar los valores",
    });
  };

  const removeAttachment = (attachmentId: string) => {
    if (onAttachmentsChange) {
      onAttachmentsChange(attachments.filter(a => a.id !== attachmentId));
    }
  };

  const getConfianzaColor = (confianza: string) => {
    switch (confianza.toLowerCase()) {
      case 'alta': return 'text-green-500';
      case 'media': return 'text-yellow-500';
      case 'baja': return 'text-red-500';
      default: return 'text-muted-foreground';
    }
  };

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
          onClick={() => fileInputRef.current?.click()}
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
      </div>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Datos Extraídos
            </DialogTitle>
          </DialogHeader>

          {extractedData && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg text-sm">
                <p className="text-muted-foreground">{extractedData.detallesExtraidos}</p>
                <p className={`mt-1 font-medium ${getConfianzaColor(extractedData.confianza)}`}>
                  Confianza: {extractedData.confianza}
                </p>
                {extractedData.moneda && (
                  <p className="text-muted-foreground">Moneda detectada: {extractedData.moneda}</p>
                )}
              </div>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ingresoBruto">Ingreso Bruto (sin impuestos)</Label>
                  <Input
                    id="ingresoBruto"
                    type="number"
                    value={editedIngresoBruto}
                    onChange={(e) => setEditedIngresoBruto(e.target.value)}
                    placeholder="Valor extraído o ingrese manualmente"
                  />
                  {currentIngresoBruto && (
                    <p className="text-xs text-muted-foreground">
                      Valor actual: ${currentIngresoBruto.toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ingresoTotal">Ingreso Total (con impuestos)</Label>
                  <Input
                    id="ingresoTotal"
                    type="number"
                    value={editedIngresoTotal}
                    onChange={(e) => setEditedIngresoTotal(e.target.value)}
                    placeholder="Valor extraído o ingrese manualmente"
                  />
                  {currentIngresoTotal && (
                    <p className="text-xs text-muted-foreground">
                      Valor actual: ${currentIngresoTotal.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleCancel}>
                  <X className="h-4 w-4 mr-1" />
                  Solo Adjuntar
                </Button>
                <Button onClick={handleConfirm}>
                  <Check className="h-4 w-4 mr-1" />
                  Confirmar Valores
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Attachments list popover could be added here if needed */}
    </>
  );
}
