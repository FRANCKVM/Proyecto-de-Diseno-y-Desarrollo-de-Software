import { useEffect, useState } from "react";
import TopBar from "@/components/organisms/TopBar";
import WorldMap from "@/components/map/WorldMap";
import SimulationControlPanel from "@/components/organisms/SimulationControlPanel";
import DrawerHost from "@/components/organisms/DrawerHost";
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
import { useSimulationConfigStore } from "@/store/simulationConfigStore";
import {
  formatDuration,
  resolveSimulationClockData,
} from "@/utils/simulationClock";

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
    envios,
  } = useLiveSimulation({ autoStart: true, enablePolling: true });

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

  const backendSimMinutesPerSecond =
    estado?.scMinutos && backendBlockIntervalMs > 0
      ? estado.scMinutos / (backendBlockIntervalMs / 1000)
      : undefined;

  const flights = useFlightSimulation({
    baseFlightCount: 15,
    scaleByDemand: false,
    backendShipments: USE_MOCK_DATA ? undefined : envios,
    backendClockMinutes: USE_MOCK_DATA
      ? undefined
      : estado?.punteroConsumoMinutos,
    backendSimulationStart: USE_MOCK_DATA
      ? undefined
      : estado?.fechaHoraInicioSimulacion,
    backendSimMinutesPerSecond: USE_MOCK_DATA
      ? undefined
      : backendSimMinutesPerSecond,
  });
  const occupancy = USE_MOCK_DATA ? OCCUPANCY_NORMAL : occupancyByIcao;

  const simulatedDay = useSimulationControlStore((s) => s.simulatedDay);
  const openAirport = useDrawerStore((s) => s.openAirport);
  const openFlight = useDrawerStore((s) => s.openFlight);
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

  const porcentajeResueltas = estado?.porcentajeResueltas ?? 0;
  const resueltas = estado?.resueltas ?? 0;
  const {
    elapsedRealMs,
    elapsedSimulatedMs,
    inicioSimulacion,
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
            horaActual,
            horaSimulacion,
            tiempoRealTranscurrido: formatDuration(elapsedRealMs),
            tiempoSimulacionTranscurrido: formatDuration(elapsedSimulatedMs),
          }}
          dia={{
            actual: diaActual,
            total: DURACION_SIMULACION_SEMANAL_DIAS,
          }}
          kpis={{
            entregas: `${Math.round(porcentajeResueltas)}%`,
            enTransito: flights.length,
            entregadas: resueltas,
          }}
          onOpenWarehouses={openWarehouseList}
          onOpenShipments={openShipmentsPanel}
          onOpenActiveFlights={openActiveFlightsPanel}
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
            shipmentRouteSegments={shipmentRouteSegments}
            onAirportClick={(a) => openAirport(a.icao)}
            onFlightClick={(id) => openFlight(id, { idSimulacion })}
          />
        )}
        <SimulationControlPanel variant="ejecucion" />
        <DrawerHost
          occupancyByIcao={occupancy}
          airports={airports}
          rangosSemaforo={rangosSemaforo}
          idSimulacion={idSimulacion}
          shipments={envios}
          activeFlights={flights}
          referenceMinute={estado?.punteroConsumoMinutos}
        />
      </main>
    </>
  );
};

export default SimulacionEjecucionPage;
