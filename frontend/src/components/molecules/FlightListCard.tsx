import Tag, { type TagVariant } from "@/components/atoms/Tag";
import { getEstadoSemaforo } from "@/utils/airportHelpers";
import { cn } from "@/utils/cn";
import type { EstadoSemaforo, RangoSemaforo } from "@/types/common.types";

interface FlightListCardProps {
  code: string;
  routeText: string;
  metaText: string;
  statusLabel: string;
  statusVariant: TagVariant;
  departureText: string;
  arrivalText: string;
  progressPct: number;
  occupancyPct?: number;
  rangosSemaforo?: RangoSemaforo;
  canCancel?: boolean;
  isCancelling?: boolean;
  notice?: string | null;
  onOpen: () => void;
  onCancel?: () => void;
}

const SEMAPHORE_TEXT_CLASS: Record<EstadoSemaforo, string> = {
  normal: "text-success",
  elevado: "text-warning",
  critico: "text-danger",
};

const SEMAPHORE_BORDER_CLASS: Record<EstadoSemaforo, string> = {
  normal: "border-l-[#16a34a]",
  elevado: "border-l-[#f59e0b]",
  critico: "border-l-[#ef4444]",
};

const formatPercent = (value?: number): string =>
  value === undefined
    ? "Sin dato"
    : `${value.toLocaleString("es-PE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}%`;

const getSemaphoreTextClass = (
  value: number | undefined,
  rangosSemaforo?: RangoSemaforo
): string => {
  if (value === undefined) {
    return "text-black";
  }

  if (value <= 0) {
    return "text-[#4b5563]";
  }

  return SEMAPHORE_TEXT_CLASS[getEstadoSemaforo(value, rangosSemaforo)];
};

const getSemaphoreBorderClass = (
  value: number | undefined,
  rangosSemaforo?: RangoSemaforo
): string => {
  if (value === undefined || value <= 0) {
    return "border-l-[#6b7280]";
  }

  return SEMAPHORE_BORDER_CLASS[getEstadoSemaforo(value, rangosSemaforo)];
};

const FlightListCard = ({
  code,
  routeText,
  metaText,
  statusLabel,
  statusVariant,
  departureText,
  arrivalText,
  progressPct,
  occupancyPct,
  rangosSemaforo,
  canCancel = false,
  isCancelling = false,
  notice,
  onOpen,
  onCancel,
}: FlightListCardProps) => {
  const occupancyClass = getSemaphoreTextClass(occupancyPct, rangosSemaforo);
  const borderClass = getSemaphoreBorderClass(occupancyPct, rangosSemaforo);

  return (
    <article
      className={cn(
        "w-full rounded-card border border-l-4 border-border bg-card px-4 py-3 text-left text-black transition-colors hover:bg-field",
        borderClass
      )}
    >
      <button type="button" onClick={onOpen} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-button text-black truncate">{code}</p>
            <p className="mt-1 text-secondary text-black">{routeText}</p>
            <p className="mt-1 text-secondary text-black">{metaText}</p>
          </div>
          <div className="flex shrink-0 items-start">
            <Tag variant={statusVariant}>{statusLabel}</Tag>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2 text-secondary">
          <div className="inline-flex items-baseline gap-2">
            <span className="text-black">Salida</span>
            <span className="text-button text-black">{departureText}</span>
          </div>
          <div className="inline-flex items-baseline gap-2">
            <span className="text-black">Llegada</span>
            <span className="text-button text-black">{arrivalText}</span>
          </div>
          <div className="inline-flex items-baseline gap-2">
            <span className="text-black">Progreso</span>
            <span className="text-button text-black">{progressPct}%</span>
          </div>
          <div className="inline-flex items-baseline gap-2">
            <span className="text-black">Ocupacion</span>
            <span className={cn("text-button", occupancyClass)}>
              {formatPercent(occupancyPct)}
            </span>
          </div>
        </div>
      </button>

      {notice && (
        <div
          role="alert"
          className="mt-3 rounded-input border border-warning/40 bg-warning-soft px-3 py-2 text-secondary text-warning shadow-card"
        >
          {notice}
        </div>
      )}

      {canCancel && onCancel && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isCancelling}
            className="px-3 py-1.5 rounded-input border border-danger text-secondary text-danger bg-card hover:bg-danger/10 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isCancelling ? "Cancelando..." : "Cancelar"}
          </button>
        </div>
      )}
    </article>
  );
};

export default FlightListCard;
