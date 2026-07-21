import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import KpiCard from "@/components/molecules/KpiCard";
import { listSimulationHistory } from "@/services/simulationService";
import { useLiveSimulationStore } from "@/store/liveSimulationStore";
import { ROUTES } from "@/utils/routes";
import { formatUtcDateTimeWithYear } from "@/utils/utcDateTime";
import type { HistorialSimulacion } from "@/types/simulationResult.types";

const formatDateTime = (value: string | null) => {
  if (!value) {
    return "En curso";
  }

  return formatUtcDateTimeWithYear(value, value);
};

const getStatusClasses = (activa: boolean) =>
  activa
    ? "bg-warning-soft text-warning"
    : "bg-success-soft text-success";

const DashboardPage = () => {
  const navigate = useNavigate();
  const [simulaciones, setSimulaciones] = useState<HistorialSimulacion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isRunning = useLiveSimulationStore((s) => s.isRunning);
  const runningSimulationId = useLiveSimulationStore((s) => s.idSimulacion);

  const hasRunningSimulation = isRunning && runningSimulationId !== null;

  useEffect(() => {
    let cancelled = false;

    const loadHistory = async () => {
      try {
        const data = await listSimulationHistory();

        if (cancelled) {
          return;
        }

        setSimulaciones(data);
        setError(null);
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudo cargar el historial de simulaciones."
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, []);

  const resumen = useMemo(() => {
    const total = simulaciones.length;
    const activas = hasRunningSimulation
      ? simulaciones.filter(
          (simulacion) => simulacion.id === runningSimulationId
        ).length
      : 0;
    const periodos = simulaciones.filter(
      (simulacion) => simulacion.tipo === "semanal"
    ).length;
    const colapso = simulaciones.filter(
      (simulacion) => simulacion.tipo === "colapso"
    ).length;

    return {
      total,
      activas,
      finalizadas: total - activas,
      periodos,
      colapso,
    };
  }, [hasRunningSimulation, runningSimulationId, simulaciones]);

  return (
    <div className="p-8 max-w-ref-screen">
      <header className="mb-8">
        <h1 className="text-page-title">Dashboard de simulaciones</h1>
        <p className="text-body text-text-secondary mt-1">
          Consulta todas las simulaciones ejecutadas y entra directo a sus
          resultados.
        </p>
      </header>

      <section className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard
          dotVariant="primary"
          label="Simulaciones"
          value={resumen.total}
        />
        <KpiCard
          dotVariant="normal"
          label="Activas"
          value={resumen.activas}
        />
        <KpiCard
          dotVariant="primary"
          label="Simulaciones de 5 dias"
          value={resumen.periodos}
        />
        <KpiCard
          dotVariant="elevado"
          label="Simulaciones de colapso"
          value={resumen.colapso}
        />
      </section>

      <section className="bg-card border border-border rounded-card p-6 shadow-card">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="text-section-title mb-1">Historial de simulaciones</h2>
            <p className="text-body text-text-secondary">
              Selecciona un historial para revisar sus resultados y metricas
              principales.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate(ROUTES.SIMULACION_CONFIGURAR)}
            className="bg-primary hover:bg-primary/90 text-text-inverse text-button px-5 py-2.5 rounded-input transition-colors"
          >
            Nueva simulacion
          </button>
        </div>

        {isLoading ? (
          <p className="text-body text-text-secondary">
            Cargando historial de simulaciones...
          </p>
        ) : error ? (
          <div className="rounded-input border border-danger/30 bg-danger-soft px-4 py-3">
            <p className="text-body text-danger">{error}</p>
          </div>
        ) : simulaciones.length === 0 ? (
          <div className="rounded-input border border-border-subtle bg-field px-4 py-3">
            <p className="text-body text-text-secondary">
              Aun no se han registrado simulaciones.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {simulaciones.map((simulacion) => {
              const resultRoute =
                simulacion.tipo === "colapso"
                  ? ROUTES.SIMULACION_RESULTADOS_COLAPSO(simulacion.id)
                  : ROUTES.SIMULACION_RESULTADOS(simulacion.id);
              const isActiveNow =
                hasRunningSimulation && simulacion.id === runningSimulationId;

              return (
                <article
                  key={simulacion.id}
                  className="border border-border rounded-card p-5 bg-field/30"
                >
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-secondary font-medium ${getStatusClasses(
                            isActiveNow
                          )}`}
                        >
                          {isActiveNow ? "Activa" : "Finalizada"}
                        </span>
                        <span className="text-secondary text-text-secondary uppercase tracking-wide">
                          {simulacion.tipo === "colapso"
                            ? "Simulacion al colapso"
                            : "Simulacion de periodo 5 dias"}
                        </span>
                      </div>
                      <h3 className="text-body font-semibold text-text-primary">
                        Corrida #{simulacion.id} - {simulacion.rango}
                      </h3>
                      <p className="text-secondary text-text-secondary mt-1">
                        Inicio: {formatDateTime(simulacion.fechaInicio)} | Fin:{" "}
                        {formatDateTime(simulacion.fechaFin)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate(resultRoute)}
                      className="border border-border bg-card hover:bg-field text-text-primary text-button px-4 py-2 rounded-input transition-colors"
                    >
                      Ver resultados
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-3 mb-4">
                    <div className="rounded-input bg-card px-4 py-3 border border-border-subtle">
                      <p className="text-secondary text-text-secondary">
                        Total maletas
                      </p>
                      <p className="text-body font-semibold text-text-primary">
                        {simulacion.totalMaletas.toLocaleString("es-PE")}
                      </p>
                    </div>
                    <div className="rounded-input bg-card px-4 py-3 border border-border-subtle">
                      <p className="text-secondary text-text-secondary">
                        Vuelos ejecutados
                      </p>
                      <p className="text-body font-semibold text-text-primary">
                        {simulacion.vuelosEjecutados}
                      </p>
                    </div>
                    <div className="rounded-input bg-card px-4 py-3 border border-border-subtle">
                      <p className="text-secondary text-text-secondary">
                        Cancelaciones
                      </p>
                      <p className="text-body font-semibold text-text-primary">
                        {simulacion.cancelaciones}
                      </p>
                    </div>
                    <div className="rounded-input bg-card px-4 py-3 border border-border-subtle">
                      <p className="text-secondary text-text-secondary">
                        {simulacion.tipo === "colapso"
                          ? "Resultado clave"
                          : "Cumplimiento"}
                      </p>
                      <p className="text-body font-semibold text-text-primary">
                        {simulacion.tipo === "colapso"
                          ? `Dia ${simulacion.diasHastaColapso ?? "-"}`
                          : `${simulacion.cumplimiento ?? 0}%`}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 items-start">
                    <div className="rounded-input bg-card px-4 py-3 border border-border-subtle">
                      <p className="text-secondary text-text-secondary mb-1">
                        Resumen
                      </p>
                      <p className="text-body text-text-primary">
                        {simulacion.mensajeResumen}
                      </p>
                    </div>

                    <div className="rounded-input bg-card px-4 py-3 border border-border-subtle">
                      <p className="text-secondary text-text-secondary mb-1">
                        Indicadores extra
                      </p>
                      {simulacion.tipo === "colapso" ? (
                        <p className="text-body text-text-primary">
                          Plazos incumplidos:{" "}
                          <span className="font-semibold">
                            {simulacion.plazosIncumplidos ?? 0}%
                          </span>{" "}
                          | Almacenes saturados:{" "}
                          <span className="font-semibold">
                            {simulacion.almacenesSaturados ?? 0}
                          </span>
                        </p>
                      ) : (
                        <p className="text-body text-text-primary">
                          Replanificaciones:{" "}
                          <span className="font-semibold">
                            {simulacion.replanificaciones}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default DashboardPage;
