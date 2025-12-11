import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const BANCOS_COLOMBIA = [
  "Bancolombia",
  "Banco de Bogotá",
  "Davivienda",
  "BBVA Colombia",
  "Banco de Occidente",
  "Scotiabank Colpatria",
  "Banco AV Villas",
  "Banco Caja Social",
  "Itaú Colombia",
  "Banco Popular",
  "Banco Finandina",
  "Banco Pichincha",
  "Banco Falabella",
  "Banco Agrario de Colombia",
  "Banco Coopcentral",
  "Banco Serfinanza",
  "Banco GNB Sudameris",
  "Nequi",
  "Dale!",
  "Lulo Bank",
  "DaviPlata",
];

interface BancoAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function BancoAutocomplete({
  value,
  onChange,
  placeholder = "Buscar banco...",
  className,
}: BancoAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Filter banks based on input
  const filteredBancos = BANCOS_COLOMBIA.filter((banco) =>
    banco.toLowerCase().includes(inputValue.toLowerCase())
  );

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // Persist value on blur
        if (inputValue !== value) {
          onChange(inputValue);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [inputValue, value, onChange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setIsOpen(true);
    setHighlightedIndex(-1);
  };

  const handleSelect = (banco: string) => {
    setInputValue(banco);
    onChange(banco);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        setIsOpen(true);
        return;
      }
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredBancos.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredBancos[highlightedIndex]) {
          handleSelect(filteredBancos[highlightedIndex]);
        } else if (inputValue) {
          onChange(inputValue);
          setIsOpen(false);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
      case "Tab":
        if (inputValue !== value) {
          onChange(inputValue);
        }
        setIsOpen(false);
        break;
    }
  };

  const handleFocus = () => {
    setIsOpen(true);
  };

  const handleBlur = () => {
    // Small delay to allow click on dropdown item
    setTimeout(() => {
      if (inputValue !== value) {
        onChange(inputValue);
      }
    }, 150);
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Input
        ref={inputRef}
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        autoComplete="off"
      />
      
      {isOpen && filteredBancos.length > 0 && (
        <div className="absolute z-50 w-full mt-1 max-h-60 overflow-auto rounded-md border border-border bg-popover shadow-lg">
          {filteredBancos.map((banco, index) => (
            <div
              key={banco}
              className={cn(
                "px-3 py-2 cursor-pointer text-sm transition-colors",
                highlightedIndex === index
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-muted"
              )}
              onClick={() => handleSelect(banco)}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              {banco}
            </div>
          ))}
        </div>
      )}

      {isOpen && inputValue && filteredBancos.length === 0 && (
        <div className="absolute z-50 w-full mt-1 rounded-md border border-border bg-popover shadow-lg">
          <div className="px-3 py-2 text-sm text-muted-foreground">
            Sin coincidencias. Se guardará "{inputValue}"
          </div>
        </div>
      )}
    </div>
  );
}
