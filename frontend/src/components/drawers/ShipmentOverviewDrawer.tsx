import { useState } from "react";
import DrawerBase from "@/components/drawers/DrawerBase";
import Tag from "@/components/atoms/Tag";
import { useDrawerStore } from "@/store/drawerStore";
import {
  buildShipmentRouteSegments,
  resolveShipmentFocusTarget,
} from "@/utils/shipmentFocus";
import { getShipmentRouteGroups } from "@/utils/shipmentAssignments";
import type { BackendSolicitudEnvio } from "@/types/backendSimulation.types";

interface ShipmentOverviewDrawerProps {
  shipments: BackendSolicitudEnvio[];
  idSimulacion?: number | null;
  referenceMinute?: number | null;
}

type ShipmentStatus = "planificados" | "en-curso" | "entregados";
type ShipmentViewMode = "todos" | "en-curso" | "entregados";

const DAY_MINUTES = 24 * 60;

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
  const shipmentDayMs = Date.parse(`${shipment.fecha}T00:00:00Z`);

  if (Number.isNaN(shipmentDayMs)) {
    return getCurrentUtcMinute();
  }

  return Math.floor((Date.now() - shipmentDayMs) / 60_000);
};

const normalizeMinute = (minute: number): number =>
  ((Math.floor(minute) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;

const parseShipmentUtcMinute = (shipment: BackendSolicitudEnvio): number => {
  const [hour = "0", minute = "0"] = (shipment.hora ?? "00:00").split(":");
  return Number(hour) * 60 + Number(minute);
};

const getNextFlightWindow = (
  earliestMinute: number,
  departureMinute: number | null | undefined,
  arrivalMinute: number | null | undefined
): { departure: number; arrival: number } => {
  const departureBase = normalizeMinute(departureMinute ?? 0);
  let arrivalBase = arrivalMinute ?? departureBase;

  while (arrivalBase <= departureBase) {
    arrivalBase += DAY_MINUTES;
  }

  const duration = Math.max(1, arrivalBase - departureBase);
  const occurrenceOffset = Math.max(
    0,
    Math.ceil((earliestMinute - departureBase) / DAY_MINUTES)
  );
  const departure = departureBase + occurrenceOffset * DAY_MINUTES;

  return {
    departure,
    arrival: departure + duration,
  };
};

const getShipmentTimeline = (
  shipment: BackendSolicitudEnvio
): { firstDeparture: number | null; lastArrival: number | null } => {
  const routeGroups = getShipmentRouteGroups(shipment);

  if (routeGroups.length === 0) {
    return { firstDeparture: null, lastArrival: null };
  }

  let firstDeparture: number | null = null;
  let lastArrival: number | null = null;

  for (const group of routeGroups) {
    let earliestMinute = parseShipmentUtcMinute(shipment);

    for (const flight of group.ruta?.vuelos ?? []) {
      const window = getNextFlightWindow(
        earliestMinute,
        flight.salidaUtcMin,
        flight.llegadaUtcMin
      );

      firstDeparture =
        firstDeparture === null
          ? window.departure
          : Math.min(firstDeparture, window.departure);
      lastArrival =
        lastArrival === null ? window.arrival : Math.max(lastArrival, window.arrival);
      earliestMinute = window.arrival;
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

const formatUtcMinute = (minute: number | null): string => {
  if (minute === null) {
    return "Sin hora";
  }

  const normalized = normalizeMinute(minute);
  const hour = String(Math.floor(normalized / 60)).padStart(2, "0");
  const minutes = String(normalized % 60).padStart(2, "0");
  return `${hour}:${minutes} UTC`;
};

const formatShipmentDateTime = (fecha: string, hora: string): string => {
  const iso = `${fecha}T${hora}${hora.length === 5 ? ":00" : ""}Z`;
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return `${fecha} ${hora}`;
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${day}/${month} ${hour}:${minute}`;
};

const formatShipmentCode = (idEnvio: number): string =>
  `ENV-${String(idEnvio).padStart(3, "0")}`;

const getShipmentCodeLabel = (shipment: BackendSolicitudEnvio): string =>
  shipment.idEnvio !== null
    ? formatShipmentCode(shipment.idEnvio)
    : `Envio ${shipment.origen.codigo}-${shipment.destino.codigo}`;

const getShipmentKey = (shipment: BackendSolicitudEnvio): string =>
  shipment.idEnvio !== null
    ? `envio-${shipment.idEnvio}`
    : `${shipment.fecha}-${shipment.hora}-${shipment.origen.codigo}-${shipment.destino.codigo}-${shipment.contarBolsas}`;

const getFirstDepartureMinute = (shipment: BackendSolicitudEnvio): number | null => {
  return getShipmentTimeline(shipment).firstDeparture;
};

const getLastArrivalMinute = (shipment: BackendSolicitudEnvio): number | null => {
  return getShipmentTimeline(shipment).lastArrival;
};

const resolveDerivedShipmentStatus = (
  shipment: BackendSolicitudEnvio,
  referenceMinute: number
): ShipmentStatus => {
  if (shipment.estado === "COMPLETADO") {
    return "entregados";
  }

  const timeline = getShipmentTimeline(shipment);

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
}: ShipmentOverviewDrawerProps) => {
  const close = useDrawerStore((s) => s.close);
  const openShipment = useDrawerStore((s) => s.openShipment);
  const [mode, setMode] = useState<ShipmentViewMode>("todos");
  const [deliveredHours, setDeliveredHours] = useState(6);
  const getReferenceMinuteForShipment = (shipment: BackendSolicitudEnvio) =>
    referenceMinute ?? getUtcMinutesSinceShipmentDay(shipment);

  const shipmentStatus = (shipment: BackendSolicitudEnvio) =>
    resolveDerivedShipmentStatus(shipment, getReferenceMinuteForShipment(shipment));
  const inProgressShipments = shipments.filter(
    (shipment) => shipmentStatus(shipment) === "en-curso"
  );
  const deliveredShipments = shipments.filter((shipment) => {
    if (shipmentStatus(shipment) !== "entregados") {
      return false;
    }

    const elapsed = getElapsedMinutes(
      getLastArrivalMinute(shipment),
      getReferenceMinuteForShipment(shipment)
    );

    return elapsed !== null && elapsed < deliveredHours * 60;
  });
  const visibleShipments =
    mode === "todos"
      ? shipments
      : mode === "en-curso"
        ? inProgressShipments
        : deliveredShipments;

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
        ...resolveShipmentFocusTarget(
          shipment,
          getReferenceMinuteForShipment(shipment)
        ),
        shipmentRouteSegments: buildShipmentRouteSegments(shipment),
      }
    );
  };

  return (
    <DrawerBase
      eyebrow="Envios"
      title={`Panel de envios (${visibleShipments.length})`}
      onClose={close}
    >
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
            className="block text-label-sm text-text-tertiary mb-1"
          >
            Ultimas horas
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

      {visibleShipments.length === 0 ? (
        <p className="text-body text-text-tertiary">
          No hay envios para esta vista.
        </p>
      ) : (
        <ul className="space-y-2">
          {visibleShipments.map((shipment) => {
            const shipmentCode =
              shipment.idEnvio !== null
                ? formatShipmentCode(shipment.idEnvio)
                : null;
            const derivedStatus = shipmentStatus(shipment);
            const timeLabel =
              derivedStatus === "planificados"
                ? `Salida: ${formatUtcMinute(getFirstDepartureMinute(shipment))}`
                : derivedStatus === "en-curso"
                  ? `Llegada estimada: ${formatUtcMinute(getLastArrivalMinute(shipment))}`
                : `Entrega: ${formatUtcMinute(getLastArrivalMinute(shipment))}`;

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
                  <span className="text-secondary text-text-secondary">
                    {shipment.origen.codigo} &gt; {shipment.destino.codigo}
                  </span>
                  <span className="text-secondary text-text-tertiary block">
                    Registro: {formatShipmentDateTime(shipment.fecha, shipment.hora)}
                  </span>
                  <span className="text-secondary text-text-tertiary block">
                    {timeLabel}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Tag
                    variant={derivedStatus === "entregados" ? "normal" : "primary"}
                  >
                    {derivedStatus === "en-curso"
                      ? "En curso"
                      : derivedStatus === "entregados"
                        ? "Completado"
                        : ESTADO_LABEL[shipment.estado]}
                  </Tag>
                  <span className="text-secondary text-text-tertiary">
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
