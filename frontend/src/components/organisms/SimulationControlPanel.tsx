import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Minus, Plus } from "lucide-react";
import { useSimulationControlStore } from "@/store/simulationControlStore";
import IconButton from "@/components/atoms/IconButton";
import { VELOCIDADES_SIMULACION } from "@/utils/constants";
import type { SimulationSpeed } from "@/types/simulation.types";

interface SimulationControlPanelProps {
  /**
   * Variante visual del panel.
   * - "ejecucion": tono claro estandar, opcion activa en azul. Sin demanda.
   * - "colapso":   panel mas oscuro con acentos rojos, incluye demanda.
   */
  variant: "ejecucion" | "colapso";
  /**
   * Total de dias del periodo simulado, para deshabilitar el boton ">|"
   * cuando el dia simulado ya esta en el ultimo.
   */
  totalDays?: number;
}

/**
 * Panel flotante de controles de simulacion, anclado a la esquina
 * inferior izquierda del mapa.
 *
 * Tres grupos de controles:
 * 1. Velocidad (0.5x / 1x / 2x / 4x): afecta el reloj global.
 * 2. Dia simulado (|< / < / N / > / >|): navegacion temporal.
 * 3. Demanda (- / xN / +): solo en variante "colapso".
 *
 * Estandar 61, seccion 4.10: contenedor card 12px de radio,
 * separadores verticales entre grupos, labels en Medium 11px gris.
 */
const SimulationControlPanel = ({
  variant,
  totalDays,
}: SimulationControlPanelProps) => {
  const {
    speed,
    simulatedDay,
    demandFactor,
    setSpeed,
    incrementDay,
    decrementDay,
    resetDay,
    jumpToLastDay,
    incrementDemand,
    decrementDemand,
  } = useSimulationControlStore();

  const isColapso = variant === "colapso";

  // En colapso, el boton activo se pinta en danger; en ejecucion, en primary.
  const activeVariant = isColapso ? "active-danger" : "active-primary";

  // Estilo del panel: en colapso oscuro con bordes rojos para alinear
  // con el mockup 09 del Figma; en ejecucion mas neutro.
  const panelClass = isColapso
    ? "bg-sidebar text-text-inverse border-danger/40"
    : "bg-card text-text-primary border-border";

  // Color del label de seccion ("Velocidad", "Dia simulado", etc.)
  const labelClass = isColapso ? "text-text-tertiary" : "text-text-secondary";

  // Separador vertical entre grupos de controles
  const dividerClass = isColapso ? "bg-sidebar-hover" : "bg-border";

  const isLastDay = totalDays !== undefined && simulatedDay >= totalDays;

  return (
    <div
      className={`absolute bottom-4 left-4 z-[1000] rounded-card border shadow-card px-5 py-3 flex items-center gap-5 ${panelClass}`}
    >
      {/* Grupo 1: Velocidad */}
      <div className="flex flex-col gap-1.5">
        <span className={`text-label-sm ${labelClass}`}>Velocidad</span>
        <div className="flex items-center gap-1">
          {VELOCIDADES_SIMULACION.map((v) => (
            <IconButton
              key={v}
              variant={speed === v ? activeVariant : "default"}
              onClick={() => setSpeed(v as SimulationSpeed)}
            >
              {v}x
            </IconButton>
          ))}
        </div>
      </div>

      <div className={`w-px h-12 ${dividerClass}`} aria-hidden />

      {/* Grupo 2: Dia simulado */}
      <div className="flex flex-col gap-1.5">
        <span className={`text-label-sm ${labelClass}`}>Dia simulado</span>
        <div className="flex items-center gap-1">
          <IconButton onClick={resetDay} aria-label="Primer dia">
            <ChevronsLeft size={14} />
          </IconButton>
          <IconButton
            onClick={decrementDay}
            disabled={simulatedDay <= 1}
            aria-label="Dia anterior"
          >
            <ChevronLeft size={14} />
          </IconButton>
          <IconButton variant={activeVariant}>
            Dia {simulatedDay}
          </IconButton>
          <IconButton
            onClick={incrementDay}
            disabled={isLastDay}
            aria-label="Dia siguiente"
          >
            <ChevronRight size={14} />
          </IconButton>
          <IconButton
            onClick={() => totalDays && jumpToLastDay(totalDays)}
            disabled={isLastDay || totalDays === undefined}
            aria-label="Ultimo dia"
          >
            <ChevronsRight size={14} />
          </IconButton>
        </div>
      </div>

      {/* Grupo 3: Demanda (solo en colapso) */}
      {isColapso && (
        <>
          <div className={`w-px h-12 ${dividerClass}`} aria-hidden />
          <div className="flex flex-col gap-1.5">
            <span className={`text-label-sm ${labelClass}`}>
              Demanda (factor)
            </span>
            <div className="flex items-center gap-1">
              <IconButton
                onClick={decrementDemand}
                disabled={demandFactor <= 1}
                aria-label="Reducir demanda"
              >
                <Minus size={14} />
              </IconButton>
              <IconButton variant={activeVariant}>
                x{demandFactor.toFixed(1)}
              </IconButton>
              <IconButton
                onClick={incrementDemand}
                disabled={demandFactor >= 5}
                aria-label="Aumentar demanda"
              >
                <Plus size={14} />
              </IconButton>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SimulationControlPanel;
