import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "@/components/organisms/TopBar";
import LegendBar from "@/components/organisms/LegendBar";
import WorldMap from "@/components/map/WorldMap";
import DrawerHost from "@/components/organisms/DrawerHost";
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
import { useSimulationConfigStore } from "@/store/simulationConfigStore";
import {
  formatDuration,
  resolveSimulationClockData,
} from "@/utils/simulationClock";

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
    envios,
  } = useLiveSimulation({ autoStart: true, enablePolling: false });

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
    baseFlightCount: 25,
    scaleByDemand: true,
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
  const occupancy = USE_MOCK_DATA ? OCCUPANCY_COLAPSO : occupancyByIcao;

  const { simulatedDay, demandFactor } = useSimulationControlStore();
  const openAirport = useDrawerStore((s) => s.openAirport);
  const openFlight = useDrawerStore((s) => s.openFlight);
  const openWarehouseList = useDrawerStore((s) => s.openWarehouseList);
  const openShipmentsPanel = useDrawerStore((s) => s.openShipmentsPanel);
  const openActiveFlightsPanel = useDrawerStore((s) => s.openActiveFlightsPanel);
  const focusedAirportIcao = useDrawerStore((s) => s.focusedAirportIcao);
  const focusedFlightId = useDrawerStore((s) => s.focusedFlightId);
  const warehouseRegionFilter = useDrawerStore((s) => s.warehouseRegionFilter);
  const activeFlightRegionFilter = useDrawerStore(
    (s) => s.activeFlightRegionFilter
  );
  const activeFlightSemaphoreFilter = useDrawerStore(
    (s) => s.activeFlightSemaphoreFilter
  );
  const activeFlightOnlyId = useDrawerStore((s) => s.activeFlightOnlyId);
  const shipmentRouteSegments = useDrawerStore((s) => s.shipmentRouteSegments);
  const porcentajeResueltas = estado?.porcentajeResueltas ?? 0;
  const totalSolicitudes = estado?.totalSolicitudes ?? 0;
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
      <TopBar
        variant="colapso"
        reloj={{
          inicioSimulacion,
          horaActual,
          horaSimulacion,
          tiempoRealTranscurrido: formatDuration(elapsedRealMs),
          tiempoSimulacionTranscurrido: formatDuration(elapsedSimulatedMs),
        }}
        diaSimulado={USE_MOCK_DATA ? simulatedDay : estado?.bloquesProcesados ?? 0}
        demanda={USE_MOCK_DATA ? `x ${demandFactor.toFixed(1)}` : `k=${estado?.k ?? 1}`}
        enviosTotales={USE_MOCK_DATA ? 12450 : totalSolicitudes}
        cumplimiento={
          USE_MOCK_DATA ? "88 %" : `${Math.round(porcentajeResueltas)} %`
        }
        estado={USE_MOCK_DATA ? "COLAPSO" : estado?.activa ? "ACTIVA" : "DETENIDA"}
        onOpenWarehouses={openWarehouseList}
        onOpenShipments={openShipmentsPanel}
        onOpenActiveFlights={openActiveFlightsPanel}
      />
      <main className="flex-1 min-h-0 bg-map-bg relative">
        {!isLoading && (
          <WorldMap
            airports={airports}
            flights={flights}
            occupancyByIcao={occupancy}
            rangosSemaforo={rangosSemaforo}
            focusedAirportIcao={focusedAirportIcao}
            focusedFlightId={focusedFlightId}
            warehouseRegionFilter={warehouseRegionFilter}
            activeFlightRegionFilter={activeFlightRegionFilter}
            activeFlightSemaphoreFilter={activeFlightSemaphoreFilter}
            activeFlightOnlyId={activeFlightOnlyId}
            shipmentRouteSegments={shipmentRouteSegments}
            onAirportClick={(a) => openAirport(a.icao)}
            onFlightClick={(id) => openFlight(id, { idSimulacion })}
          />
        )}

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
      <LegendBar variant="colapso" />
    </>
  );
};

export default SimulacionColapsoPage;
