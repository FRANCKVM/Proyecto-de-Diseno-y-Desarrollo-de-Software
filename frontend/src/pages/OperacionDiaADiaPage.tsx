import { useCallback, useEffect, useMemo, useState } from "react";
import TopBar from "@/components/organisms/TopBar";
import WorldMap from "@/components/map/WorldMap";
import DrawerHost from "@/components/organisms/DrawerHost";
import MapQuickActions from "@/components/organisms/MapQuickActions";
import { OCCUPANCY_NORMAL } from "@/services/sources2.0/demoOccupancy.mock";
import { useAirports } from "@/hooks/useAirports";
import { useFlightSimulation } from "@/hooks/useFlightSimulation";
import { useOperationData } from "@/hooks/useOperationData";
import { useDrawerStore } from "@/store/drawerStore";
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

/**
 * Pantalla de operacion dia a dia.
 * Estandar 61, seccion 5.5 + mockup 08.
 *
 * Densidad de vuelos alta (25). Drawers wireados.
 */
const OperacionDiaADiaPage = () => {
  const { airports, isLoading } = useAirports();
  const { estado, mapa, refresh, refreshVersion } = useOperationData();
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
    baseFlightCount: USE_MOCK_DATA ? 25 : 0,
    scaleByDemand: false,
  });
  const backendMapFlights = useMemo(
    () =>
      buildEmptyMapFlights(mapa?.vuelos ?? []),
    [mapa?.vuelos]
  );
  const flights = useMemo(
    () => mergeMapFlights(animatedFlights, backendMapFlights),
    [animatedFlights, backendMapFlights]
  );
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
  const activeFlightAirportFilter = useDrawerStore(
    (s) => s.activeFlightAirportFilter
  );
  const activeFlightStatusFilter = useDrawerStore(
    (s) => s.activeFlightStatusFilter
  );
  const activeFlightSearchFilter = useDrawerStore(
    (s) => s.activeFlightSearchFilter
  );
  const activeFlightOnlyId = useDrawerStore((s) => s.activeFlightOnlyId);
  const shipmentRouteSegments = useDrawerStore((s) => s.shipmentRouteSegments);
  const handleAirportClick = useCallback(
    (airport: { icao: string }) => openAirport(airport.icao),
    [openAirport]
  );
  const handleFlightClick = useCallback(
    (id: string) => openFlight(`occ-${id}`),
    [openFlight]
  );
  const flightCancellationEvents = useMemo(
    () => mapa?.cancelacionesRecientes ?? [],
    [mapa?.cancelacionesRecientes]
  );

  return (
    <>
      <main className="flex-1 min-h-0 bg-map-bg relative">
        <TopBar
          variant="dia-a-dia"
          fechaActual={formatStartDateTime(systemDate)}
          kpis={{
            enviosHoy: USE_MOCK_DATA ? 23 : estado?.enviosHoy ?? 0,
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
            activeFlightAirportFilter={activeFlightAirportFilter}
            activeFlightStatusFilter={activeFlightStatusFilter}
            activeFlightSearchFilter={activeFlightSearchFilter}
            activeFlightOnlyId={activeFlightOnlyId}
            flightCancellationEvents={flightCancellationEvents}
            shipmentRouteSegments={shipmentRouteSegments}
            onAirportClick={handleAirportClick}
            onFlightClick={handleFlightClick}
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
          shipmentsRefreshKey={refreshVersion}
          activeFlights={flights}
          onShipmentCreated={refresh}
        />
      </main>
    </>
  );
};

export default OperacionDiaADiaPage;
