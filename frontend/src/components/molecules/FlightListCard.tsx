import { Eye, X } from "lucide-react";
import type { KeyboardEvent } from "react";
import Tag, { type TagVariant } from "@/components/atoms/Tag";
import { getEstadoSemaforo } from "@/utils/airportHelpers";
import { cn } from "@/utils/cn";
import type { EstadoSemaforo, RangoSemaforo } from "@/types/common.types";

interface FlightListCardProps {
  code: string;
  routeText?: string;
  metaText?: string;
  statusLabel: string;
  statusVariant: TagVariant;
  departureText: string;
  arrivalText: string;
  progressPct: number;
  occupancyPct?: number;
  rangosSemaforo?: RangoSemaforo;
  canCancel?: boolean;
  isCancelling?: boolean;
  notice?: FlightCardNotice | string | null;
  onOpen: () => void;
  onFocusOnMap?: () => void;
  onCancel?: () => void;
}

type FlightCardNoticeTone = "success" | "warning" | "error";

interface FlightCardNotice {
  message: string;
  tone?: FlightCardNoticeTone;
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

const NOTICE_CLASS: Record<FlightCardNoticeTone, string> = {
  success: "border-success/40 bg-success-soft text-success",
  warning: "border-warning/40 bg-warning-soft text-warning",
  error: "border-danger/40 bg-danger-soft text-danger",
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
  onFocusOnMap,
  onCancel,
}: FlightListCardProps) => {
  const occupancyClass = getSemaphoreTextClass(occupancyPct, rangosSemaforo);
  const borderClass = getSemaphoreBorderClass(occupancyPct, rangosSemaforo);
  const noticeData =
    typeof notice === "string"
      ? { message: notice, tone: "warning" as const }
      : notice;
  const handleOpenKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen();
    }
  };

  return (
    <article
      className={cn(
        "w-full rounded-input border border-l-4 border-border bg-card px-3 py-3 text-left text-black transition-colors hover:bg-field",
        borderClass
      )}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={handleOpenKeyDown}
        className="w-full cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-button text-primary truncate">{code}</p>
            {routeText && (
              <p className="mt-1 text-secondary text-black">{routeText}</p>
            )}
            {metaText && (
              <p className="mt-1 text-secondary text-black">{metaText}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Tag variant={statusVariant}>{statusLabel}</Tag>
            {onFocusOnMap && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onFocusOnMap();
                }}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-primary bg-card text-primary transition-colors hover:bg-primary/10"
                aria-label="Enfocar vuelo en el mapa"
                title="Ver vuelo en el mapa"
              >
                <Eye size={16} strokeWidth={2.2} aria-hidden />
              </button>
            )}
            {canCancel && onCancel && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onCancel();
                }}
                disabled={isCancelling}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-danger bg-card text-danger transition-colors hover:bg-danger/10 disabled:opacity-60 disabled:cursor-not-allowed"
                aria-label={isCancelling ? "Cancelando vuelo" : "Cancelar vuelo"}
                title={isCancelling ? "Cancelando..." : "Cancelar"}
              >
                <X size={15} strokeWidth={2.4} aria-hidden />
              </button>
            )}
          </div>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-secondary">
          <div className="inline-flex items-baseline gap-1.5">
            <span className="text-black">Salida</span>
            <span className="text-secondary text-black">{departureText}</span>
          </div>
          <div className="inline-flex items-baseline gap-1.5">
            <span className="text-black">Llegada</span>
            <span className="text-secondary text-black">{arrivalText}</span>
          </div>
          <div className="inline-flex items-baseline gap-1.5">
            <span className="text-black">Progreso</span>
            <span className="text-secondary text-black">{progressPct}%</span>
          </div>
          <div className="inline-flex items-baseline gap-1.5">
            <span className="text-black">Ocupación</span>
            <span className={cn("text-secondary", occupancyClass)}>
              {formatPercent(occupancyPct)}
            </span>
          </div>
        </div>
      </div>

      {noticeData && (
        <div
          role="alert"
          className={cn(
            "mt-3 rounded-input border px-3 py-2 text-secondary shadow-card",
            NOTICE_CLASS[noticeData.tone ?? "warning"]
          )}
        >
          {noticeData.message}
        </div>
      )}

    </article>
  );
};

export default FlightListCard;
