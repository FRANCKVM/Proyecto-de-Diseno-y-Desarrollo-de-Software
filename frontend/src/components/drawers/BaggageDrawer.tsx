import { useState } from "react";
import { Eye } from "lucide-react";
import DrawerBase from "@/components/drawers/DrawerBase";
import Tag from "@/components/atoms/Tag";
import { useDrawerStore } from "@/store/drawerStore";
import { getShipmentRouteGroups } from "@/utils/shipmentAssignments";
import {
  buildRouteSegments,
  type ShipmentRouteSegment,
} from "@/utils/shipmentFocus";
import {
  formatShipmentDisplayCode,
  getShipmentApiIdentifier,
} from "@/utils/shipmentCode";
import { parseUtcDateTimeMs } from "@/utils/utcDateTime";
import type { BackendSolicitudEnvio } from "@/types/backendSimulation.types";

interface BaggageDrawerProps {
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

const getShipmentCodeLabel = (shipment: BackendSolicitudEnvio): string =>
  shipment.idEnvio !== null
    ? formatShipmentDisplayCode(shipment.idEnvio)
    : `Envío ${shipment.origen.codigo}-${shipment.destino.codigo}`;

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
  if (eventMinute === null || referenceMinute < eventMinute) {
    return null;
  }

  return referenceMinute - eventMinute;
};

const getLastArrivalMinute = (
  shipment: BackendSolicitudEnvio,
  simulationStart?: string | null
): number | null => getShipmentTimeline(shipment, simulationStart).lastArrival;

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

const getStatusLabel = (
  shipment: BackendSolicitudEnvio,
  status: ShipmentStatus
): string => {
  if (status === "en-curso") {
    return "En curso";
  }

  if (status === "entregados") {
    return "Completado";
  }

  return ESTADO_LABEL[shipment.estado];
};

const countBags = (shipments: BackendSolicitudEnvio[]): number =>
  shipments.reduce((total, shipment) => total + (shipment.contarBolsas ?? 0), 0);

interface VirtualBaggageItem {
  id: string;
  shipment: BackendSolicitudEnvio;
  shipmentCode: string;
  bagIndex: number;
  routeLabel: string;
  routeSegments: ShipmentRouteSegment[];
  assigned: boolean;
  status: ShipmentStatus;
}

const formatBagCode = (shipment: BackendSolicitudEnvio, bagIndex: number): string => {
  const shipmentCode =
    shipment.idEnvio !== null
      ? formatShipmentDisplayCode(shipment.idEnvio)
      : `ENV-${shipment.origen.codigo}-${shipment.destino.codigo}`;

  return `${shipmentCode}-BAG-${String(bagIndex).padStart(3, "0")}`;
};

const buildRouteLabel = (
  segments: ShipmentRouteSegment[],
  shipment: BackendSolicitudEnvio
): string => {
  if (segments.length === 0) {
    return `${shipment.origen.codigo} > ${shipment.destino.codigo}`;
  }

  const points = [segments[0].fromIcao, ...segments.map((segment) => segment.toIcao)];
  return points.join(" > ");
};

const buildVirtualBaggageItems = (
  shipments: BackendSolicitudEnvio[],
  getStatus: (shipment: BackendSolicitudEnvio) => ShipmentStatus
): VirtualBaggageItem[] => {
  const items: VirtualBaggageItem[] = [];

  shipments.forEach((shipment) => {
    const shipmentCode = getShipmentCodeLabel(shipment);
    const totalBags = shipment.contarBolsas ?? 0;
    const groups = getShipmentRouteGroups(shipment);
    const status = getStatus(shipment);
    let nextBagIndex = 1;

    groups.forEach((group) => {
      const quantity = Math.max(0, group.cantidadBolsas ?? 0);
      const start = nextBagIndex;
      const end = Math.min(totalBags, nextBagIndex + quantity - 1);
      const routeSegments = buildRouteSegments(group.ruta, {
        fromIcao: shipment.origen.codigo,
        toIcao: shipment.destino.codigo,
      });
      const routeLabel = buildRouteLabel(routeSegments, shipment);

      for (let bagIndex = start; bagIndex <= end; bagIndex++) {
        items.push({
          id: formatBagCode(shipment, bagIndex),
          shipment,
          shipmentCode,
          bagIndex,
          routeLabel,
          routeSegments,
          assigned: true,
          status,
        });
      }

      nextBagIndex = end + 1;
    });

    for (let bagIndex = nextBagIndex; bagIndex <= totalBags; bagIndex++) {
      items.push({
        id: formatBagCode(shipment, bagIndex),
        shipment,
        shipmentCode,
        bagIndex,
        routeLabel: `${shipment.origen.codigo} > ${shipment.destino.codigo}`,
        routeSegments: [],
        assigned: false,
        status,
      });
    }
  });

  return items;
};

const BaggageDrawer = ({
  shipments,
  idSimulacion,
  referenceMinute,
  simulationStart,
}: BaggageDrawerProps) => {
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
  const airportOptions = Array.from(
    new Set(
      shipments.flatMap((shipment) => [
        shipment.origen.codigo,
        shipment.destino.codigo,
      ])
    )
  ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  const visibleShipments =
    airportFilter === "todos"
      ? visibleShipmentsByMode
      : visibleShipmentsByMode.filter(
          (shipment) =>
            shipment.origen.codigo === airportFilter ||
            shipment.destino.codigo === airportFilter
        );
  const baggageItems = buildVirtualBaggageItems(visibleShipments, shipmentStatus);

  const handleHoursChange = (value: string) => {
    const nextValue = Number(value);
    if (!Number.isFinite(nextValue)) {
      return;
    }

    setDeliveredHours(Math.min(23, Math.max(1, Math.floor(nextValue))));
  };

  const handleOpenShipment = (shipment: BackendSolicitudEnvio) => {
    if (shipment.idEnvio === null) {
      return;
    }

    openShipment(getShipmentApiIdentifier(shipment.idEnvio), {
      idSimulacion,
      displayCodigo: getShipmentCodeLabel(shipment),
    });
  };

  const handleFocusBag = (bag: VirtualBaggageItem) => {
    if (bag.routeSegments.length === 0) {
      focusShipmentRouteSegments([
        {
          fromIcao: bag.shipment.origen.codigo,
          toIcao: bag.shipment.destino.codigo,
        },
      ]);
      return;
    }

    focusShipmentRouteSegments(bag.routeSegments);
  };

  return (
    <DrawerBase title="Panel de maletas" onClose={close}>
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
          Todos ({countBags(shipments)})
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
          En curso ({countBags(inProgressShipments)})
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
          Entregados ({countBags(deliveredShipments)})
        </button>
      </div>

      {mode === "entregados" && (
        <div className="mb-5">
          <label
            htmlFor="baggage-delivered-hours"
            className="block text-label-sm text-text-primary mb-1"
          >
            Últimas horas
          </label>
          <input
            id="baggage-delivered-hours"
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
          htmlFor="baggage-airport-filter"
          className="block text-label-sm text-text-primary mb-1"
        >
          Filtrar por aeropuerto
        </label>
        <select
          id="baggage-airport-filter"
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

      {baggageItems.length === 0 ? (
        <p className="text-body text-text-primary">
          No hay maletas registradas para esta vista.
        </p>
      ) : (
        <ul className="space-y-2">
          {baggageItems.map((bag) => {
            const canOpen = bag.shipment.idEnvio !== null;
            const legs = bag.routeSegments.length;

            return (
              <li
                key={bag.id}
                className="rounded-input border border-border bg-card px-3 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-button text-text-primary">
                      {bag.id}
                    </p>
                    <p className="mt-1 text-secondary text-text-primary">
                      {bag.routeLabel}
                    </p>
                    <p className="mt-1 text-secondary text-text-primary">
                      {bag.assigned ? `${legs} tramo(s) de ruta` : "Sin ruta asignada"}
                    </p>
                    {canOpen ? (
                      <button
                        type="button"
                        className="mt-2 text-secondary text-primary hover:underline"
                        onClick={() => handleOpenShipment(bag.shipment)}
                      >
                        Ver envío completo ({bag.shipmentCode})
                      </button>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <button
                      type="button"
                      onClick={() => handleFocusBag(bag)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-primary bg-card text-primary transition-colors hover:bg-primary/10"
                      aria-label={`Enfocar ruta de ${bag.id} en el mapa`}
                      title="Ver ruta en el mapa"
                    >
                      <Eye size={16} strokeWidth={2.2} aria-hidden />
                    </button>
                    <Tag
                      variant={bag.status === "entregados" ? "normal" : "primary"}
                    >
                      {getStatusLabel(bag.shipment, bag.status)}
                    </Tag>
                    <span className="text-secondary text-text-primary">
                      #{bag.bagIndex.toLocaleString("es-PE")}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </DrawerBase>
  );
};

export default BaggageDrawer;
