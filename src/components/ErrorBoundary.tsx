import React from "react";

import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type ErrorBoundaryProps = {
  title?: string;
  description?: string;
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error?: unknown;
};

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, info);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <Card>
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
