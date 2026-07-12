import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "@/components/organisms/TopBar";
import WorldMap from "@/components/map/WorldMap";
import DrawerHost from "@/components/organisms/DrawerHost";
import MapQuickActions from "@/components/organisms/MapQuickActions";
import { OCCUPANCY_COLAPSO } from "@/services/sources2.0/demoOccupancy.mock";
import { useAirports } from "@/hooks/useAirports";
import { useFlightSimulation } from "@/hooks/useFlightSimulation";
import { useLiveSimulation } from "@/hooks/useLiveSimulation";
import { useSimulationControlStore } from "@/store/simulationControlStore";
import { useDrawerStore } from "@/store/drawerStore";
import {
  BACKEND_SIMULATION_BLOCK_INTERVAL_MS,
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
 * Pantalla de simulacion al colapso.
 * Estandar 61, seccion 5.6 + mockup 09.
 *
 * Densidad alta y escalable por demanda. Drawers wireados.
 */
const SimulacionColapsoPage = () => {
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
    envios,
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
    baseFlightCount: USE_MOCK_DATA ? 25 : 0,
    scaleByDemand: true,
  });
  const flights = useMemo(
    () => mergeMapFlights(animatedFlights, backendMapFlights),
    [animatedFlights, backendMapFlights]
  );
  const occupancy = USE_MOCK_DATA ? OCCUPANCY_COLAPSO : occupancyByIcao;
  const capacityKpis = useMemo(
    () => ({
      ocupacionAviones: getFlightOccupancyMetric(flights, rangosSemaforo),
      ocupacionAlmacenes: getWarehouseOccupancyMetric(occupancy, rangosSemaforo),
    }),
    [flights, occupancy, rangosSemaforo]
  );

  const { simulatedDay, demandFactor } = useSimulationControlStore();
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
  const liveReferenceMinute = USE_MOCK_DATA
    ? undefined
    : Math.floor(elapsedSimulatedMs / 60_000);

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
          variant="colapso"
          reloj={{
            inicioSimulacion,
            fechaHoraActual,
            fechaSimulacionActual,
            horaActual,
            horaSimulacion,
            tiempoRealTranscurrido: formatDuration(elapsedRealMs),
            tiempoSimulacionTranscurrido: formatDuration(elapsedSimulatedMs),
          }}
          diaSimulado={USE_MOCK_DATA ? simulatedDay : estado?.bloquesProcesados ?? 0}
          demanda={USE_MOCK_DATA ? `x ${demandFactor.toFixed(1)}` : `k=${estado?.k ?? 1}`}
          estado={USE_MOCK_DATA ? "COLAPSO" : estado?.activa ? "ACTIVA" : "DETENIDA"}
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
            activeFlightOnlyId={activeFlightOnlyId}
            flightCancellationEvents={mapa?.cancelacionesRecientes ?? []}
            shipmentRouteSegments={shipmentRouteSegments}
            onAirportClick={(a) => openAirport(a.icao)}
            onFlightClick={(id) => openFlight(`occ-${id}`, { idSimulacion })}
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
          rangosSemaforo={rangosSemaforo}
          idSimulacion={idSimulacion}
          shipments={envios}
          activeFlights={flights}
          referenceMinute={liveReferenceMinute}
          simulationStart={estado?.fechaHoraInicioSimulacion}
        />
      </main>
    </>
  );
};

export default SimulacionColapsoPage;
