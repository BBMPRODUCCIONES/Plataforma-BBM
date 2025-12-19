import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface PanelLink {
  label: string;
  to: string;
}

interface PanelHeaderProps {
  title: string;
  description?: string;
  backLink?: string;
  panelLinks?: PanelLink[];
  actions?: ReactNode;
}

export function PanelHeader({ title, description, backLink, panelLinks, actions }: PanelHeaderProps) {
  const isMobile = useIsMobile();
  
  return (
    <div className={`flex flex-col animate-fade-in ${isMobile ? 'gap-2 mb-2' : 'gap-4 mb-6'}`}>
      {/* Title and Actions Row */}
      <div className={`flex items-start justify-between ${isMobile ? 'gap-2' : ''}`}>
        <div className="flex items-center gap-2 min-w-0">
          {backLink && (
            <Link to={backLink}>
              <Button variant="ghost" size="icon" className={isMobile ? "h-7 w-7" : "h-8 w-8"}>
                <ArrowLeft className={isMobile ? "h-3.5 w-3.5" : "h-4 w-4"} />
              </Button>
            </Link>
          )}
          <div className="min-w-0">
            <h1 className={`font-bold tracking-tight truncate ${isMobile ? 'text-base' : 'text-2xl'}`}>{title}</h1>
            {description && !isMobile && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className={`flex items-center shrink-0 ${isMobile ? 'gap-1.5' : 'gap-2'}`}>
            {actions}
          </div>
        )}
      </div>
      
      {/* Panel Links - Styled as tabs on mobile */}
      {panelLinks && panelLinks.length > 0 && (
        <div className={`flex items-center overflow-x-auto scrollbar-thin ${isMobile ? 'gap-1.5 py-1' : 'gap-2'}`}>
          {!isMobile && <span className="text-xs text-muted-foreground shrink-0">Accesos:</span>}
          {panelLinks.map((link) => (
            <Link key={link.to} to={link.to}>
              <Button 
                variant="outline" 
                size="sm" 
                className={`shrink-0 ${
                  isMobile 
                    ? 'h-8 text-[11px] px-3 bg-muted/50 border-border/60 font-medium' 
                    : 'h-7 text-xs'
                }`}
              >
                {link.label}
                <ExternalLink className={`ml-1 ${isMobile ? 'h-2.5 w-2.5' : 'h-3 w-3'}`} />
              </Button>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
