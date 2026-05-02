import { useNavigate } from "react-router-dom";
import { Download } from "lucide-react";
import PeriodTypeCard from "@/components/molecules/PeriodTypeCard";
import FileUploadZone from "@/components/molecules/FileUploadZone";
import SemaphoreRangeRow from "@/components/molecules/SemaphoreRangeRow";
import AlertBanner from "@/components/molecules/AlertBanner";
import KpiValue from "@/components/atoms/KpiValue";
import { useSimulationConfigStore } from "@/store/simulationConfigStore";
import { useSimulationControlStore } from "@/store/simulationControlStore";
import { ROUTES } from "@/utils/routes";
import type { TipoSimulacion } from "@/types/common.types";
import type { CsvSummary } from "@/store/simulationConfigStore";

// ============================================================================
// DATOS DE CONFIGURACION
// ============================================================================

/**
 * Opciones de tipo de periodo disponibles.
 * Coinciden con los 4 tiles del mockup 02.
 */
const PERIOD_OPTIONS: Array<{
  tipo: TipoSimulacion;
  label: string;
  sublabel: string;
}> = [
  { tipo: "semanal", label: "Semanal", sublabel: "7 dias" },
  { tipo: "diario_5", label: "Diario", sublabel: "5 dias" },
  { tipo: "diario_3", label: "Diario", sublabel: "3 dias" },
  { tipo: "colapso", label: "Colapso", sublabel: "Sin limite" },
];

/**
 * Dias del periodo segun el tipo seleccionado.
 * Para "colapso" devuelve null (sin limite).
 */
const DIAS_POR_TIPO: Record<TipoSimulacion, number | null> = {
  semanal: 7,
  diario_5: 5,
  diario_3: 3,
  colapso: null,
  dia_a_dia: null,
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
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
};

/**
 * Convierte YYYY-MM-DD a dia de semana abreviado en espanol.
 */
const diaSemana = (iso: string): string => {
  const dias = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
  return dias[new Date(iso).getDay()];
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
 * - Derecha (45%): Carga CSV + Resumen de datos + CTA.
 */
const SimulacionConfigPage = () => {
  const navigate = useNavigate();

  const {
    tipoPeriodo,
    fechaInicio,
    horaInicio,
    rangos,
    csvSummary,
    setTipoPeriodo,
    setFechaInicio,
    setHoraInicio,
    setRangos,
    setCsvSummary,
  } = useSimulationConfigStore();

  const { reset: resetControl } = useSimulationControlStore();

  // Fecha fin estimada calculada segun el tipo de periodo.
  const diasPeriodo = DIAS_POR_TIPO[tipoPeriodo];
  const fechaFin =
    diasPeriodo && fechaInicio
      ? formatFechaDisplay(addDays(fechaInicio, diasPeriodo))
      : "Sin limite";

  const handleSimular = () => {
    if (!csvSummary) return;
    // Resetea el reloj de simulacion al arrancar una nueva corrida.
    resetControl();
    // Navega segun el tipo: colapso va a su pantalla dedicada.
    const destino =
      tipoPeriodo === "colapso"
        ? ROUTES.SIMULACION_COLAPSO
        : ROUTES.SIMULACION_EJECUCION;
    navigate(destino);
  };

  const handleCancelar = () => {
    navigate(ROUTES.HOME);
  };

  const puedeSimular = csvSummary !== null;

  return (
    <div className="p-8">
      {/* Encabezado de pagina */}
      <header className="mb-6">
        <h1 className="text-page-title">Configurar simulacion</h1>
        <p className="text-secondary text-text-tertiary mt-1">
          Simulacion &gt; Configuracion
        </p>
      </header>

      {/* Grid de dos columnas */}
      <div className="grid grid-cols-[1fr_auto] gap-5 items-start max-w-[1160px]">
        {/* ================================================================
            COLUMNA IZQUIERDA
            ================================================================ */}
        <div className="space-y-5">
          {/* ---- Tipo de periodo ---- */}
          <section className="bg-card border border-border rounded-card p-6 shadow-card">
            <h2 className="text-section-title mb-1">Tipo de periodo</h2>
            <p className="text-body text-text-secondary mb-4">
              Seleccione el tipo de simulacion a ejecutar.
            </p>
            <div className="grid grid-cols-4 gap-3">
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

          {/* ---- Supuestos ---- */}
          <div className="bg-warning-soft border border-warning/30 rounded-banner px-5 py-3">
            <p className="text-button text-warning mb-1">Supuestos</p>
            <div className="flex gap-3 text-body text-text-secondary flex-wrap">
              <span>1 aeropuerto por ciudad</span>
              <span className="text-border">|</span>
              <span>Maletas estandarizadas</span>
              <span className="text-border">|</span>
              <span>Tiempos de carga incluidos en traslado</span>
            </div>
          </div>
        </div>

        {/* ================================================================
            COLUMNA DERECHA
            ================================================================ */}
        <div className="w-[480px] space-y-5">
          {/* ---- Carga de datos ---- */}
          <section className="bg-card border border-border rounded-card p-6 shadow-card">
            <div className="flex items-start justify-between mb-1">
              <h2 className="text-section-title">Carga de datos</h2>
            </div>
            <p className="text-body text-text-secondary mb-4">
              Cargue los datos operativos desde un archivo plano CSV.
            </p>

            {/* Boton descargar plantilla */}
            <button
              type="button"
              className="w-full flex items-center justify-center gap-2 border border-primary text-primary text-button rounded-input py-2 hover:bg-primary-soft transition-colors mb-4"
            >
              <Download size={14} />
              Descargar plantilla CSV
            </button>

            <FileUploadZone
              summary={csvSummary}
              onFileLoaded={(s: CsvSummary) => setCsvSummary(s)}
            />
          </section>

          {/* ---- Resumen de datos cargados ---- */}
          {csvSummary && (
            <section className="bg-card border border-border rounded-card p-6 shadow-card">
              <h2 className="text-section-title mb-4">
                Resumen de datos cargados
              </h2>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <SummaryKpi
                  label="Aeropuertos"
                  value={csvSummary.aeropuertos}
                />
                <SummaryKpi
                  label="Maletas totales"
                  value={csvSummary.maletasTotales.toLocaleString("es-PE")}
                />
                <SummaryKpi
                  label="Vuelos programados"
                  value={csvSummary.vuelosProgramados}
                />
                <SummaryKpi
                  label="Periodo"
                  value={
                    PERIOD_OPTIONS.find((o) => o.tipo === tipoPeriodo)
                      ? `${PERIOD_OPTIONS.find((o) => o.tipo === tipoPeriodo)!.label} (${PERIOD_OPTIONS.find((o) => o.tipo === tipoPeriodo)!.sublabel})`
                      : "—"
                  }
                />
                <SummaryKpi label="Envios" value={csvSummary.envios} />
                <SummaryKpi
                  label="Inicio"
                  value={`${formatFechaDisplay(fechaInicio)} ${horaInicio}`}
                />
              </div>
            </section>
          )}

          {/* ---- Validacion: CSV requerido ---- */}
          {!csvSummary && (
            <AlertBanner
              severity="informacion"
              mensaje="Cargue un archivo CSV para habilitar la simulacion."
            />
          )}

          {/* ---- CTAs ---- */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleCancelar}
              className="px-6 py-2.5 rounded-input border border-border text-button text-text-primary bg-card hover:bg-field transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSimular}
              disabled={!puedeSimular}
              className="px-6 py-2.5 rounded-input text-button text-text-inverse bg-primary hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Simular
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// SUB-COMPONENTE SummaryKpi
// ============================================================================

interface SummaryKpiProps {
  label: string;
  value: string | number;
}

/**
 * Par label/valor compacto para el resumen de datos cargados.
 */
const SummaryKpi = ({ label, value }: SummaryKpiProps) => (
  <div>
    <p className="text-secondary text-text-secondary">{label}</p>
    <KpiValue
      value={value}
      size="md"
      className="!text-[18px] !leading-[24px]"
    />
  </div>
);

export default SimulacionConfigPage;
