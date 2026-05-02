import { cn } from "@/utils/cn";

interface PeriodTypeCardProps {
  label: string;
  sublabel: string;
  selected: boolean;
  onClick: () => void;
}

/**
 * Tarjeta de seleccion de tipo de periodo de simulacion.
 *
 * Estandar 61, seccion 4.9: borde azul + dot indicador en la esquina
 * superior derecha cuando esta seleccionada. Inactiva con borde neutro.
 */
const PeriodTypeCard = ({
  label,
  sublabel,
  selected,
  onClick,
}: PeriodTypeCardProps) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "relative flex flex-col items-start px-4 py-3 rounded-card border-2 transition-colors text-left w-full",
      selected
        ? "border-primary bg-primary-soft"
        : "border-border bg-card hover:border-primary/40 hover:bg-field"
    )}
  >
    {/* Dot indicador de seleccion */}
    {selected && (
      <span
        className="absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full bg-primary"
        aria-hidden
      />
    )}
    <span
      className={cn(
        "text-button",
        selected ? "text-primary" : "text-text-primary"
      )}
    >
      {label}
    </span>
    <span className="text-secondary text-text-secondary mt-0.5">
      {sublabel}
    </span>
  </button>
);

export default PeriodTypeCard;
