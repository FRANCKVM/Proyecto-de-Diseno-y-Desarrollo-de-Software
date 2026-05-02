import { cn } from "@/utils/cn";
import type { EstadoSemaforo } from "@/types/common.types";

interface ProgressBarProps {
  /** Valor de avance entre 0 y 100. */
  valor: number;
  variant: EstadoSemaforo;
  className?: string;
}

const VARIANT_CLASS: Record<EstadoSemaforo, string> = {
  normal: "bg-success",
  elevado: "bg-warning",
  critico: "bg-danger",
};

/**
 * Barra horizontal de progreso con color del sistema de semaforo.
 * Usado para mostrar ocupacion de almacenes en drawers de aeropuerto.
 *
 * Acepta valores fuera de rango y los clamp-ea a [0, 100].
 */
const ProgressBar = ({ valor, variant, className }: ProgressBarProps) => {
  const valorClamp = Math.max(0, Math.min(100, valor));

  return (
    <div
      className={cn(
        "w-full h-1.5 bg-field rounded-full overflow-hidden",
        className
      )}
      role="progressbar"
      aria-valuenow={valorClamp}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-full transition-all", VARIANT_CLASS[variant])}
        style={{ width: `${valorClamp}%` }}
      />
    </div>
  );
};

export default ProgressBar;
