import { Minus, Plus } from "lucide-react";
import { useSimulationControlStore } from "@/store/simulationControlStore";
import IconButton from "@/components/atoms/IconButton";

interface SimulationControlPanelProps {
  variant: "ejecucion" | "colapso";
}

/**
 * Panel flotante de controles de simulacion, anclado a la esquina
 * inferior izquierda del mapa.
 *
 * Panel flotante de controles.
 * En ejecucion ya no se muestran controles inferiores.
 * En colapso solo se mantiene el ajuste de demanda.
 *
 * Estandar 61, seccion 4.10: contenedor card 12px de radio,
 * separadores verticales entre grupos, labels en Medium 11px gris.
 */
const SimulationControlPanel = ({
  variant,
}: SimulationControlPanelProps) => {
  const { demandFactor, incrementDemand, decrementDemand } =
    useSimulationControlStore();

  const isColapso = variant === "colapso";

  if (!isColapso) {
    return null;
  }

  const activeVariant = isColapso ? "active-danger" : "active-primary";

  // Estilo del panel: en colapso oscuro con bordes rojos para alinear
  // con el mockup 09 del Figma; en ejecucion mas neutro.
  const panelClass = isColapso
    ? "bg-sidebar text-text-inverse border-danger/40"
    : "bg-card text-text-primary border-border";

  // Color del label de seccion ("Velocidad", "Dia simulado", etc.)
  const labelClass = isColapso ? "text-text-tertiary" : "text-text-secondary";

  return (
    <div
      className={`absolute bottom-4 left-4 z-[1000] rounded-card border shadow-card px-5 py-3 flex items-center gap-5 ${panelClass}`}
    >
      <div className="flex flex-col gap-1.5">
        <span className={`text-label-sm ${labelClass}`}>Demanda (factor)</span>
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
    </div>
  );
};

export default SimulationControlPanel;
