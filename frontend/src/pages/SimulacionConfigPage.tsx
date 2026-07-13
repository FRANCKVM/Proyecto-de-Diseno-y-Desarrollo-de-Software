import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PeriodTypeCard from "@/components/molecules/PeriodTypeCard";
import SemaphoreRangeRow from "@/components/molecules/SemaphoreRangeRow";
import AlertBanner from "@/components/molecules/AlertBanner";
import { useSimulationConfigStore } from "@/store/simulationConfigStore";
import { useSimulationControlStore } from "@/store/simulationControlStore";
import { useLiveSimulationStore } from "@/store/liveSimulationStore";
import {
  getCurrentLiveSimulationState,
  startLiveSimulation,
} from "@/services/simulationService";
import { ROUTES, resolveSimulationModuleRoute } from "@/utils/routes";
import { addDaysToIsoDateUtc, parseUtcDateTime } from "@/utils/utcDateTime";
import type { TipoSimulacion } from "@/types/common.types";

// ============================================================================
// DATOS DE CONFIGURACION
// ============================================================================

/**
 * Opciones de tipo de periodo disponibles.
 * La UI solo permite simulacion semanal de 5 dias o simulacion al colapso.
 */
const PERIOD_OPTIONS: Array<{
  tipo: TipoSimulacion;
  label: string;
  sublabel: string;
}> = [
  { tipo: "semanal", label: "Semanal", sublabel: "5 dias" },
  { tipo: "colapso", label: "Colapso", sublabel: "" },
];

/**
 * Dias del periodo segun el tipo seleccionado.
 * Para "colapso" usa 30 dias para procesar hasta un mes de envios.
 */
const DIAS_POR_TIPO: Record<TipoSimulacion, number | null> = {
  semanal: 5,
  colapso: 30,
};

const K_BY_TIPO: Record<TipoSimulacion, number> = {
  semanal: 15,
  colapso: 200,
};

const inferTipoSimulacion = (k: number | null): TipoSimulacion => {
  if (k === K_BY_TIPO.colapso) {
    return "colapso";
  }

  return "semanal";
};

/**
 * Formatea YYYY-MM-DD a DD/MM/YYYY para el display.
 */
const formatFechaDisplay = (iso: string): string => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

/**
 * Agrega N dias a una fecha ISO y retorna otra fecha ISO.
 */
const addDays = (isoDate: string, days: number): string => {
  return addDaysToIsoDateUtc(isoDate, days) ?? isoDate;
};

/**
 * Convierte YYYY-MM-DD a dia de semana abreviado en espanol.
 */
const diaSemana = (iso: string): string => {
  const dias = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
  return dias[parseUtcDateTime(iso)?.getUTCDay() ?? 0];
};

// ============================================================================
// PAGINA
// ============================================================================

/**
 * Pantalla de configuracion de simulacion.
 * Estandar 61 + mockup 02 del Figma.
 *
 * Distribucion de dos columnas:
 * - Izquierda (55%): Tipo de periodo + Fecha/hora + Rangos + Supuestos.
 * - Derecha (45%): CTA.
 */
const SimulacionConfigPage = () => {
  const navigate = useNavigate();
  const idSimulacion = useLiveSimulationStore((s) => s.idSimulacion);
  const isRunning = useLiveSimulationStore((s) => s.isRunning);
  const tipoSimulacion = useLiveSimulationStore((s) => s.tipoSimulacion);
  const setIdSimulacion = useLiveSimulationStore((s) => s.setIdSimulacion);
  const setTipoSimulacion = useLiveSimulationStore((s) => s.setTipoSimulacion);
  const setEstadoSimulacion = useLiveSimulationStore((s) => s.setEstado);
  const setIsRunning = useLiveSimulationStore((s) => s.setIsRunning);
  const [startError, setStartError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const {
    tipoPeriodo,
    fechaInicio,
    horaInicio,
    rangos,
    kColapso,
    setTipoPeriodo,
    setFechaInicio,
    setHoraInicio,
    setRangos,
    setKColapso,
  } = useSimulationConfigStore();

  const { reset: resetControl } = useSimulationControlStore();

  useEffect(() => {
    if (idSimulacion !== null) {
      return;
    }

    let cancelled = false;

    const hydrateActiveSimulation = async () => {
      const estado = await getCurrentLiveSimulationState();

      if (
        cancelled ||
        !estado ||
        estado.idSimulacion === null ||
        !estado.activa
      ) {
        return;
      }

      const tipoActivo = inferTipoSimulacion(estado.k);
      setEstadoSimulacion(estado);
      setIdSimulacion(estado.idSimulacion);
      setTipoSimulacion(tipoActivo);
      setIsRunning(Boolean(estado.activa));
      navigate(
        resolveSimulationModuleRoute({
          idSimulacion: estado.idSimulacion,
          isRunning: Boolean(estado.activa),
          tipoSimulacion: tipoActivo,
        }),
        { replace: true }
      );
    };

    void hydrateActiveSimulation();

    return () => {
      cancelled = true;
    };
  }, [
    idSimulacion,
    navigate,
    setEstadoSimulacion,
    setIdSimulacion,
    setIsRunning,
    setTipoSimulacion,
  ]);

  useEffect(() => {
    if (idSimulacion === null) {
      return;
    }

    navigate(
      resolveSimulationModuleRoute({
        idSimulacion,
        isRunning,
        tipoSimulacion,
      }),
      { replace: true }
    );
  }, [idSimulacion, isRunning, navigate, tipoSimulacion]);

  // Fecha fin estimada calculada segun el tipo de periodo.
  const diasPeriodo = DIAS_POR_TIPO[tipoPeriodo];
  const fechaFin =
    diasPeriodo && fechaInicio
      ? formatFechaDisplay(addDays(fechaInicio, diasPeriodo))
      : "Sin limite";

  const handleSimular = async () => {
    setStartError(null);
    setIsStarting(true);

    const k = tipoPeriodo === "colapso" ? kColapso : K_BY_TIPO[tipoPeriodo];

    // Resetea el reloj de simulacion al arrancar una nueva corrida.
    resetControl();

    try {
      const estado = await startLiveSimulation({
        k,
        fechaInicio,
        horaInicio,
        duracionDias: DIAS_POR_TIPO[tipoPeriodo],
      });

      if (!estado || estado.idSimulacion === null) {
        setStartError("No se pudo iniciar la simulacion. Intente nuevamente.");
        return;
      }

      setEstadoSimulacion(estado);
      setIdSimulacion(estado.idSimulacion);
      setTipoSimulacion(tipoPeriodo);
      setIsRunning(Boolean(estado.activa));

      // Navega segun el tipo: colapso va a su pantalla dedicada.
      const destino =
        tipoPeriodo === "colapso"
          ? ROUTES.SIMULACION_COLAPSO
          : ROUTES.SIMULACION_EJECUCION;
      navigate(destino);
    } catch (error) {
      setStartError(
        error instanceof Error
          ? error.message
          : "No se pudo iniciar la simulacion."
      );
    } finally {
      setIsStarting(false);
    }
  };

  const handleCancelar = () => {
    navigate(ROUTES.HOME);
  };

  return (
    <div className="p-8">
      {/* Encabezado de pagina */}
      <header className="mb-6">
        <h1 className="text-page-title">Configurar simulacion</h1>
        <p className="text-secondary text-text-tertiary mt-1">
          Simulacion &gt; Configuracion
        </p>
      </header>

      <div className="max-w-[680px] space-y-5">
          {/* ---- Tipo de periodo ---- */}
          <section className="bg-card border border-border rounded-card p-6 shadow-card">
            <h2 className="text-section-title mb-1">Tipo de periodo</h2>
            <p className="text-body text-text-secondary mb-4">
              Seleccione el tipo de simulacion a ejecutar.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {PERIOD_OPTIONS.map((opt) => (
                <PeriodTypeCard
                  key={opt.tipo}
                  label={opt.label}
                  sublabel={opt.sublabel}
                  selected={tipoPeriodo === opt.tipo}
                  onClick={() => setTipoPeriodo(opt.tipo)}
                />
              ))}
            </div>
          </section>

          {/* ---- Fecha y hora de inicio ---- */}
          <section className="bg-card border border-border rounded-card p-6 shadow-card">
            <h2 className="text-section-title mb-1">Fecha y hora de inicio</h2>
            <p className="text-body text-text-secondary mb-4">
              Seleccione la fecha desde la cual iniciar la simulacion.
            </p>
            <div className="flex items-center gap-4">
              {/* Input fecha */}
              <div className="relative">
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  className="bg-field border border-border rounded-input px-3 py-2 text-button text-text-primary focus:outline-none focus:border-primary pr-16"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary text-text-tertiary pointer-events-none">
                  {diaSemana(fechaInicio)}
                </span>
              </div>

              {/* Input hora */}
              <div className="relative">
                <input
                  type="time"
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                  className="bg-field border border-border rounded-input px-3 py-2 text-button text-text-primary focus:outline-none focus:border-primary pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary text-text-tertiary pointer-events-none">
                  hrs
                </span>
              </div>

              {/* Fecha fin estimada */}
              {diasPeriodo && (
                <div className="ml-2">
                  <p className="text-secondary text-text-tertiary leading-tight">
                    Fecha fin estimada:
                  </p>
                  <p className="text-button text-text-primary">{fechaFin}</p>
                </div>
              )}
            </div>
          </section>

          {tipoPeriodo === "colapso" && (
            <section className="bg-card border border-border rounded-card p-6 shadow-card">
              <h2 className="text-section-title mb-1">Factor k</h2>
              <p className="text-body text-text-secondary mb-4">
                Define cuantos bloques base avanza la simulacion por ciclo.
              </p>
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={kColapso}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    if (Number.isFinite(value)) {
                      setKColapso(value);
                    }
                  }}
                  className="bg-field border border-border rounded-input px-3 py-2 text-button text-text-primary focus:outline-none focus:border-primary w-32"
                />
                <div>
                  <p className="text-secondary text-text-tertiary leading-tight">
                    Minutos por bloque:
                  </p>
                  <p className="text-button text-text-primary">
                    {kColapso * 5} min simulados
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* ---- Rangos de semaforo ---- */}
          <section className="bg-card border border-border rounded-card p-6 shadow-card">
            <h2 className="text-section-title mb-1">Rangos de semaforo</h2>
            <p className="text-body text-text-secondary mb-3">
              Umbrales de ocupacion de almacen.
            </p>
            <SemaphoreRangeRow
              estado="normal"
              label="Verde"
              rangeLabel={`< ${rangos.verde}%`}
              value={rangos.verde}
              onChange={(v) => setRangos({ verde: v })}
            />
            <SemaphoreRangeRow
              estado="elevado"
              label="Ambar"
              rangeLabel={`${rangos.verde} - ${rangos.ambar}%`}
              value={rangos.ambar}
              onChange={(v) => setRangos({ ambar: v })}
            />
            <SemaphoreRangeRow
              estado="critico"
              label="Rojo"
              rangeLabel={`> ${rangos.ambar}%`}
              value={rangos.ambar}
              editable={false}
            />
          </section>

          {/* ---- CTAs ---- */}
          {startError && (
            <AlertBanner severity="error" mensaje={startError} />
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleCancelar}
              disabled={isStarting}
              className="px-6 py-2.5 rounded-input border border-border text-button text-text-primary bg-card hover:bg-field transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                void handleSimular();
              }}
              disabled={isStarting}
              className="px-6 py-2.5 rounded-input text-button text-text-inverse bg-primary hover:bg-primary/90 transition-colors"
            >
              {isStarting ? "Iniciando..." : "Simular"}
            </button>
          </div>
      </div>
    </div>
  );
};

export default SimulacionConfigPage;
