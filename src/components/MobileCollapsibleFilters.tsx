import { useState, ReactNode } from "react";
import { ChevronDown, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface MobileCollapsibleFiltersProps {
  children: ReactNode;
  activeFiltersCount?: number;
  label?: string;
}

export function MobileCollapsibleFilters({ 
  children, 
  activeFiltersCount = 0,
  label = "Filtros"
}: MobileCollapsibleFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
      <CollapsibleTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "w-full h-10 justify-between text-xs font-medium touch-manipulation",
            "border-border/50 bg-card/50",
            isOpen && "bg-accent/50 border-primary/30"
          )}
        >
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{label}</span>
            {activeFiltersCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-primary text-primary-foreground rounded-full">
                {activeFiltersCount}
              </span>
            )}
          </div>
          <ChevronDown 
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-180"
            )} 
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mobile-filter-content">
        <div className="pt-2 pb-1 space-y-2 animate-in slide-in-from-top-2 duration-200">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
