import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AlertBanner from "@/components/molecules/AlertBanner";
import KpiCard from "@/components/molecules/KpiCard";
import InfoRow from "@/components/molecules/InfoRow";
import ResultsTable from "@/components/organisms/ResultsTable";
import { getPeriodResult } from "@/services/simulationService";
import { useLiveSimulationStore } from "@/store/liveSimulationStore";
import { ROUTES } from "@/utils/routes";
import type { ResultadoPeriodo } from "@/types/simulationResult.types";

const formatDuration = (minutes: number) => {
  const days = Math.floor(minutes / (24 * 60));
  const minutesAfterDays = minutes % (24 * 60);
  const hours = Math.floor(minutesAfterDays / 60);
  const remainingMinutes = minutesAfterDays % 60;
  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days} d`);
  }

  if (hours > 0) {
    parts.push(`${hours} h`);
  }

  if (remainingMinutes > 0) {
    parts.push(`${remainingMinutes} min`);
  }

  if (parts.length > 0) {
    return parts.join(" ");
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  return "0 min";
};

/**
 * Pantalla de resultados de simulacion de periodo.
 * Estandar 61 + mockup 07.
 *
 * Layout de dos columnas:
 * - Izquierda (60%): tabla "Desempeno por aeropuerto".
 * - Derecha (40%):   "Resumen operativo" + "Conclusion" + CTAs.
 * - Banner inferior: "Atencion" si lo hay.
 */
const ResultadosPeriodoPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [resultado, setResultado] = useState<ResultadoPeriodo | null>(null);
  const resetLiveSimulation = useLiveSimulationStore((s) => s.reset);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getPeriodResult(id).then((r) => !cancelled && setResultado(r));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!resultado) {
    return (
      <div className="p-8">
        <p className="text-body text-text-tertiary">
          Cargando resultados de simulacion...
        </p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-ref-screen">
      {/* Encabezado */}
      <header className="mb-6">
        <h1 className="text-page-title">Resultados de simulacion</h1>
        <p className="text-secondary text-text-tertiary mt-1">
          Simulacion &gt; Resultados &gt; {resultado.rango}
        </p>
      </header>

      {/* Banner resultado */}
      <AlertBanner
        severity={resultado.cumplimiento === 100 ? "exito" : "advertencia"}
        mensaje={
          resultado.cumplimiento === 100
            ? "Simulacion completada - Todas las maletas entregadas dentro del plazo comprometido"
            : `Simulacion completada - ${resultado.cumplimiento}% de cumplimiento de plazos`
        }
        className="mb-6"
      />

      {/* KPIs */}
      <section className="grid grid-cols-5 gap-4 mb-6">
        <KpiCard
          dotVariant="primary"
          label="Total maletas"
          value={resultado.totalMaletas.toLocaleString("es-PE")}
        />
        <KpiCard
          dotVariant="normal"
          label="Entregadas a tiempo"
          value={`${resultado.cumplimiento}%`}
          valueVariant="success"
        />
        <KpiCard
          dotVariant="primary"
          label="Vuelos ejecutados"
          value={resultado.vuelosEjecutados}
        />
        <KpiCard
          dotVariant={resultado.cancelaciones > 0 ? "elevado" : "normal"}
          label="Cancelaciones"
          value={resultado.cancelaciones}
          valueVariant={resultado.cancelaciones > 0 ? "warning" : "success"}
        />
        <KpiCard
          dotVariant="primary"
          label="Replanificaciones"
          value={resultado.replanificaciones}
          valueVariant="primary"
        />
      </section>

      {/* Dos columnas */}
      <div className="grid grid-cols-[1.5fr_1fr] gap-5 mb-6">
        {/* Tabla */}
        <ResultsTable rows={resultado.desempenoPorAeropuerto} />

        {/* Resumen + Conclusion + CTAs */}
        <div className="space-y-5">
          {/* Resumen operativo */}
          <section className="bg-card border border-border rounded-card p-6 shadow-card">
            <h2 className="text-section-title mb-3">Resumen operativo</h2>
            <InfoRow
              label="Maletas intra"
              value={resultado.resumen.maletasIntra.toLocaleString("es-PE")}
            />
            <InfoRow
              label="Maletas inter"
              value={resultado.resumen.maletasInter.toLocaleString("es-PE")}
            />
            <InfoRow
              label="Tiempo prom. intra"
              value={`${resultado.resumen.tiempoPromedioIntra} dias`}
            />
            <InfoRow
              label="Tiempo prom. inter"
              value={`${resultado.resumen.tiempoPromedioInter} dias`}
            />
            <InfoRow
              label="Duracion simulacion"
              value={formatDuration(resultado.resumen.duracionMinutos)}
            />
          </section>

          {/* Conclusion */}
          <section className="bg-card border border-border rounded-card p-6 shadow-card">
            <h2 className="text-section-title mb-2">Conclusion</h2>
            <p className="text-body text-text-secondary">
              {resultado.conclusion}
            </p>
          </section>

          {/* CTAs */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="px-6 py-2.5 rounded-input border border-border text-button text-text-primary bg-card hover:bg-field transition-colors"
            >
              Exportar reporte
            </button>
            <button
              type="button"
              onClick={() => {
                resetLiveSimulation();
                navigate(ROUTES.SIMULACION_CONFIGURAR);
              }}
              className="px-6 py-2.5 rounded-input text-button text-text-inverse bg-primary hover:bg-primary/90 transition-colors"
            >
              Nueva simulacion
            </button>
          </div>
        </div>
      </div>

      {/* Banner de atencion */}
      {resultado.atencion && (
        <AlertBanner
          severity="advertencia"
          mensaje={`Atencion: ${resultado.atencion}`}
        />
      )}
    </div>
  );
};

export default ResultadosPeriodoPage;
