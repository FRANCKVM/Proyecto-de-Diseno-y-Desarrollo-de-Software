import TopBar from "@/components/organisms/TopBar";
import LegendBar from "@/components/organisms/LegendBar";
import WorldMap from "@/components/map/WorldMap";
import SimulationControlPanel from "@/components/organisms/SimulationControlPanel";
import DrawerHost from "@/components/organisms/DrawerHost";
import { OCCUPANCY_NORMAL } from "@/services/sources2.0/demoOccupancy.mock";
import { useAirports } from "@/hooks/useAirports";
import { useFlightSimulation } from "@/hooks/useFlightSimulation";
import { useSimulationControlStore } from "@/store/simulationControlStore";
import { useDrawerStore } from "@/store/drawerStore";
import { DURACION_SIMULACION_SEMANAL_DIAS } from "@/utils/constants";

/**
 * Pantalla de simulacion en ejecucion.
 * Estandar 61, seccion 5.3 + mockups 03/04/05.
 *
 * Densidad de vuelos media (15). Drawers wireados al store.
 */
const SimulacionEjecucionPage = () => {
  const { airports, isLoading } = useAirports();

  const flights = useFlightSimulation({
    baseFlightCount: 15,
    scaleByDemand: false,
  });

  const simulatedDay = useSimulationControlStore((s) => s.simulatedDay);
  const openAirport = useDrawerStore((s) => s.openAirport);
  const openFlight = useDrawerStore((s) => s.openFlight);

  return (
    <>
      <TopBar
        variant="ejecucion"
        fechaSimulada="Mie 09/04/2026 14:30"
        dia={{
          actual: simulatedDay,
          total: DURACION_SIMULACION_SEMANAL_DIAS,
        }}
        tiempoReal={{ transcurrido: "42 min", estimado: "~60 min" }}
        kpis={{
          entregas: "100%",
          enTransito: flights.length,
          entregadas: 1205,
          cancelados: 0,
        }}
      />
      <main className="flex-1 min-h-0 bg-map-bg relative">
        {!isLoading && (
          <WorldMap
            airports={airports}
            flights={flights}
            occupancyByIcao={OCCUPANCY_NORMAL}
            onAirportClick={(a) => openAirport(a.icao)}
            onFlightClick={(id) => openFlight(id)}
          />
        )}
        <SimulationControlPanel
          variant="ejecucion"
          totalDays={DURACION_SIMULACION_SEMANAL_DIAS}
        />
        <DrawerHost occupancyByIcao={OCCUPANCY_NORMAL} />
      </main>
      <LegendBar variant="simulacion" />
    </>
  );
};

export default SimulacionEjecucionPage;
