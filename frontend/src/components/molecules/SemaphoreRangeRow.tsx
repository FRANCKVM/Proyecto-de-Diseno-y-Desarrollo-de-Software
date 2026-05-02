import type { EstadoSemaforo } from "@/types/common.types";
import { ESTADO_COLOR_HEX } from "@/utils/airportHelpers";

interface SemaphoreRangeRowProps {
  estado: EstadoSemaforo;
  label: string;
  rangeLabel: string;
  /** Valor del umbral editable (el limite superior o inferior segun la fila). */
  value: number;
  onChange?: (value: number) => void;
  /** Si false, el campo es solo lectura (ej: fila "Rojo" cuyos limites derivan de Ambar). */
  editable?: boolean;
}

/**
 * Fila de configuracion de rango del sistema de semaforo.
 *
 * Estandar 61, seccion 4.3 + mockup 02:
 * - Dot de color semantico a la izquierda.
 * - Label del nivel y rango descriptivo en el centro.
 * - Input numerico compacto con el valor del umbral a la derecha.
 */
const SemaphoreRangeRow = ({
  estado,
  label,
  rangeLabel,
  value,
  onChange,
  editable = true,
}: SemaphoreRangeRowProps) => {
  const color = ESTADO_COLOR_HEX[estado];

  return (
    <div className="flex items-center gap-4 py-2">
      {/* Dot */}
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      {/* Labels */}
      <span className="text-button text-text-primary w-14">{label}</span>
      <span className="text-body text-text-secondary flex-1">{rangeLabel}</span>
      {/* Input umbral */}
      <input
        type="number"
        min={0}
        max={100}
        value={value}
        readOnly={!editable}
        onChange={(e) => onChange?.(Number(e.target.value))}
        className="w-14 text-center text-button text-text-primary bg-field border border-border rounded-input px-2 py-1 focus:outline-none focus:border-primary disabled:opacity-60"
        aria-label={`Umbral ${label}`}
      />
    </div>
  );
};

export default SemaphoreRangeRow;
