import Layout from "@/components/Layout";
import { FileBarChart, Clock, DollarSign, Wrench, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PanelReportes = () => {
  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Panel de Reportes</h1>
          <p className="text-muted-foreground">
            Reportes administrativos y analíticos
          </p>
        </div>

        {/* Empty state card */}
        <Card className="border-dashed">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <FileBarChart className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-lg">Centro de Reportes</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground max-w-md mx-auto">
              Aquí se centralizarán los reportes administrativos de la plataforma.
            </p>
            
            {/* Future reports preview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 max-w-2xl mx-auto">
              <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-muted/30">
                <Clock className="w-6 h-6 text-muted-foreground" />
                <span className="text-xs text-muted-foreground text-center">Reportes de Horas</span>
              </div>
              <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-muted/30">
                <DollarSign className="w-6 h-6 text-muted-foreground" />
                <span className="text-xs text-muted-foreground text-center">Reportes Financieros</span>
              </div>
              <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-muted/30">
                <Wrench className="w-6 h-6 text-muted-foreground" />
                <span className="text-xs text-muted-foreground text-center">Reportes Operativos</span>
              </div>
              <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-muted/30">
                <Users className="w-6 h-6 text-muted-foreground" />
                <span className="text-xs text-muted-foreground text-center">Reportes de Personal</span>
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground/70 pt-2">
              Próximamente disponibles
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default PanelReportes;
