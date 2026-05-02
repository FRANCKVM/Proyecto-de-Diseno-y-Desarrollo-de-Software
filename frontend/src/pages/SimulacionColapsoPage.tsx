import TopBar from "@/components/organisms/TopBar";
import LegendBar from "@/components/organisms/LegendBar";
import WorldMap from "@/components/map/WorldMap";
import AlertBanner from "@/components/molecules/AlertBanner";
import SimulationControlPanel from "@/components/organisms/SimulationControlPanel";
import DrawerHost from "@/components/organisms/DrawerHost";
import { OCCUPANCY_COLAPSO } from "@/services/sources2.0/demoOccupancy.mock";
import { useAirports } from "@/hooks/useAirports";
import { useFlightSimulation } from "@/hooks/useFlightSimulation";
import { useSimulationControlStore } from "@/store/simulationControlStore";
import { useDrawerStore } from "@/store/drawerStore";

/**
 * Pantalla de simulacion al colapso.
 * Estandar 61, seccion 5.6 + mockup 09.
 *
 * Densidad alta y escalable por demanda. Drawers wireados.
 */
const SimulacionColapsoPage = () => {
  const { airports, isLoading } = useAirports();

  const flights = useFlightSimulation({
    baseFlightCount: 25,
    scaleByDemand: true,
  });

  const { simulatedDay, demandFactor } = useSimulationControlStore();
  const openAirport = useDrawerStore((s) => s.openAirport);
  const openFlight = useDrawerStore((s) => s.openFlight);

  return (
    <>
      <TopBar
        variant="colapso"
        diaSimulado={simulatedDay}
        demanda={`x ${demandFactor.toFixed(1)}`}
        enviosTotales={12450}
        cumplimiento="88 %"
        estado="COLAPSO"
      />
      <main className="flex-1 min-h-0 bg-map-bg relative">
        {!isLoading && (
          <WorldMap
            airports={airports}
            flights={flights}
            occupancyByIcao={OCCUPANCY_COLAPSO}
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
        <DrawerHost occupancyByIcao={OCCUPANCY_COLAPSO} />
      </main>
      <LegendBar variant="colapso" />
    </>
  );
};

export default SimulacionColapsoPage;
