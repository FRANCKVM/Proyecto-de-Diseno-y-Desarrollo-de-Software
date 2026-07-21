import { useCallback, useEffect, useMemo, useState } from "react";
import TopBar from "@/components/organisms/TopBar";
import WorldMap from "@/components/map/WorldMap";
import SimulationControlPanel from "@/components/organisms/SimulationControlPanel";
import DrawerHost from "@/components/organisms/DrawerHost";
import MapQuickActions from "@/components/organisms/MapQuickActions";
import { OCCUPANCY_NORMAL } from "@/services/sources2.0/demoOccupancy.mock";
import { useAirports } from "@/hooks/useAirports";
import { useFlightSimulation } from "@/hooks/useFlightSimulation";
import { useLiveSimulation } from "@/hooks/useLiveSimulation";
import { useSimulationControlStore } from "@/store/simulationControlStore";
import { useDrawerStore } from "@/store/drawerStore";
import { useNavigate } from "react-router-dom";
import {
  BACKEND_SIMULATION_BLOCK_INTERVAL_MS,
  DURACION_SIMULACION_SEMANAL_DIAS,
  USE_MOCK_DATA,
} from "@/utils/constants";
import { resolveSimulationResultsRoute } from "@/utils/routes";
import { mergeMapFlights } from "@/utils/mapFlightHelpers";
import { useSimulationConfigStore } from "@/store/simulationConfigStore";
import {
  formatDuration,
  resolveSimulationClockData,
} from "@/utils/simulationClock";
import {
  getFlightOccupancyMetric,
  getWarehouseOccupancyMetric,
} from "@/utils/capacityMetrics";

/**
 * Pantalla de simulacion en ejecucion.
 * Estandar 61, seccion 5.3 + mockups 03/04/05.
 *
 * Densidad de vuelos media (15). Drawers wireados al store.
 */
const SimulacionEjecucionPage = () => {
  const navigate = useNavigate();
  const { airports, isLoading } = useAirports();
  const fechaInicioConfig = useSimulationConfigStore((s) => s.fechaInicio);
  const horaInicioConfig = useSimulationConfigStore((s) => s.horaInicio);
  const rangosSemaforo = useSimulationConfigStore((s) => s.rangos);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const {
    idSimulacion,
    tipoSimulacion,
    occupancyByIcao,
    estado,
    mapa,
    shipmentsRefreshVersion,
    flights: backendMapFlights,
  } = useLiveSimulation({ autoStart: true, pollingMode: "sse" });

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const backendBlockIntervalMs =
    estado?.intervaloRealMs ?? BACKEND_SIMULATION_BLOCK_INTERVAL_MS;

  const animatedFlights = useFlightSimulation({
    baseFlightCount: USE_MOCK_DATA ? 15 : 0,
    scaleByDemand: false,
  });
  const flights = useMemo(
    () => mergeMapFlights(animatedFlights, backendMapFlights),
    [animatedFlights, backendMapFlights]
  );
  const occupancy = USE_MOCK_DATA ? OCCUPANCY_NORMAL : occupancyByIcao;
  const capacityKpis = useMemo(
    () => ({
      ocupacionAviones: getFlightOccupancyMetric(flights, rangosSemaforo),
      ocupacionAlmacenes: getWarehouseOccupancyMetric(occupancy, rangosSemaforo),
    }),
    [flights, occupancy, rangosSemaforo]
  );

  const simulatedDay = useSimulationControlStore((s) => s.simulatedDay);
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

  const {
    elapsedRealMs,
    elapsedSimulatedMs,
    inicioSimulacion,
    fechaHoraActual,
    fechaSimulacionActual,
    horaActual,
    horaSimulacion,
  } = resolveSimulationClockData({
    estado,
    fechaInicio: fechaInicioConfig,
    horaInicio: horaInicioConfig,
    nowMs,
    useMockData: USE_MOCK_DATA,
    backendBlockIntervalMs,
  });
  const diaActualBackend =
    elapsedSimulatedMs > 0
      ? Math.floor(elapsedSimulatedMs / (24 * 60 * 60_000)) + 1
      : estado?.punteroConsumoMinutos !== null &&
          estado?.punteroConsumoMinutos !== undefined
        ? Math.floor(estado.punteroConsumoMinutos / (24 * 60)) + 1
        : null;
  const diaActual = USE_MOCK_DATA
    ? simulatedDay
    : Math.min(DURACION_SIMULACION_SEMANAL_DIAS, diaActualBackend ?? 1);
  const liveReferenceMinute = USE_MOCK_DATA
    ? undefined
    : Math.floor(elapsedSimulatedMs / 60_000);
  const flightCancellationEvents = useMemo(
    () => mapa?.cancelacionesRecientes ?? [],
    [mapa?.cancelacionesRecientes]
  );

  const handleAirportClick = useCallback(
    (airport: { icao: string }) => openAirport(airport.icao),
    [openAirport]
  );
  const handleFlightClick = useCallback(
    (id: string) => openFlight(`occ-${id}`, { idSimulacion }),
    [idSimulacion, openFlight]
  );

  useEffect(() => {
    if (
      USE_MOCK_DATA ||
      idSimulacion === null ||
      !estado ||
      estado.activa
    ) {
      return;
    }

    navigate(resolveSimulationResultsRoute(tipoSimulacion, idSimulacion), {
      replace: true,
    });
  }, [estado, idSimulacion, navigate, tipoSimulacion]);

  return (
    <>
      <main className="flex-1 min-h-0 bg-map-bg relative">
        <TopBar
          variant="ejecucion"
          reloj={{
            inicioSimulacion,
            fechaHoraActual,
            fechaSimulacionActual,
            horaActual,
            horaSimulacion,
            tiempoRealTranscurrido: formatDuration(elapsedRealMs),
            tiempoSimulacionTranscurrido: formatDuration(elapsedSimulatedMs),
          }}
          dia={{
            actual: diaActual,
            total: DURACION_SIMULACION_SEMANAL_DIAS,
          }}
          kpis={capacityKpis}
        />
        {!isLoading && (
          <WorldMap
            airports={airports}
            flights={flights}
            occupancyByIcao={occupancy}
            rangosSemaforo={rangosSemaforo}
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
        <SimulationControlPanel variant="ejecucion" />
        <DrawerHost
          occupancyByIcao={occupancy}
          airports={airports}
          rangosSemaforo={rangosSemaforo}
          idSimulacion={idSimulacion}
          shipmentsRefreshKey={shipmentsRefreshVersion}
          activeFlights={flights}
          referenceMinute={liveReferenceMinute}
          simulationStart={estado?.fechaHoraInicioSimulacion}
        />
      </main>
    </>
  );
};

export default SimulacionEjecucionPage;
