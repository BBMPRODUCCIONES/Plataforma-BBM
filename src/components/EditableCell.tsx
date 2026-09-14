import { useState, useRef, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
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
import { AttachmentButton } from "@/components/AttachmentManager";
import { useIsMobile } from "@/hooks/use-mobile";
import { Attachment } from "@/types";

export type CellType = "text" | "number" | "date" | "select" | "file" | "boolean";

interface EditableCellProps {
  value: any;
  type: CellType;
  onChange: (value: any) => void;
  options?: string[]; // For select type
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function EditableCell({
  value,
  type,
  onChange,
  options = [],
  placeholder = "-",
  className,
  disabled = false,
}: EditableCellProps) {
  const isMobile = useIsMobile();
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Convierte el texto crudo del input a numero solo al guardar.
   * Mientras se escribe NUNCA se toca el texto, para poder teclear
   * "12." (decimales) o "-" (negativos) sin que el campo se reescriba solo.
   */
  const parseNumericInput = (raw: unknown): number | null => {
    if (raw === null || raw === undefined) return null;
    const text = String(raw).trim().replace(",", ".");
    if (text === "" || text === "-" || text === "." || text === "-.") return null;
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
  };

  useEffect(() => {
    // Only sync when not actively editing to prevent input from being "erased"
    if (!isEditing) {
      setLocalValue(value);
    }
  }, [value, isEditing]);

  useEffect(() => {
    if (!isEditing || !inputRef.current) return;
    const input = inputRef.current;
    input.focus();
    if (isMobile) {
      // En tactil: cursor al final (seleccionar todo hace que la primera
      // tecla borre el dato existente) y subir la celda sobre el teclado.
      const end = input.value?.length ?? 0;
      try {
        input.setSelectionRange(end, end);
      } catch {
        /* algunos tipos de input no soportan setSelectionRange */
      }
      requestAnimationFrame(() => {
        input.scrollIntoView({ block: "center", inline: "nearest" });
      });
    } else {
      input.select();
    }
  }, [isEditing, isMobile]);

  const handleSave = () => {
    const finalValue = type === "number" ? parseNumericInput(localValue) : localValue;
    onChange(finalValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setLocalValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  // Text/Number cell
  if (type === "text" || type === "number") {
    if (isEditing && !disabled) {
      return (
        <div className="flex items-center gap-1">
          <Input
            ref={inputRef}
            type="text"
            inputMode={type === "number" ? "decimal" : undefined}
            value={localValue ?? ""}
            // Se guarda el texto tal cual se escribe; la conversion a numero
            // ocurre en handleSave.
            onChange={(e) => setLocalValue(e.target.value)}
            onKeyDown={handleKeyDown}
            // En tactil no se autoguarda al perder el foco: un toque accidental
            // durante un montaje sobrescribia el dato. Se confirma con el boton.
            onBlur={isMobile ? undefined : handleSave}
            className={cn(
              "w-full",
              // 16px en movil evita el zoom automatico de iOS al enfocar.
              isMobile ? "h-9 text-base" : "h-7 text-xs"
            )}
          />
          {isMobile && (
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Guardar"
                className="h-9 w-9 text-emerald-600"
                onPointerDown={(e) => e.preventDefault()}
                onClick={handleSave}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Cancelar"
                className="h-9 w-9 text-muted-foreground"
                onPointerDown={(e) => e.preventDefault()}
                onClick={handleCancel}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setIsEditing(true);
        }}
        className={cn(
          "cursor-pointer hover:bg-muted/30 rounded px-2 py-1.5 min-h-[32px] flex items-center truncate w-full border border-transparent hover:border-muted-foreground/20 transition-colors",
          type === "number" && "font-mono",
          !value && "text-muted-foreground italic",
          disabled && "cursor-default hover:border-transparent",
          !className && "text-xs",
          className
        )}
      >
        <span className="truncate">
          {type === "number" && value !== undefined && value !== null
            ? typeof value === "number"
              ? `$ ${value.toLocaleString('es-CO')}`
              : value
            : value ||
              // En movil los textos de ejemplo largos ("Ej: 3-00814") llenaban
              // de ruido cada celda vacia y ensanchaban las columnas.
              (isMobile && placeholder.length > 3 ? "—" : placeholder)}
        </span>
      </div>
    );
  }

  // Date cell
  if (type === "date") {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            onClick={(e) => e.stopPropagation()}
            disabled={disabled}
            className={cn(
              "text-xs cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 min-h-[24px] flex items-center gap-1",
              !value && "text-muted-foreground",
              disabled && "cursor-default",
              className
            )}
          >
            <CalendarIcon className="h-3 w-3" />
            {value ? format(parseISO(value), "dd/MM/yyyy", { locale: es }) : placeholder}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value ? parseISO(value) : undefined}
            onSelect={(date) => {
              if (date) {
                onChange(format(date, "yyyy-MM-dd"));
              }
            }}
            initialFocus
            className="p-3 pointer-events-auto"
            locale={es}
          />
        </PopoverContent>
      </Popover>
    );
  }

  // Select cell
  if (type === "select") {
    return (
      <Select
        value={value || ""}
        onValueChange={(val) => onChange(val)}
        disabled={disabled}
      >
        <SelectTrigger
          className="h-7 text-xs w-full bg-transparent border-0 hover:bg-muted/50"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent 
          className="bg-popover border-border z-[9999]"
          position="popper"
          sideOffset={4}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {options.map((option) => (
            <SelectItem key={option} value={option} className="text-xs">
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // Boolean cell
  if (type === "boolean") {
    return (
      <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={!!value}
          onCheckedChange={(checked) => onChange(checked)}
          disabled={disabled}
        />
      </div>
    );
  }

  // File cell
  if (type === "file") {
    return (
      <AttachmentButton
        attachments={(value as Attachment[]) || []}
        onAttachmentsChange={onChange}
        multiple
      />
    );
  }

  return <span className="text-xs">{value?.toString() || placeholder}</span>;
}
