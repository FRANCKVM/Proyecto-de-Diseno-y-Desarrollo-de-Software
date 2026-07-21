import { useEffect, useMemo, useState } from "react";
import { Eye } from "lucide-react";
import DrawerBase from "@/components/drawers/DrawerBase";
import InfoRow from "@/components/molecules/InfoRow";
import Tag from "@/components/atoms/Tag";
import { getShipmentByCode } from "@/services/shipmentService";
import { useDrawerStore } from "@/store/drawerStore";
import { DELIVERY_RELEASE_DELAY_MINUTES } from "@/utils/shipmentStatus";
import { formatUtcDateTime, parseUtcDateTimeMs } from "@/utils/utcDateTime";
import type { ShipmentRouteSegment } from "@/utils/shipmentFocus";
import type {
  BloquePaquetes,
  EnvioDetalle,
  EstadoEnvio,
  HitoRuta,
} from "@/types/shipment.types";

interface ShipmentDrawerProps {
  codigo: string;
  displayCodigo?: string;
  idSimulacion?: number | null;
  referenceMinute?: number | null;
  simulationStart?: string | null;
}

const PANEL_REFRESH_MS_SIMULATION = 3000;
const PANEL_REFRESH_MS_OPERATION = 10000;

/**
 * Formatea ISO 8601 a "DD/MM HH:mm".
 */
const formatFechaCorta = (iso: string): string => {
  return formatUtcDateTime(iso, "Sin dato");
};

const getPackageStatusVariant = (
  estado: string
): "normal" | "elevado" | "critico" | "neutral" => {
  const normalized = estado.toLowerCase();

  if (normalized.includes("pendiente")) {
    return "elevado";
  }

  if (normalized.includes("atras") || normalized.includes("fuera")) {
    return "critico";
  }

  if (
    normalized.includes("entregado") ||
    normalized.includes("completado") ||
    normalized.includes("destino")
  ) {
    return "normal";
  }

  return "neutral";
};

interface PackageListItem {
  codigo: string;
  displayCodigo: string;
  estado: string;
  sequence: number;
}

interface RouteSummaryStep {
  key: string;
  label: string;
  sublabel: string;
  estado: string;
  isLast: boolean;
}

const resolveReferenceMs = (
  referenceMinute: number | null | undefined,
  simulationStart: string | null | undefined
): number => {
  const simulationStartMs = parseUtcDateTimeMs(simulationStart);

  if (
    simulationStartMs !== null &&
    referenceMinute !== null &&
    referenceMinute !== undefined
  ) {
    return simulationStartMs + referenceMinute * 60_000;
  }

  return Date.now();
};

const formatRemainingDuration = (minutes: number): string => {
  const safeMinutes = Math.max(0, Math.ceil(minutes));
  const days = Math.floor(safeMinutes / (24 * 60));
  const hours = Math.floor((safeMinutes % (24 * 60)) / 60);
  const remainingMinutes = safeMinutes % 60;
  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days} dia${days === 1 ? "" : "s"}`);
  }

  if (hours > 0) {
    parts.push(`${hours} h`);
  }

  if (remainingMinutes > 0 || parts.length === 0) {
    parts.push(`${remainingMinutes} min`);
  }

  return parts.join(" ");
};

const getHitoMs = (hito: HitoRuta | null | undefined): number | null =>
  parseUtcDateTimeMs(hito?.fecha);

const resolveRouteStepStatus = (
  startMs: number | null,
  endMs: number | null,
  referenceMs: number,
  fallbackStatus: string
): string => {
  if (startMs === null) {
    return fallbackStatus;
  }

  if (referenceMs < startMs) {
    return "pendiente";
  }

  if (endMs !== null && referenceMs < endMs) {
    return "activo";
  }

  return "completado";
};

const resolveDerivedShipmentStatus = (
  shipment: EnvioDetalle,
  referenceMs: number
): EstadoEnvio => {
  if (shipment.estado === "cancelado") {
    return "cancelado";
  }

  const route = shipment.ruta;
  if (route.length === 0) {
    return "registrado";
  }

  const firstFlight = route.find((hito) => hito.tipo === "vuelo");
  const firstFlightMs = getHitoMs(firstFlight);
  const delivery = [...route].reverse().find((hito) => hito.tipo === "entrega");
  const deliveryMs = getHitoMs(delivery ?? route[route.length - 1]);

  if (
    deliveryMs !== null &&
    referenceMs >= deliveryMs + DELIVERY_RELEASE_DELAY_MINUTES * 60_000
  ) {
    return "entregado";
  }

  if (deliveryMs !== null && referenceMs >= deliveryMs) {
    return "completado";
  }

  const hasActiveFlight = route.some((hito, index) => {
    if (hito.tipo !== "vuelo") {
      return false;
    }

    const startMs = getHitoMs(hito);
    const nextStop = route
      .slice(index + 1)
      .find((candidate) => candidate.tipo !== "vuelo");
    const endMs = getHitoMs(nextStop);

    return (
      startMs !== null &&
      referenceMs >= startMs &&
      (endMs === null || referenceMs < endMs)
    );
  });

  if (hasActiveFlight) {
    return "en_transito";
  }

  if (firstFlightMs !== null && referenceMs >= firstFlightMs) {
    return "en_transito";
  }

  return "planificado";
};

const resolveDerivedPackageStatus = (
  originalStatus: string,
  shipmentStatus: EstadoEnvio
): string => {
  if (shipmentStatus === "entregado") {
    return "Entregado";
  }

  if (shipmentStatus === "en_transito") {
    return "En transito";
  }

  if (shipmentStatus === "completado") {
    return "Completado";
  }

  return originalStatus;
};

const getDeliveryMs = (shipment: EnvioDetalle): number | null => {
  const delivery = [...shipment.ruta]
    .reverse()
    .find((hito) => hito.tipo === "entrega");

  return getHitoMs(delivery ?? shipment.ruta[shipment.ruta.length - 1]);
};

const getDeliveredMs = (shipment: EnvioDetalle): number | null => {
  const deliveryMs = getDeliveryMs(shipment);
  return deliveryMs !== null
    ? deliveryMs + DELIVERY_RELEASE_DELAY_MINUTES * 60_000
    : null;
};

const getDeadlineMs = (shipment: EnvioDetalle): number | null => {
  const registrationMs = parseUtcDateTimeMs(shipment.fechaRegistro);

  if (registrationMs === null || !Number.isFinite(shipment.plazoMaximoDias)) {
    return null;
  }

  return registrationMs + shipment.plazoMaximoDias * 24 * 60 * 60_000;
};

const getShipmentStatusLabel = (status: EstadoEnvio): string => {
  switch (status) {
    case "registrado":
      return "Registrado";
    case "en_transito":
      return "En transito";
    case "completado":
      return "Completado";
    case "entregado":
      return "Entregado";
    case "planificado":
      return "Planificado";
    case "cancelado":
      return "Cancelado";
  }
};

const parseSequentialCode = (
  code: string
): { prefix: string; value: number; padding: number } | null => {
  const match = code.match(/^(.*?)(\d+)$/);
  if (!match) {
    return null;
  }

  return {
    prefix: match[1],
    value: Number(match[2]),
    padding: match[2].length,
  };
};

const buildPackageCodeAt = (
  block: BloquePaquetes,
  offset: number
): string => {
  const start = parseSequentialCode(block.codigoInicial);
  const end = parseSequentialCode(block.codigoFinal);

  if (start && end && start.prefix === end.prefix) {
    return `${start.prefix}${String(start.value + offset).padStart(
      start.padding,
      "0"
    )}`;
  }

  if (block.cantidad === 1 || offset === 0) {
    return block.codigoInicial;
  }

  if (offset === block.cantidad - 1) {
    return block.codigoFinal;
  }

  return `${block.codigoInicial} #${offset + 1}`;
};

const formatBagDisplayCode = (shipmentCode: string, sequence: number): string =>
  `${shipmentCode}-BAG-${String(sequence).padStart(3, "0")}`;

const buildPackageItems = (
  blocks: BloquePaquetes[],
  shipmentCode: string,
  shipmentStatus: EstadoEnvio
): PackageListItem[] => {
  let sequence = 1;

  return blocks.flatMap((block) =>
    Array.from({ length: Math.max(0, block.cantidad) }, (_, offset) => {
      const packageSequence = sequence++;

      return {
        codigo: buildPackageCodeAt(block, offset),
        displayCodigo: formatBagDisplayCode(shipmentCode, packageSequence),
        estado: resolveDerivedPackageStatus(block.estado, shipmentStatus),
        sequence: packageSequence,
      };
    })
  );
};

const buildShipmentRouteLabel = (shipment: EnvioDetalle): string => {
  const airports = shipment.ruta
    .filter((hito) => hito.tipo !== "vuelo")
    .map((hito) => hito.aeropuertoIcao);
  const uniqueAirports = airports.filter(
    (airport, index) => index === 0 || airport !== airports[index - 1]
  );

  if (uniqueAirports.length >= 2) {
    return uniqueAirports.join(" > ");
  }

  return `${shipment.origenIcao} > ${shipment.destinoIcao}`;
};

const buildShipmentRouteSegmentsFromDetail = (
  shipment: EnvioDetalle
): ShipmentRouteSegment[] => {
  const routeAirports = shipment.ruta
    .filter((hito) => hito.tipo !== "vuelo")
    .map((hito) => hito.aeropuertoIcao)
    .filter(Boolean);
  const uniqueAirports = routeAirports.filter(
    (airport, index) => index === 0 || airport !== routeAirports[index - 1]
  );
  const airports =
    uniqueAirports.length >= 2
      ? uniqueAirports
      : [shipment.origenIcao, shipment.destinoIcao];

  return airports.slice(0, -1).map((airport, index) => ({
    fromIcao: airport,
    toIcao: airports[index + 1],
  }));
};

const formatFlightRouteCode = (
  flightCode: string | null | undefined,
  fromIcao: string,
  toIcao: string
): string => {
  if (!flightCode) {
    return `${fromIcao}>${toIcao}`;
  }

  return flightCode.includes(">")
    ? flightCode
    : `${fromIcao}>${toIcao}-${flightCode}`;
};

const buildRouteSummarySteps = (
  shipment: EnvioDetalle,
  referenceMs: number
): RouteSummaryStep[] => {
  const flightSteps = shipment.ruta
    .map((hito, index) => ({ hito, index }))
    .filter(({ hito }) => hito.tipo === "vuelo");

  const summary = flightSteps.map(({ hito, index }, summaryIndex) => {
    const previousStop = [...shipment.ruta]
      .slice(0, index)
      .reverse()
      .find((candidate) => candidate.tipo !== "vuelo");
    const nextStop = shipment.ruta
      .slice(index + 1)
      .find((candidate) => candidate.tipo !== "vuelo");
    const fromIcao = previousStop?.aeropuertoIcao ?? shipment.origenIcao;
    const toIcao = nextStop?.aeropuertoIcao ?? shipment.destinoIcao;
    const departureLabel = previousStop
      ? formatFechaCorta(previousStop.fecha)
      : formatFechaCorta(hito.fecha);
    const arrivalLabel = nextStop ? formatFechaCorta(nextStop.fecha) : null;
    const startMs = getHitoMs(hito);
    const endMs = getHitoMs(nextStop);

    return {
      key: `${hito.vueloCodigo ?? hito.aeropuertoIcao}-${index}`,
      label: formatFlightRouteCode(hito.vueloCodigo, fromIcao, toIcao),
      sublabel: arrivalLabel
        ? `${departureLabel} → ${arrivalLabel}`
        : `${departureLabel} — En vuelo`,
      estado: resolveRouteStepStatus(startMs, endMs, referenceMs, hito.estado),
      isLast: summaryIndex === flightSteps.length - 1,
    };
  });

  if (summary.length > 0) {
    return summary;
  }

  return shipment.ruta.map((hito, index) => ({
    key: `${hito.aeropuertoIcao}-${index}`,
    label: hito.aeropuertoIcao,
    sublabel: `${formatFechaCorta(hito.fecha)} — ${
      hito.tipo === "salida"
        ? "Salida"
        : hito.tipo === "escala"
        ? "Escala"
        : "Entrega"
    }`,
    estado: resolveRouteStepStatus(
      getHitoMs(hito),
      getHitoMs(shipment.ruta[index + 1]),
      referenceMs,
      hito.estado
    ),
    isLast: index === shipment.ruta.length - 1,
  }));
};

/**
 * Drawer de detalle de envio.
 * Estandar 61 + mockup 06 del Figma.
 *
 * Muestra info del envio, ruta asignada con timeline de hitos,
 * lista de paquetes (en bloques) y tiempo restante para entrega.
 */
const ShipmentDrawer = ({
  codigo,
  displayCodigo,
  idSimulacion,
  referenceMinute,
  simulationStart,
}: ShipmentDrawerProps) => {
  const close = useDrawerStore((s) => s.close);
  const focusShipmentRouteSegments = useDrawerStore(
    (s) => s.focusShipmentRouteSegments
  );

  const [shipment, setShipment] = useState<EnvioDetalle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const referenceMs = resolveReferenceMs(referenceMinute, simulationStart);
  const derivedShipmentStatus = shipment
    ? resolveDerivedShipmentStatus(shipment, referenceMs)
    : null;
  const packageItems = useMemo(
    () =>
      shipment && derivedShipmentStatus
        ? buildPackageItems(
            shipment.paquetes,
            shipment.codigo,
            derivedShipmentStatus
          )
        : [],
    [derivedShipmentStatus, shipment]
  );
  const packageRouteLabel = useMemo(
    () => (shipment ? buildShipmentRouteLabel(shipment) : ""),
    [shipment]
  );
  const packageRouteSegments = useMemo(
    () => (shipment ? buildShipmentRouteSegmentsFromDetail(shipment) : []),
    [shipment]
  );
  const routeSummarySteps = useMemo(
    () => (shipment ? buildRouteSummarySteps(shipment, referenceMs) : []),
    [referenceMs, shipment]
  );

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

    const loadShipment = async (showLoading: boolean) => {
      if (!canPoll() || requestInFlight) return;
      requestInFlight = true;
      if (showLoading) {
        setIsLoading(true);
      }

      try {
        const data = await getShipmentByCode(codigo, idSimulacion);
        if (cancelled) return;
        setShipment(data);
      } finally {
        requestInFlight = false;
        if (!cancelled && showLoading) {
          setIsLoading(false);
        }
      }
    };

    void loadShipment(true);
    const intervalId = window.setInterval(() => {
      void loadShipment(false);
    }, refreshMs);
    const handleVisibilityChange = () => {
      if (canPoll()) {
        void loadShipment(false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [codigo, idSimulacion]);

  if (isLoading || !shipment) {
    return (
      <DrawerBase eyebrow="Envío" title={displayCodigo ?? codigo} onClose={close}>
        <p className="text-body text-text-primary">Cargando información...</p>
      </DrawerBase>
    );
  }

  const estadoLabel =
    shipment.estado === "en_transito"
      ? "En transito"
      : shipment.estado === "completado"
      ? "Completado"
      : shipment.estado === "entregado"
      ? "Entregado"
      : shipment.estado === "registrado"
      ? "Registrado"
      : shipment.estado === "planificado"
      ? "Planificado"
      : shipment.estado;
  const visibleShipmentStatus = derivedShipmentStatus ?? shipment.estado;
  const visibleEstadoLabel =
    visibleShipmentStatus === shipment.estado
      ? estadoLabel
      : getShipmentStatusLabel(visibleShipmentStatus);
  const deliveryMs = getDeliveryMs(shipment);
  const deliveredMs = getDeliveredMs(shipment);
  const deadlineMs = getDeadlineMs(shipment);
  const dentroDePlazo =
    deadlineMs !== null
      ? (deliveryMs !== null && referenceMs >= deliveryMs
          ? deliveryMs <= deadlineMs
          : referenceMs <= deadlineMs)
      : shipment.dentroDePlazo;
  const tiempoRestante =
    visibleShipmentStatus === "entregado"
      ? "Entregado"
      : visibleShipmentStatus === "completado"
      ? "Listo para entrega"
      : visibleShipmentStatus === "registrado"
      ? "Pendiente de planificacion"
      : deliveredMs !== null
      ? formatRemainingDuration((deliveredMs - referenceMs) / 60_000)
      : shipment.tiempoRestante;
  const statusTagVariant =
    visibleShipmentStatus === "entregado"
      ? "normal"
      : visibleShipmentStatus === "completado"
      ? "neutral"
      : visibleShipmentStatus === "registrado"
      ? "elevado"
      : "primary";

  const handleFocusPackageRoute = () => {
    if (packageRouteSegments.length === 0) {
      focusShipmentRouteSegments([
        {
          fromIcao: shipment.origenIcao,
          toIcao: shipment.destinoIcao,
        },
      ]);
      return;
    }

    focusShipmentRouteSegments(packageRouteSegments);
  };

  return (
    <DrawerBase eyebrow="Envío" title={displayCodigo ?? shipment.codigo} onClose={close}>
      <div className="mb-5">
        <Tag variant={statusTagVariant}>
          {visibleEstadoLabel}
        </Tag>
      </div>

      {/* Informacion del envio */}
      <section className="mb-6">
        <h3 className="text-section-title mb-2">Información del envío</h3>
        <InfoRow label="Código" value={shipment.codigo} />
        <InfoRow label="Aerolinea" value={shipment.aerolinea} />
        <InfoRow label="Origen" value={shipment.origenIcao} />
        <InfoRow label="Destino" value={shipment.destinoIcao} />
        <InfoRow
          label="Tipo"
          value={
            shipment.tipo === "intercontinental"
              ? "Intercontinental"
              : "Intracontinental"
          }
        />
        <InfoRow
          label="Plazo maximo"
          value={`${shipment.plazoMaximoDias} días`}
        />
        <InfoRow
          label="Fecha registro"
          value={formatFechaCorta(shipment.fechaRegistro)}
        />
        <InfoRow
          label="Cantidad maletas"
          value={shipment.cantidadMaletas}
        />
      </section>

      {/* Ruta asignada */}
      <section className="mb-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-section-title">Ruta asignada</h3>
          <button
            type="button"
            onClick={handleFocusPackageRoute}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-primary bg-card text-primary transition-colors hover:bg-primary/10"
            aria-label="Enfocar ruta del envío en el mapa"
            title="Ver ruta en el mapa"
          >
            <Eye size={16} strokeWidth={2.2} aria-hidden />
          </button>
        </div>
        <div className="space-y-1">
          {routeSummarySteps.map((step) => (
            <RouteStep
              key={step.key}
              step={step}
            />
          ))}
        </div>
      </section>

      {/* Maletas */}
      <section className="mb-6">
        <h3 className="text-section-title mb-3">
          Maletas ({shipment.cantidadMaletas})
        </h3>
        <ul className="space-y-2">
          {packageItems.map((maleta) => (
            <li
              key={`${maleta.codigo}-${maleta.sequence}`}
              className="rounded-input border border-border bg-card transition-colors hover:border-primary hover:bg-field"
            >
              <div
                className="flex w-full items-start justify-between gap-3 px-3 py-3 text-left"
              >
                <div className="min-w-0">
                  <p className="text-button text-primary hover:underline">
                    {maleta.displayCodigo}
                  </p>
                  <p className="mt-1 text-secondary text-text-primary">
                    {packageRouteLabel}
                  </p>
                  <p className="mt-1 text-secondary text-text-primary">
                    Maleta individual del envío
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Tag variant={getPackageStatusVariant(maleta.estado)}>
                    {maleta.estado}
                  </Tag>
                  <span className="text-secondary text-text-primary">
                    #{maleta.sequence.toLocaleString("es-PE")}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Tiempo restante */}
      <section className="bg-field rounded-card p-4">
        <div className="flex items-center justify-between">
          <span className="text-body text-text-primary">
            Tiempo restante para entrega:
          </span>
          <span
            className={`text-button ${
              dentroDePlazo ? "text-success" : "text-danger"
            }`}
          >
            {tiempoRestante}
          </span>
        </div>
        <p
          className={`text-secondary mt-1 ${
            dentroDePlazo ? "text-success" : "text-danger"
          }`}
        >
          {dentroDePlazo
            ? "Dentro del plazo comprometido"
            : "Fuera del plazo comprometido"}
        </p>
      </section>
    </DrawerBase>
  );
};

// ============================================================================
// SUB-COMPONENTE RouteStep
// ============================================================================

interface RouteStepProps {
  step: RouteSummaryStep;
}

const STATUS_COLOR: Record<string, string> = {
  completado: "text-success",
  activo: "text-primary",
  pendiente: "text-text-primary",
};

const STATUS_LABEL: Record<string, string> = {
  completado: "Completado",
  activo: "Activo",
  pendiente: "Pendiente",
};

const DOT_COLOR_BY_STATUS: Record<string, string> = {
  completado: "bg-success",
  activo: "bg-primary",
  pendiente: "bg-text-tertiary",
};

const RouteStep = ({ step }: RouteStepProps) => {
  const status = step.estado as string;
  const dotClass = DOT_COLOR_BY_STATUS[status] ?? "bg-text-tertiary";
  const statusColor = STATUS_COLOR[status] ?? "text-text-primary";
  const statusText = STATUS_LABEL[status] ?? status;
  const hito = {
    fecha: "",
    tipo: "",
    vueloCodigo: null as string | null,
  };

  return (
    <div className="flex gap-3 relative pb-3">
      <div className="flex flex-col items-center pt-1">
        <div className={`w-3 h-3 rounded-full ${dotClass} relative z-10`} />
        {!step.isLast && <div className="w-px flex-1 bg-border mt-1" />}
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between gap-3">
          <span className="text-button text-text-primary">{step.label}</span>
          <span className={`text-secondary ${statusColor}`}>{statusText}</span>
        </div>
        <p className="text-secondary text-text-primary">{step.sublabel}</p>
      </div>
    </div>
  );

  return (
    <div className="flex gap-3 relative pb-3">
      <div className="flex flex-col items-center pt-1">
        <div className={`w-3 h-3 rounded-full ${dotClass} relative z-10`} />
        {!step.isLast && <div className="w-px flex-1 bg-border mt-1" />}
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <span className="text-button text-text-primary">
            {step.label}
          </span>
          <span className={`text-secondary ${statusColor}`}>{statusText}</span>
        </div>
        <p className="text-secondary text-text-primary">
          {formatFechaCorta(hito.fecha)} —{" "}
          {hito.tipo === "salida"
            ? "Salida"
            : hito.tipo === "vuelo"
            ? "En vuelo"
            : hito.tipo === "escala"
            ? "Escala"
            : "Entrega"}
        </p>
        {hito.vueloCodigo && hito.tipo !== "vuelo" && (
          <p className="text-secondary text-primary">{hito.vueloCodigo}</p>
        )}
      </div>
    </div>
  );
};

export default ShipmentDrawer;
