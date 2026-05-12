import { useEffect } from "react";
import TopBar from "@/components/organisms/TopBar";
import LegendBar from "@/components/organisms/LegendBar";
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

/**
 * Pantalla de simulacion en ejecucion.
 * Estandar 61, seccion 5.3 + mockups 03/04/05.
 *
 * Densidad de vuelos media (15). Drawers wireados al store.
 */
const SimulacionEjecucionPage = () => {
  const navigate = useNavigate();
  const { airports, isLoading } = useAirports();
  const {
    idSimulacion,
    tipoSimulacion,
    occupancyByIcao,
    estado,
    envios,
    stop,
  } = useLiveSimulation({ autoStart: true, enablePolling: false });

  const backendSimMinutesPerSecond =
    estado?.scMinutos && BACKEND_SIMULATION_BLOCK_INTERVAL_MS > 0
      ? estado.scMinutos / (BACKEND_SIMULATION_BLOCK_INTERVAL_MS / 1000)
      : undefined;

  const flights = useFlightSimulation({
    baseFlightCount: 15,
    scaleByDemand: false,
    backendShipments: USE_MOCK_DATA ? undefined : envios,
    backendClockMinutes: USE_MOCK_DATA
      ? undefined
      : estado?.punteroConsumoMinutos,
    backendSimMinutesPerSecond: USE_MOCK_DATA
      ? undefined
      : backendSimMinutesPerSecond,
  });
  const occupancy = USE_MOCK_DATA ? OCCUPANCY_NORMAL : occupancyByIcao;

  const simulatedDay = useSimulationControlStore((s) => s.simulatedDay);
  const openAirport = useDrawerStore((s) => s.openAirport);
  const openFlight = useDrawerStore((s) => s.openFlight);

  const totalSolicitudes = estado?.totalSolicitudes ?? envios.length;
  const porcentajeResueltas = estado?.porcentajeResueltas ?? 0;
  const resueltas = estado?.resueltas ?? 0;
  const noResueltas = estado?.noResueltas ?? 0;
  const diaActualBackend =
    estado?.punteroConsumoMinutos !== null &&
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
      <TopBar
        variant="ejecucion"
        fechaSimulada={
          USE_MOCK_DATA
            ? "Mie 09/04/2026 14:30"
            : `Simulacion #${estado?.idSimulacion ?? "-"}`
        }
        dia={{
          actual: diaActual,
          total: DURACION_SIMULACION_SEMANAL_DIAS,
        }}
        tiempoReal={{
          transcurrido: `${estado?.bloquesProcesados ?? 0} bloques`,
          estimado: `${estado?.totalSolicitudesCargadas ?? totalSolicitudes} envios`,
        }}
        kpis={{
          entregas: `${Math.round(porcentajeResueltas)}%`,
          enTransito: flights.length,
          entregadas: resueltas,
          cancelados: noResueltas,
        }}
        onPausar={() => {
          if (!USE_MOCK_DATA) {
            void stop();
          }
        }}
      />
      <main className="flex-1 min-h-0 bg-map-bg relative">
        {!isLoading && (
          <WorldMap
            airports={airports}
            flights={flights}
            occupancyByIcao={occupancy}
            onAirportClick={(a) => openAirport(a.icao)}
            onFlightClick={(id) => openFlight(id)}
          />
        )}
        <SimulationControlPanel variant="ejecucion" />
        <DrawerHost occupancyByIcao={occupancy} airports={airports} />
      </main>
      <LegendBar variant="simulacion" />
    </>
  );
};

export default SimulacionEjecucionPage;
