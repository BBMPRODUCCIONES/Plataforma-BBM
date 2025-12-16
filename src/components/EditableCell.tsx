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
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Only sync when not actively editing to prevent input from being "erased"
    if (!isEditing) {
      setLocalValue(value);
    }
  }, [value, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    onChange(localValue);
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
            type={type === "number" ? "number" : "text"}
            value={localValue ?? ""}
            onChange={(e) => setLocalValue(type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            className="h-7 text-xs w-full"
          />
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
          "cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 min-h-[24px] flex items-center truncate",
          type === "number" && "font-mono",
          !value && "text-muted-foreground",
          disabled && "cursor-default",
          !className && "text-xs",
          className
        )}
      >
        <span className="truncate">
          {type === "number" && value !== undefined && value !== null
            ? typeof value === "number"
              ? `$ ${value.toLocaleString('es-CO')}`
              : value
            : value || placeholder}
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
