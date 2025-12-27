import React from "react";

import { AlertTriangle, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type ErrorBoundaryProps = {
  title?: string;
  description?: string;
  children: React.ReactNode;
  showDetails?: boolean;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error?: unknown;
  showTechnical: boolean;
};

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, showTechnical: false };

  static getDerivedStateFromError(error: unknown): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, info);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined, showTechnical: false });
  };

  private toggleTechnical = () => {
    this.setState((prev) => ({ showTechnical: !prev.showTechnical }));
  };

  private getErrorMessage(): string {
    const { error } = this.state;
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    return "Error desconocido";
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <Card className="border-destructive/40">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-destructive/10 p-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-semibold text-foreground">
                {this.props.title ?? "Ocurrió un error"}
              </p>
              <p className="text-sm text-muted-foreground">
                {this.props.description ??
                  "Intenta recargar esta sección. Si el problema continúa, revisa los datos del reporte."}
              </p>

              {this.props.showDetails && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={this.toggleTechnical}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {this.state.showTechnical ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                    Detalles técnicos
                  </button>
                  {this.state.showTechnical && (
                    <pre className="mt-2 p-2 bg-muted/50 rounded text-xs text-muted-foreground overflow-x-auto max-w-full">
                      {this.getErrorMessage()}
                    </pre>
                  )}
                </div>
              )}

              <div className="pt-3">
                <Button onClick={this.handleReset} variant="outline" className="gap-2">
                  <RotateCcw className="h-4 w-4" />
                  Reintentar
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
}
