import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowLeft, ExternalLink } from "lucide-react";

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
  return (
    <div className="flex flex-col gap-4 mb-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          {backLink && (
            <Link to={backLink}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      
      {panelLinks && panelLinks.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Accesos:</span>
          {panelLinks.map((link) => (
            <Link key={link.to} to={link.to}>
              <Button variant="outline" size="sm" className="h-7 text-xs">
                {link.label}
                <ExternalLink className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
