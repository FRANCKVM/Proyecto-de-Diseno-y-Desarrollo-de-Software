import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import DrawerBase from "@/components/drawers/DrawerBase";
import InfoRow from "@/components/molecules/InfoRow";
import Tag from "@/components/atoms/Tag";
import { getFlightByCode } from "@/services/flightService";
import { getShipmentByCode } from "@/services/shipmentService";
import { useDrawerStore } from "@/store/drawerStore";
import { parseShipmentIdentifier } from "@/utils/shipmentCode";
import {
  formatUtcDateTimeWithYear,
  parseUtcDateTimeMs,
} from "@/utils/utcDateTime";
import type { EstadoVuelo, VueloDetalle } from "@/types/flight.types";
import type { EnvioDetalle } from "@/types/shipment.types";
import type { ShipmentRouteSegment } from "@/utils/shipmentFocus";

interface FlightDrawerProps {
  codigo: string;
  idSimulacion?: number | null;
  referenceMinute?: number | null;
  simulationStart?: string | null;
}

const PANEL_REFRESH_MS_SIMULATION = 3000;
const PANEL_REFRESH_MS_OPERATION = 10000;

/**
 * Formatea ISO 8601 a "DD/MM/YYYY HH:mm" en UTC.
 */
const formatFecha = (iso: string | null | undefined): string => {
  return formatUtcDateTimeWithYear(iso, "Sin dato");
};

const parseFlightDateMs = (iso: string | null | undefined): number => {
  return parseUtcDateTimeMs(iso) ?? NaN;
};

const resolveReferenceMs = (
  referenceMinute: number | null | undefined,
  simulationStart: string | null | undefined,
  fallbackMs: number
): number => {
  const simulationStartMs = parseUtcDateTimeMs(simulationStart);

  if (
    simulationStartMs !== null &&
    referenceMinute !== null &&
    referenceMinute !== undefined
  ) {
    return simulationStartMs + referenceMinute * 60_000;
  }

  return fallbackMs;
};

const resolveTemporalFlightStatus = (
  flight: VueloDetalle,
  referenceMs: number
): EstadoVuelo => {
  if (flight.estado === "cancelado") {
    return "cancelado";
  }

  const departureMs = parseFlightDateMs(flight.fechaSalida);
  const arrivalMs = parseFlightDateMs(flight.fechaLlegadaEstimada);

  if (
    !Number.isFinite(departureMs) ||
    !Number.isFinite(arrivalMs) ||
    arrivalMs <= departureMs
  ) {
    return flight.estado;
  }

  if (referenceMs < departureMs) {
    return "programado";
  }

  if (referenceMs < arrivalMs) {
    return "en_vuelo";
  }

  return "completado";
};

const formatTiempoRestante = (
  arrivalIso: string | null | undefined,
  referenceMs: number,
  estado?: VueloDetalle["estado"]
): string => {
  if (estado === "completado") {
    return "Completado";
  }

  const arrivalMs = parseFlightDateMs(arrivalIso);

  if (Number.isNaN(arrivalMs)) {
    return "No disponible";
  }

  const diffMinutes = Math.max(
    0,
    Math.ceil((arrivalMs - referenceMs) / 60_000)
  );

  if (diffMinutes === 0) {
    return "Llegando o completado";
  }

  const days = Math.floor(diffMinutes / (24 * 60));
  const hours = Math.floor((diffMinutes % (24 * 60)) / 60);
  const minutes = diffMinutes % 60;
  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days} dia${days === 1 ? "" : "s"}`);
  }

  if (hours > 0) {
    parts.push(`${hours} h`);
  }

  if (minutes > 0 || parts.length === 0) {
    parts.push(`${minutes} min`);
  }

  return parts.join(" ");
};

const formatPercent = (value: number): string =>
  `${value.toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;

const formatFlightDisplayCode = (flight: VueloDetalle): string => {
  const origen = flight.origenIcao || "?";
  const destino = flight.destinoIcao || "?";
  const codigoVuelo = flight.codigo || flight.idVuelo || flight.idOcurrencia || "s/n";
  return `${origen}>${destino}-${codigoVuelo}`;
};

const buildShipmentRouteSegmentsFromDetail = (
  shipment: EnvioDetalle
): ShipmentRouteSegment[] => {
  const routeAirports = shipment.ruta
    .filter((hito) => hito.tipo !== "vuelo")
    .map((hito) => hito.aeropuertoIcao)
    .filter((icao): icao is string => Boolean(icao));
  const uniqueAirports = routeAirports.filter(
    (icao, index, list) => index === 0 || icao !== list[index - 1]
  );
  const airports =
    uniqueAirports.length >= 2
      ? uniqueAirports
      : [shipment.origenIcao, shipment.destinoIcao];

  return airports.slice(0, -1).map((fromIcao, index) => ({
    fromIcao,
    toIcao: airports[index + 1],
  }));
};

const getFlightTagVariant = (estado: VueloDetalle["estado"]) => {
  switch (estado) {
    case "en_vuelo":
      return "primary";
    case "completado":
      return "normal";
    case "cancelado":
      return "critico";
    case "programado":
    default:
      return "neutral";
  }
};

/**
 * Drawer de detalle de vuelo.
 * Estandar 61 + mockup 05 del Figma.
 *
 * Muestra info del vuelo, trayecto con timeline visual y lista de
 * envios transportados. Los envios son clickeables y abren el
 * ShipmentDrawer correspondiente.
 */
const FlightDrawer = ({
  codigo,
  idSimulacion,
  referenceMinute,
  simulationStart,
}: FlightDrawerProps) => {
  const close = useDrawerStore((s) => s.close);
  const openShipment = useDrawerStore((s) => s.openShipment);
  const focusShipmentRouteSegments = useDrawerStore(
    (s) => s.focusShipmentRouteSegments
  );

  const [flight, setFlight] = useState<VueloDetalle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!codigo) {
      return;
    }

    let cancelled = false;
    let requestInFlight = false;
    const canPoll = () =>
      typeof document === "undefined" || document.visibilityState === "visible";

    const refreshMs =
      idSimulacion != null
        ? PANEL_REFRESH_MS_SIMULATION
        : PANEL_REFRESH_MS_OPERATION;

    const loadFlight = async (showLoading: boolean, forceRefresh: boolean) => {
      if (!canPoll() || requestInFlight) return;
      requestInFlight = true;
      if (showLoading) {
        setIsLoading(true);
        setNotFound(false);
      }

      try {
        const data = await getFlightByCode(codigo, idSimulacion, {
          forceRefresh,
        });

        if (cancelled) return;
        setFlight(data);
        setNotFound(!data);
      } catch {
        if (!cancelled && showLoading) {
          setNotFound(true);
        }
      } finally {
        requestInFlight = false;
        if (!cancelled && showLoading) {
          setIsLoading(false);
        }
      }
    };

    // Al abrir el drawer, obtenemos el detalle actual directamente del backend.
    // La versión cacheada puede provenir del listado de un aeropuerto y no
    // contener todavía los envíos asociados al vuelo.
    void loadFlight(true, true);
    const intervalId = window.setInterval(() => {
      void loadFlight(false, true);
    }, refreshMs);
    const handleVisibilityChange = () => {
      if (canPoll()) {
        void loadFlight(false, true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [codigo, idSimulacion]);

  if (isLoading) {
    return (
      <DrawerBase eyebrow="Vuelo" title="Cargando" onClose={close}>
        <p className="text-body text-text-primary">Cargando información...</p>
      </DrawerBase>
    );
  }

  if (notFound || !flight) {
    return (
      <DrawerBase eyebrow="Vuelo" title="Sin información" onClose={close}>
        <p className="text-body text-text-primary">
          No se encontró información para este vuelo.
        </p>
      </DrawerBase>
    );
  }

  const ocupacionPct =
    flight.capacidad > 0 ? (flight.ocupacion / flight.capacidad) * 100 : 0;
  const referenceMs = resolveReferenceMs(referenceMinute, simulationStart, nowMs);
  const temporalStatus = resolveTemporalFlightStatus(flight, referenceMs);
  const estadoLabel =
    temporalStatus === "en_vuelo"
      ? "En vuelo"
      : temporalStatus === "programado"
      ? "Programado"
      : temporalStatus === "completado"
      ? "Completado"
      : temporalStatus === "cancelado"
      ? "Cancelado"
      : temporalStatus;
  const displayFlightCode = formatFlightDisplayCode(flight);
  const flightEnvios = Array.isArray(flight.envios) ? flight.envios : [];
  const isCancelled = temporalStatus === "cancelado";
  const isCompleted = temporalStatus === "completado";
  const remainingTimeValue = isCancelled ? (
    <Tag variant="critico">Cancelado</Tag>
  ) : (
    formatTiempoRestante(flight.fechaLlegadaEstimada, referenceMs, temporalStatus)
  );
  const openShipmentFromFlight = (shipmentCode: string) => {
    const shipmentId = parseShipmentIdentifier(shipmentCode);
    openShipment(shipmentId !== null ? String(shipmentId) : shipmentCode, {
      idSimulacion,
      displayCodigo: shipmentCode,
    });
  };

  const focusShipmentFromFlight = async (
    shipmentCode: string,
    fallback: { origenIcao: string; destinoIcao: string }
  ) => {
    const shipmentId = parseShipmentIdentifier(shipmentCode);
    const shipment = await getShipmentByCode(
      shipmentId !== null ? String(shipmentId) : shipmentCode,
      idSimulacion
    );

    focusShipmentRouteSegments(
      shipment
        ? buildShipmentRouteSegmentsFromDetail(shipment)
        : [{ fromIcao: fallback.origenIcao, toIcao: fallback.destinoIcao }]
    );
  };

  return (
    <DrawerBase eyebrow="Vuelo" title={displayFlightCode} onClose={close}>
      {!isCancelled && (
        <div className="mb-5">
          <Tag variant={getFlightTagVariant(temporalStatus)}>
            {estadoLabel}
          </Tag>
        </div>
      )}

      {/* Informacion del vuelo */}
      <section className="mb-6">
        <h3 className="text-section-title mb-2">Información del vuelo</h3>
        <InfoRow label="Código" value={displayFlightCode} />
        <InfoRow label="Estado" value={estadoLabel} />
        <InfoRow
          label="Tipo"
          value={
            flight.tipo === "intercontinental"
              ? "Intercontinental"
              : "Intracontinental"
          }
        />
        <InfoRow
          label="Ocupación"
          value={`${flight.ocupacion} / ${flight.capacidad} (${formatPercent(ocupacionPct)})`}
        />
        <InfoRow label="Fecha salida" value={formatFecha(flight.fechaSalida)} />
        <InfoRow
          label="Fecha llegada est."
          value={formatFecha(flight.fechaLlegadaEstimada)}
        />
        <InfoRow
          label="Tiempo restante"
          value={remainingTimeValue}
        />
      </section>

      {/* Trayecto */}
      <section className="mb-6">
        <h3 className="text-section-title mb-3">Trayecto del vuelo</h3>
        <div className="space-y-3">
          <TimelineStep
            color={isCancelled ? "neutral" : "success"}
            label={`Origen (${flight.origenIcao})`}
            sublabel={`${formatFecha(flight.fechaSalida)} — Salida`}
            status={isCancelled ? "Cancelado" : "Completado"}
            statusColor={isCancelled ? "text-danger" : "text-success"}
          />
          <TimelineStep
            color={isCancelled ? "neutral" : "primary"}
            label={isCancelled ? "Cancelado" : "En vuelo"}
            sublabel={isCancelled ? "Vuelo cancelado" : "Posicion actual"}
            status={isCancelled ? "Cancelado" : "En tránsito"}
            statusColor={isCancelled ? "text-danger" : "text-primary"}
            isMiddle={!isCancelled}
          />
          <TimelineStep
            color={isCompleted ? "success" : "neutral"}
            label={`Destino (${flight.destinoIcao})`}
            sublabel={`${formatFecha(flight.fechaLlegadaEstimada)} — Llegada est.`}
            status={isCompleted ? "Completado" : isCancelled ? "Cancelado" : "Pendiente"}
            statusColor={
              isCompleted
                ? "text-success"
                : isCancelled
                ? "text-danger"
                : "text-text-primary"
            }
            isLast
          />
        </div>
      </section>

      {/* Envios transportados */}
      <section>
        <h3 className="text-section-title mb-3">
          Envíos transportados
          {flightEnvios.length > 0 && ` (${flightEnvios.length})`}
        </h3>
        {flightEnvios.length === 0 ? (
          <p className="text-body text-text-primary">
            Sin envíos asignados todavía.
          </p>
        ) : (
          <ul className="space-y-2">
            {flightEnvios.map((e) => (
              <li
                key={e.codigo}
                className="bg-field rounded-input px-3 py-2 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <button
                    type="button"
                    className="text-button text-primary hover:underline block"
                    onClick={() => openShipmentFromFlight(e.codigo)}
                  >
                    {e.codigo}
                  </button>
                  <span className="text-secondary text-text-primary">
                    {e.origenIcao} &gt; {e.destinoIcao}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-secondary text-text-primary">
                    {e.maletasOcupadas} / {e.maletasTotales} mal.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      void focusShipmentFromFlight(e.codigo, {
                        origenIcao: e.origenIcao,
                        destinoIcao: e.destinoIcao,
                      });
                    }}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-primary bg-card text-primary transition-colors hover:bg-primary/10"
                    aria-label={`Enfocar ruta de ${e.codigo} en el mapa`}
                    title="Ver ruta en el mapa"
                  >
                    <Eye size={16} strokeWidth={2.2} aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </DrawerBase>
  );
};

// ============================================================================
// SUB-COMPONENTE TimelineStep
// ============================================================================

interface TimelineStepProps {
  color: "success" | "primary" | "neutral";
  label: string;
  sublabel?: string;
  status: string;
  statusColor: string;
  isMiddle?: boolean;
  isLast?: boolean;
}

const DOT_CLASS: Record<TimelineStepProps["color"], string> = {
  success: "bg-success",
  primary: "bg-primary",
  neutral: "bg-text-tertiary",
};

const TimelineStep = ({
  color,
  label,
  sublabel,
  status,
  statusColor,
  isMiddle = false,
  isLast = false,
}: TimelineStepProps) => (
  <div className="flex gap-3 relative">
    <div className="flex flex-col items-center pt-1">
      <div
        className={`w-3 h-3 rounded-full ${DOT_CLASS[color]} relative z-10`}
      />
      {!isLast && <div className="w-px flex-1 bg-border mt-1" />}
    </div>
    <div className="flex-1 pb-4">
      <div className="flex items-center justify-between">
        <span className="text-button text-text-primary">{label}</span>
        <span className={`text-secondary ${statusColor}`}>{status}</span>
      </div>
      {sublabel && (
        <p className="text-secondary text-text-primary">{sublabel}</p>
      )}
      {isMiddle && (
        <p className="text-secondary text-primary mt-0.5">En tránsito</p>
      )}
    </div>
  </div>
);

export default FlightDrawer;
