import { useEffect, useState } from "react";
import TopBar from "@/components/organisms/TopBar";
import LegendBar from "@/components/organisms/LegendBar";
import WorldMap from "@/components/map/WorldMap";
import DrawerHost from "@/components/organisms/DrawerHost";
import { OCCUPANCY_NORMAL } from "@/services/sources2.0/demoOccupancy.mock";
import { useAirports } from "@/hooks/useAirports";
import { useFlightSimulation } from "@/hooks/useFlightSimulation";
import { useOperationData } from "@/hooks/useOperationData";
import { useDrawerStore } from "@/store/drawerStore";
import { getFlightByCode } from "@/services/flightService";
import { USE_MOCK_DATA } from "@/utils/constants";
import type {
  BackendSolicitudEnvio,
  BackendVuelo,
} from "@/types/backendSimulation.types";

const DAY_MINUTES = 24 * 60;

const formatOperationDateTime = (date: Date): string => {
  const datePart = new Intl.DateTimeFormat("es-PE", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);

  const timePart = new Intl.DateTimeFormat("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date);

  return `${datePart} | ${timePart} UTC`;
};

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
  const routeFlights = shipment.ruta?.vuelos ?? [];

  if (routeFlights.length === 0) {
    return false;
  }

  let earliestDeparture = parseShipmentUtcMinute(shipment);
  let lastArrival = earliestDeparture;

  for (const flight of routeFlights) {
    const window = getNextFlightWindow(earliestDeparture, flight);
    earliestDeparture = window.arrival;
    lastArrival = window.arrival;
  }

  return getUtcMinutesSinceShipmentDay(now, shipment) >= lastArrival;
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
  const [flightQuery, setFlightQuery] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearchingFlight, setIsSearchingFlight] = useState(false);
  const [systemDate, setSystemDate] = useState(() => new Date());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setSystemDate(new Date());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const flights = useFlightSimulation({
    baseFlightCount: 25,
    scaleByDemand: false,
    backendShipments: USE_MOCK_DATA ? undefined : envios,
  });
  const operationKpis = buildOperationKpis(envios, flights.length, systemDate);

  const occupancy = USE_MOCK_DATA
    ? OCCUPANCY_NORMAL
    : (mapa?.ocupacionPorAeropuerto ?? {});

  const openAirport = useDrawerStore((s) => s.openAirport);
  const openFlight = useDrawerStore((s) => s.openFlight);
  const openShipmentForm = useDrawerStore((s) => s.openShipmentForm);
  const openWarehouseList = useDrawerStore((s) => s.openWarehouseList);
  const openShipmentsPanel = useDrawerStore((s) => s.openShipmentsPanel);
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

  const handleRegistrarEnvio = () => {
    openShipmentForm();
  };

  const handleFlightQueryChange = (value: string) => {
    setFlightQuery(value);
    if (searchError) {
      setSearchError(null);
    }
  };

  const handleFlightSearch = async () => {
    const codigo = flightQuery.trim().toUpperCase();

    if (!codigo) {
      setSearchError("Ingresa un identificador de vuelo.");
      return;
    }

    setIsSearchingFlight(true);
    setSearchError(null);

    try {
      const flight = await getFlightByCode(codigo);

      if (!flight) {
        setSearchError("No se encontro ese vuelo.");
        return;
      }

      openFlight(flight.codigo);
      setFlightQuery(flight.codigo);
    } finally {
      setIsSearchingFlight(false);
    }
  };

  return (
    <>
      <TopBar
        variant="dia-a-dia"
        fechaActual={formatOperationDateTime(systemDate)}
        kpis={{
          enviosHoy: USE_MOCK_DATA ? 23 : operationKpis.enviosHoy,
          enTransito: USE_MOCK_DATA ? flights.length : operationKpis.enTransito,
          entregadas: USE_MOCK_DATA ? 89 : operationKpis.entregadas,
          cumplimiento: USE_MOCK_DATA
            ? "100%"
            : `${operationKpis.cumplimiento}%`,
        }}
        buscador={{
          valor: flightQuery,
          error: searchError,
          isLoading: isSearchingFlight,
          onChange: handleFlightQueryChange,
          onSubmit: () => {
            void handleFlightSearch();
          },
        }}
        onOpenWarehouses={openWarehouseList}
        onOpenShipments={openShipmentsPanel}
        onOpenActiveFlights={openActiveFlightsPanel}
        onRegistrarEnvio={handleRegistrarEnvio}
      />
      <main className="flex-1 min-h-0 bg-map-bg relative">
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
            shipmentRouteSegments={shipmentRouteSegments}
            onAirportClick={(a) => openAirport(a.icao)}
            onFlightClick={(id) => openFlight(id)}
          />
        )}
        <DrawerHost
          occupancyByIcao={occupancy}
          airports={airports}
          shipments={envios}
          activeFlights={flights}
          onShipmentCreated={refresh}
        />
      </main>
      <LegendBar variant="dia-a-dia" />
    </>
  );
};

export default OperacionDiaADiaPage;
