import { cn } from "@/utils/cn";
import StatusDot, { type StatusDotVariant } from "@/components/atoms/StatusDot";
import KpiValue, { type KpiValueVariant } from "@/components/atoms/KpiValue";

interface KpiCardProps {
  /** Variante del dot indicador junto al label. */
  dotVariant: StatusDotVariant;
  label: string;
  value: string | number;
  /** Texto pequeno bajo el valor (ej: "3 continentes", "6 rutas inter"). */
  subtitulo?: string;
  /** Variante de color del valor numerico. */
  valueVariant?: KpiValueVariant;
  className?: string;
}

/**
 * Tarjeta de indicador clave (KPI).
 * Estandar 61, seccion 4.9: indicador circular + label Medium 12px +
 * valor Bold 26px + subtitulo Regular 11px gris.
 */
const KpiCard = ({
  dotVariant,
  label,
  value,
  subtitulo,
  valueVariant = "default",
  className,
}: KpiCardProps) => (
  <div
    className={cn(
      "bg-card border border-border rounded-card p-5 shadow-card",
      className
    )}
  >
    <div className="flex items-center gap-2 mb-2">
      <StatusDot variant={dotVariant} size="sm" />
      <span className="text-label text-text-secondary">{label}</span>
    </div>
    <KpiValue value={value} variant={valueVariant} />
    {subtitulo && (
      <p className="text-secondary text-text-tertiary mt-1">{subtitulo}</p>
    )}
  </div>
);

export default KpiCard;
