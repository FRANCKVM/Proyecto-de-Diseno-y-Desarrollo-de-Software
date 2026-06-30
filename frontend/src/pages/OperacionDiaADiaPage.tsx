import { useEffect, useMemo, useState } from "react";
import TopBar from "@/components/organisms/TopBar";
import WorldMap from "@/components/map/WorldMap";
import DrawerHost from "@/components/organisms/DrawerHost";
import MapQuickActions from "@/components/organisms/MapQuickActions";
import { OCCUPANCY_NORMAL } from "@/services/sources2.0/demoOccupancy.mock";
import { useAirports } from "@/hooks/useAirports";
import { useFlightSimulation } from "@/hooks/useFlightSimulation";
import { useOperationData } from "@/hooks/useOperationData";
import { useDrawerStore } from "@/store/drawerStore";
import { getShipmentRouteGroups } from "@/utils/shipmentAssignments";
import { USE_MOCK_DATA } from "@/utils/constants";
import { formatStartDateTime } from "@/utils/simulationClock";
import {
  buildEmptyMapFlights,
  mergeMapFlights,
} from "@/utils/mapFlightHelpers";
import {
  getFlightOccupancyMetric,
  getWarehouseOccupancyMetric,
} from "@/utils/capacityMetrics";
import type {
  BackendSolicitudEnvio,
  BackendVuelo,
} from "@/types/backendSimulation.types";

const DAY_MINUTES = 24 * 60;

const getUtcDateKey = (date: Date): string => date.toISOString().slice(0, 10);

const parseShipmentUtcMinute = (shipment: BackendSolicitudEnvio): number => {
  const [hour = "0", minute = "0"] = (shipment.hora ?? "00:00").split(":");
  return Number(hour) * 60 + Number(minute);
};

const getUtcMinutesSinceShipmentDay = (
  now: Date,
  shipment: BackendSolicitudEnvio
): number => {
  const shipmentDayMs = Date.parse(`${shipment.fecha}T00:00:00Z`);

  if (Number.isNaN(shipmentDayMs)) {
    return 0;
  }

  return Math.floor((now.getTime() - shipmentDayMs) / 60_000);
};

const getNextFlightWindow = (
  earliestMinute: number,
  flight: BackendVuelo
): { departure: number; arrival: number } => {
  const departureBase = flight.salidaUtcMin ?? 0;
  let arrivalBase = flight.llegadaUtcMin ?? departureBase;

  while (arrivalBase <= departureBase) {
    arrivalBase += DAY_MINUTES;
  }

  const duration = arrivalBase - departureBase;
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

const isShipmentDelivered = (
  shipment: BackendSolicitudEnvio,
  now: Date
): boolean => {
  const routeGroups = getShipmentRouteGroups(shipment);

  if (routeGroups.length === 0) {
    return false;
  }

  let lastArrival: number | null = null;

  for (const group of routeGroups) {
    let earliestDeparture = parseShipmentUtcMinute(shipment);

    for (const flight of group.ruta?.vuelos ?? []) {
      const window = getNextFlightWindow(earliestDeparture, flight);
      earliestDeparture = window.arrival;
      lastArrival =
        lastArrival === null ? window.arrival : Math.max(lastArrival, window.arrival);
    }
  }

  return lastArrival !== null && getUtcMinutesSinceShipmentDay(now, shipment) >= lastArrival;
};

const buildOperationKpis = (
  shipments: BackendSolicitudEnvio[],
  activeFlights: number,
  now: Date
) => {
  const todayUtc = getUtcDateKey(now);
  const delivered = shipments.filter((shipment) =>
    isShipmentDelivered(shipment, now)
  ).length;

  return {
    enviosHoy: shipments.filter((shipment) => shipment.fecha === todayUtc).length,
    enTransito: activeFlights,
    entregadas: delivered,
    cumplimiento:
      shipments.length === 0 ? 100 : Math.round((delivered * 100) / shipments.length),
  };
};

/**
 * Pantalla de operacion dia a dia.
 * Estandar 61, seccion 5.5 + mockup 08.
 *
 * Densidad de vuelos alta (25). Drawers wireados.
 */
const OperacionDiaADiaPage = () => {
  const { airports, isLoading } = useAirports();
  const { mapa, envios, refresh } = useOperationData();
  const [systemDate, setSystemDate] = useState(() => new Date());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setSystemDate(new Date());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const animatedFlights = useFlightSimulation({
    baseFlightCount: 25,
    scaleByDemand: false,
    backendShipments: USE_MOCK_DATA ? undefined : envios,
  });
  const backendMapFlights = useMemo(
    () =>
      buildEmptyMapFlights(mapa?.vuelos ?? [], {
        shipments: envios,
        nowMs: systemDate.getTime(),
      }),
    [envios, mapa?.vuelos, systemDate]
  );
  const flights = useMemo(
    () => mergeMapFlights(animatedFlights, backendMapFlights),
    [animatedFlights, backendMapFlights]
  );
  const operationKpis = buildOperationKpis(envios, flights.length, systemDate);

  const occupancy = USE_MOCK_DATA
    ? OCCUPANCY_NORMAL
    : (mapa?.ocupacionPorAeropuerto ?? {});
  const capacityKpis = useMemo(
    () => ({
      ocupacionAviones: getFlightOccupancyMetric(flights),
      ocupacionAlmacenes: getWarehouseOccupancyMetric(occupancy),
    }),
    [flights, occupancy]
  );

  const openAirport = useDrawerStore((s) => s.openAirport);
  const openFlight = useDrawerStore((s) => s.openFlight);
  const openWarehouseList = useDrawerStore((s) => s.openWarehouseList);
  const openShipmentsPanel = useDrawerStore((s) => s.openShipmentsPanel);
  const openBaggagePanel = useDrawerStore((s) => s.openBaggagePanel);
  const openActiveFlightsPanel = useDrawerStore((s) => s.openActiveFlightsPanel);
  const focusedAirportIcao = useDrawerStore((s) => s.focusedAirportIcao);
  const focusedFlightId = useDrawerStore((s) => s.focusedFlightId);
  const warehouseRegionFilter = useDrawerStore((s) => s.warehouseRegionFilter);
  const warehouseSemaphoreFilter = useDrawerStore(
    (s) => s.warehouseSemaphoreFilter
  );
  const activeFlightRegionFilter = useDrawerStore(
    (s) => s.activeFlightRegionFilter
  );
  const activeFlightSemaphoreFilter = useDrawerStore(
    (s) => s.activeFlightSemaphoreFilter
  );
  const activeFlightOnlyId = useDrawerStore((s) => s.activeFlightOnlyId);
  const shipmentRouteSegments = useDrawerStore((s) => s.shipmentRouteSegments);

  return (
    <>
      <main className="flex-1 min-h-0 bg-map-bg relative">
        <TopBar
          variant="dia-a-dia"
          fechaActual={formatStartDateTime(systemDate)}
          kpis={{
            enviosHoy: USE_MOCK_DATA ? 23 : operationKpis.enviosHoy,
            ...capacityKpis,
          }}
        />
        {!isLoading && (
          <WorldMap
            airports={airports}
            flights={flights}
            occupancyByIcao={occupancy}
            focusedAirportIcao={focusedAirportIcao}
            focusedFlightId={focusedFlightId}
            warehouseRegionFilter={warehouseRegionFilter}
            warehouseSemaphoreFilter={warehouseSemaphoreFilter}
            activeFlightRegionFilter={activeFlightRegionFilter}
            activeFlightSemaphoreFilter={activeFlightSemaphoreFilter}
            activeFlightOnlyId={activeFlightOnlyId}
            flightCancellationEvents={mapa?.cancelacionesRecientes ?? []}
            shipmentRouteSegments={shipmentRouteSegments}
            onAirportClick={(a) => openAirport(a.icao)}
            onFlightClick={(id) => openFlight(id)}
          />
        )}
        <MapQuickActions
          onOpenActiveFlights={openActiveFlightsPanel}
          onOpenWarehouses={openWarehouseList}
          onOpenShipments={openShipmentsPanel}
          onOpenBaggage={openBaggagePanel}
        />
        <DrawerHost
          occupancyByIcao={occupancy}
          airports={airports}
          shipments={envios}
          activeFlights={flights}
          onShipmentCreated={refresh}
        />
      </main>
    </>
  );
};

export default OperacionDiaADiaPage;
