import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "@/components/organisms/TopBar";
import LegendBar from "@/components/organisms/LegendBar";
import WorldMap from "@/components/map/WorldMap";
import AlertBanner from "@/components/molecules/AlertBanner";
import SimulationControlPanel from "@/components/organisms/SimulationControlPanel";
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

/**
 * Pantalla de simulacion al colapso.
 * Estandar 61, seccion 5.6 + mockup 09.
 *
 * Densidad alta y escalable por demanda. Drawers wireados.
 */
const SimulacionColapsoPage = () => {
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
    baseFlightCount: 25,
    scaleByDemand: true,
    backendShipments: USE_MOCK_DATA ? undefined : envios,
    backendClockMinutes: USE_MOCK_DATA
      ? undefined
      : estado?.punteroConsumoMinutos,
    backendSimMinutesPerSecond: USE_MOCK_DATA
      ? undefined
      : backendSimMinutesPerSecond,
  });
  const occupancy = USE_MOCK_DATA ? OCCUPANCY_COLAPSO : occupancyByIcao;

  const { simulatedDay, demandFactor } = useSimulationControlStore();
  const openAirport = useDrawerStore((s) => s.openAirport);
  const openFlight = useDrawerStore((s) => s.openFlight);
  const porcentajeResueltas = estado?.porcentajeResueltas ?? 0;
  const totalSolicitudes = estado?.totalSolicitudes ?? 0;

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
        diaSimulado={USE_MOCK_DATA ? simulatedDay : estado?.bloquesProcesados ?? 0}
        demanda={USE_MOCK_DATA ? `x ${demandFactor.toFixed(1)}` : `k=${estado?.k ?? 1}`}
        enviosTotales={USE_MOCK_DATA ? 12450 : totalSolicitudes}
        cumplimiento={
          USE_MOCK_DATA ? "88 %" : `${Math.round(porcentajeResueltas)} %`
        }
        estado={USE_MOCK_DATA ? "COLAPSO" : estado?.activa ? "ACTIVA" : "DETENIDA"}
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

        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] w-[640px] max-w-[90%]">
          <AlertBanner
            severity="error"
            titulo="ALERTA CRITICA — COLAPSO DETECTADO"
            mensaje="Se supero el umbral: 12% plazos incumplidos (limite: 10%)."
            acciones={
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (!USE_MOCK_DATA) {
                      void stop();
                    }
                  }}
                  className="bg-danger hover:bg-danger/90 text-text-inverse text-button px-4 py-2 rounded-input transition-colors"
                >
                  Detener
                </button>
                <button
                  type="button"
                  className="bg-card hover:bg-field text-danger border border-danger text-button px-4 py-2 rounded-input transition-colors"
                >
                  Continuar
                </button>
              </>
            }
          />
        </div>

        <SimulationControlPanel variant="colapso" />
        <DrawerHost occupancyByIcao={occupancy} airports={airports} />
      </main>
      <LegendBar variant="colapso" />
    </>
  );
};

export default SimulacionColapsoPage;
