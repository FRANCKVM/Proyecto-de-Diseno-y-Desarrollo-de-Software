import { useState } from "react";
import { Eye } from "lucide-react";
import DrawerBase from "@/components/drawers/DrawerBase";
import Tag from "@/components/atoms/Tag";
import { useDrawerStore } from "@/store/drawerStore";
import {
  buildShipmentRouteSegments,
} from "@/utils/shipmentFocus";
import { getShipmentRouteGroups } from "@/utils/shipmentAssignments";
import {
  formatShipmentDisplayCode,
  getShipmentApiIdentifier,
} from "@/utils/shipmentCode";
import {
  formatUtcDateTime,
  formatUtcSimulationMinute,
  parseUtcDateTimeMs,
} from "@/utils/utcDateTime";
import type { BackendSolicitudEnvio } from "@/types/backendSimulation.types";

interface ShipmentOverviewDrawerProps {
  shipments: BackendSolicitudEnvio[];
  idSimulacion?: number | null;
  referenceMinute?: number | null;
  simulationStart?: string | null;
}

type ShipmentStatus = "planificados" | "en-curso" | "entregados";
type ShipmentViewMode = "todos" | "en-curso" | "entregados";

const ESTADO_LABEL: Record<BackendSolicitudEnvio["estado"], string> = {
  INGRESADO: "Ingresado",
  PARCIAL: "Parcial",
  EN_PROCESO: "En proceso",
  COMPLETADO: "Completado",
};

const getCurrentUtcMinute = (): number => {
  const now = new Date();
  return now.getUTCHours() * 60 + now.getUTCMinutes();
};

const getUtcMinutesSinceShipmentDay = (
  shipment: BackendSolicitudEnvio
): number => {
  const shipmentDayMs = parseUtcDateTimeMs(`${shipment.fecha}T00:00:00`);

  if (shipmentDayMs === null) {
    return getCurrentUtcMinute();
  }

  return Math.floor((Date.now() - shipmentDayMs) / 60_000);
};

const parseTimelineDateTimeMs = (value: string | null | undefined): number | null => {
  return parseUtcDateTimeMs(value);
};

const getShipmentTimeline = (
  shipment: BackendSolicitudEnvio,
  simulationStart?: string | null
): { firstDeparture: number | null; lastArrival: number | null } => {
  const routeGroups = getShipmentRouteGroups(shipment);

  if (routeGroups.length === 0) {
    return { firstDeparture: null, lastArrival: null };
  }

  let firstDeparture: number | null = null;
  let lastArrival: number | null = null;

  for (const group of routeGroups) {
    for (const occurrence of group.ruta?.ocurrencias ?? []) {
      const baseMs = parseTimelineDateTimeMs(simulationStart)
        ?? parseUtcDateTimeMs(`${shipment.fecha}T00:00:00`);
      const departureMs = parseUtcDateTimeMs(occurrence.fechaHoraSalida);
      const arrivalMs = parseUtcDateTimeMs(occurrence.fechaHoraLlegada);

      if (baseMs === null || departureMs === null || arrivalMs === null) {
        continue;
      }

      const departure = Math.round((departureMs - baseMs) / 60_000);
      const arrival = Math.round((arrivalMs - baseMs) / 60_000);

      firstDeparture =
        firstDeparture === null
          ? departure
          : Math.min(firstDeparture, departure);
      lastArrival =
        lastArrival === null ? arrival : Math.max(lastArrival, arrival);
    }
  }

  return { firstDeparture, lastArrival };
};

const getElapsedMinutes = (
  eventMinute: number | null,
  referenceMinute: number
): number | null => {
  if (eventMinute === null) {
    return null;
  }

  if (referenceMinute < eventMinute) {
    return null;
  }

  return referenceMinute - eventMinute;
};

const formatShipmentDateTime = (fecha: string, hora: string): string => {
  return formatUtcDateTime(
    `${fecha}T${hora}${hora.length === 5 ? ":00" : ""}`,
    `${fecha} ${hora}`
  );
};

const getShipmentCodeLabel = (shipment: BackendSolicitudEnvio): string =>
  shipment.idEnvio !== null
    ? formatShipmentDisplayCode(shipment.idEnvio)
    : `Envío ${shipment.origen.codigo}-${shipment.destino.codigo}`;

const getShipmentKey = (shipment: BackendSolicitudEnvio): string =>
  shipment.idEnvio !== null
    ? `envio-${shipment.idEnvio}`
    : `${shipment.fecha}-${shipment.hora}-${shipment.origen.codigo}-${shipment.destino.codigo}-${shipment.contarBolsas}`;

const getFirstDepartureMinute = (
  shipment: BackendSolicitudEnvio,
  simulationStart?: string | null
): number | null => {
  return getShipmentTimeline(shipment, simulationStart).firstDeparture;
};

const getLastArrivalMinute = (
  shipment: BackendSolicitudEnvio,
  simulationStart?: string | null
): number | null => {
  return getShipmentTimeline(shipment, simulationStart).lastArrival;
};

const resolveDerivedShipmentStatus = (
  shipment: BackendSolicitudEnvio,
  referenceMinute: number,
  simulationStart?: string | null
): ShipmentStatus => {
  if (shipment.estado === "COMPLETADO") {
    return "entregados";
  }

  const timeline = getShipmentTimeline(shipment, simulationStart);

  if (timeline.lastArrival !== null && referenceMinute >= timeline.lastArrival) {
    return "entregados";
  }

  if (
    shipment.estado === "PARCIAL" ||
    shipment.estado === "EN_PROCESO" ||
    (timeline.firstDeparture !== null && referenceMinute >= timeline.firstDeparture)
  ) {
    return "en-curso";
  }

  return "planificados";
};

const ShipmentOverviewDrawer = ({
  shipments,
  idSimulacion,
  referenceMinute,
  simulationStart,
}: ShipmentOverviewDrawerProps) => {
  const close = useDrawerStore((s) => s.close);
  const openShipment = useDrawerStore((s) => s.openShipment);
  const focusShipmentRouteSegments = useDrawerStore(
    (s) => s.focusShipmentRouteSegments
  );
  const [mode, setMode] = useState<ShipmentViewMode>("todos");
  const [deliveredHours, setDeliveredHours] = useState(6);
  const [airportFilter, setAirportFilter] = useState("todos");
  const getReferenceMinuteForShipment = (shipment: BackendSolicitudEnvio) =>
    referenceMinute ?? getUtcMinutesSinceShipmentDay(shipment);

  const airportOptions = Array.from(
    new Set(
      shipments.map((shipment) => shipment.origen.codigo)
    )
  ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));

  const shipmentStatus = (shipment: BackendSolicitudEnvio) =>
    resolveDerivedShipmentStatus(
      shipment,
      getReferenceMinuteForShipment(shipment),
      simulationStart
    );
  const inProgressShipments = shipments.filter(
    (shipment) => shipmentStatus(shipment) === "en-curso"
  );
  const deliveredShipments = shipments.filter((shipment) => {
    if (shipmentStatus(shipment) !== "entregados") {
      return false;
    }

    const elapsed = getElapsedMinutes(
      getLastArrivalMinute(shipment, simulationStart),
      getReferenceMinuteForShipment(shipment)
    );

    return elapsed !== null && elapsed < deliveredHours * 60;
  });
  const visibleShipmentsByMode =
    mode === "todos"
      ? shipments
      : mode === "en-curso"
        ? inProgressShipments
        : deliveredShipments;
  const visibleShipments =
    airportFilter === "todos"
      ? visibleShipmentsByMode
      : visibleShipmentsByMode.filter(
          (shipment) => shipment.origen.codigo === airportFilter
        );

  const handleHoursChange = (value: string) => {
    const nextValue = Number(value);
    if (!Number.isFinite(nextValue)) {
      return;
    }

    setDeliveredHours(Math.min(23, Math.max(1, Math.floor(nextValue))));
  };

  const handleOpenShipment = (
    shipmentCode: string,
    shipment: BackendSolicitudEnvio
  ) => {
    openShipment(
      shipmentCode,
      {
        idSimulacion,
        displayCodigo: getShipmentCodeLabel(shipment),
      }
    );
  };

  const handleFocusShipmentRoute = (shipment: BackendSolicitudEnvio) => {
    focusShipmentRouteSegments(buildShipmentRouteSegments(shipment));
  };

  return (
    <DrawerBase title="Panel de envíos" onClose={close}>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <button
          type="button"
          className={`px-3 py-2 rounded-input border text-button transition-colors ${
            mode === "todos"
              ? "bg-primary border-primary text-text-inverse"
              : "bg-card border-border text-text-primary hover:bg-field"
          }`}
          onClick={() => setMode("todos")}
        >
          Todos ({shipments.length})
        </button>
        <button
          type="button"
          className={`px-3 py-2 rounded-input border text-button transition-colors ${
            mode === "en-curso"
              ? "bg-primary border-primary text-text-inverse"
              : "bg-card border-border text-text-primary hover:bg-field"
          }`}
          onClick={() => setMode("en-curso")}
        >
          En curso ({inProgressShipments.length})
        </button>
        <button
          type="button"
          className={`px-3 py-2 rounded-input border text-button transition-colors ${
            mode === "entregados"
              ? "bg-primary border-primary text-text-inverse"
              : "bg-card border-border text-text-primary hover:bg-field"
          }`}
          onClick={() => setMode("entregados")}
        >
          Entregados ({deliveredShipments.length})
        </button>
      </div>

      {mode === "entregados" && (
        <div className="mb-5">
          <label
            htmlFor="delivered-hours"
            className="block text-label-sm text-text-primary mb-1"
          >
            Últimas horas
          </label>
          <input
            id="delivered-hours"
            type="number"
            min={1}
            max={23}
            value={deliveredHours}
            onChange={(event) => handleHoursChange(event.target.value)}
            className="w-full bg-field border border-border rounded-input px-3 py-2 text-button text-text-primary focus:outline-none focus:border-primary"
          />
        </div>
      )}

      <div className="mb-5">
        <label
          htmlFor="shipment-airport-filter"
          className="block text-label-sm text-text-primary mb-1"
        >
          Filtrar por aeropuerto de origen
        </label>
        <select
          id="shipment-airport-filter"
          value={airportFilter}
          onChange={(event) => setAirportFilter(event.target.value)}
          className="w-full bg-field border border-border rounded-input px-3 py-2 text-button text-text-primary focus:outline-none focus:border-primary"
        >
          <option value="todos">Todos</option>
          {airportOptions.map((icao) => (
            <option key={icao} value={icao}>
              {icao}
            </option>
          ))}
        </select>
      </div>

      {visibleShipments.length === 0 ? (
        <p className="text-body text-text-primary">
          No hay envíos para esta vista.
        </p>
      ) : (
        <ul className="space-y-2">
          {visibleShipments.map((shipment) => {
            const shipmentCode =
              shipment.idEnvio !== null
                ? getShipmentApiIdentifier(shipment.idEnvio)
                : null;
            const derivedStatus = shipmentStatus(shipment);
            const timeLabel =
              derivedStatus === "planificados"
                ? `Salida: ${formatUtcSimulationMinute(
                    getFirstDepartureMinute(shipment, simulationStart),
                    simulationStart
                  )}`
                : derivedStatus === "en-curso"
                  ? `Llegada estimada: ${formatUtcSimulationMinute(
                      getLastArrivalMinute(shipment, simulationStart),
                      simulationStart
                    )}`
                : `Entrega: ${formatUtcSimulationMinute(
                    getLastArrivalMinute(shipment, simulationStart),
                    simulationStart
                  )}`;

            return (
              <li
                key={getShipmentKey(shipment)}
                className="bg-field rounded-input px-3 py-2 flex items-center justify-between"
              >
                <div>
                  {shipmentCode ? (
                    <button
                      type="button"
                      className="text-button text-primary hover:underline block"
                      onClick={() => handleOpenShipment(shipmentCode, shipment)}
                    >
                      {getShipmentCodeLabel(shipment)}
                    </button>
                  ) : (
                    <p className="text-button text-text-primary">
                      {getShipmentCodeLabel(shipment)}
                    </p>
                  )}
                  <span className="text-secondary text-text-primary">
                    {shipment.origen.codigo} &gt; {shipment.destino.codigo}
                  </span>
                  <span className="text-secondary text-text-primary block">
                    Registro: {formatShipmentDateTime(shipment.fecha, shipment.hora)}
                  </span>
                  <span className="text-secondary text-text-primary block">
                    {timeLabel}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <button
                    type="button"
                    onClick={() => handleFocusShipmentRoute(shipment)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-primary bg-card text-primary transition-colors hover:bg-primary/10"
                    aria-label={`Enfocar ruta de ${getShipmentCodeLabel(shipment)} en el mapa`}
                    title="Ver ruta en el mapa"
                  >
                    <Eye size={16} strokeWidth={2.2} aria-hidden />
                  </button>
                  <Tag
                    variant={derivedStatus === "entregados" ? "normal" : "primary"}
                  >
                    {derivedStatus === "en-curso"
                      ? "En curso"
                      : derivedStatus === "entregados"
                        ? "Completado"
                        : ESTADO_LABEL[shipment.estado]}
                  </Tag>
                  <span className="text-secondary text-text-primary">
                    {shipment.contarBolsas} maletas
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </DrawerBase>
  );
};

export default ShipmentOverviewDrawer;
