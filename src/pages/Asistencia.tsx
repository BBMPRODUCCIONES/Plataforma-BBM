import { useState } from "react";
import Layout from "@/components/Layout";
import { PanelHeader } from "@/components/PanelHeader";
import { MarcarAsistencia } from "@/components/MarcarAsistencia";
import { ReporteHoras } from "@/components/ReporteHoras";
import { useUserRole } from "@/hooks/useUserRole";

/**
 * Llegada y salida: cada usuario marca con foto, hora y ubicacion, y ve sus
 * horas. El administrador ve ademas las horas de todo el equipo.
 */
export default function Asistencia() {
  const { role } = useUserRole();
  const esAdmin = role?.toLowerCase() === "administrador";
  const [recargar, setRecargar] = useState(0);
  return (
    <Layout>
      <div className="mx-auto max-w-4xl space-y-4 p-1">
        <PanelHeader title="Llegada y salida" description="Foto de llegada y de salida con hora y ubicación" />
        <MarcarAsistencia onMarcado={() => setRecargar((n) => n + 1)} />
        <ReporteHoras titulo={esAdmin ? "Horas trabajadas del equipo" : "Mis horas"} recargar={recargar} />
      </div>
    </Layout>
  );
}
