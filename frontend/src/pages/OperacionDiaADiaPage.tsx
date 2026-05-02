import TopBar from "@/components/organisms/TopBar";
import LegendBar from "@/components/organisms/LegendBar";
import WorldMap from "@/components/map/WorldMap";
import DrawerHost from "@/components/organisms/DrawerHost";
import { OCCUPANCY_NORMAL } from "@/services/sources2.0/demoOccupancy.mock";
import { useAirports } from "@/hooks/useAirports";
import { useFlightSimulation } from "@/hooks/useFlightSimulation";
import { useDrawerStore } from "@/store/drawerStore";

/**
 * Pantalla de operacion dia a dia.
 * Estandar 61, seccion 5.5 + mockup 08.
 *
 * Densidad de vuelos alta (25). Drawers wireados.
 */
const OperacionDiaADiaPage = () => {
  const { airports, isLoading } = useAirports();

  const flights = useFlightSimulation({
    baseFlightCount: 25,
    scaleByDemand: false,
  });

  const openAirport = useDrawerStore((s) => s.openAirport);
  const openFlight = useDrawerStore((s) => s.openFlight);

  const handleRegistrarEnvio = () => {
    // TODO: drawer "Registrar nuevo envio". Pendiente de un nuevo
    // tipo en el drawerStore (form en lugar de detalle de entidad).
    // eslint-disable-next-line no-console
    console.info("[abrir drawer registrar envio]");
  };

  return (
    <>
      <TopBar
        variant="dia-a-dia"
        fechaActual="Lun 07/04/2026 09:45 (GMT-5)"
        kpis={{
          enviosHoy: 23,
          enTransito: flights.length,
          entregadas: 89,
          cumplimiento: "100%",
        }}
        onRegistrarEnvio={handleRegistrarEnvio}
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
        <DrawerHost occupancyByIcao={OCCUPANCY_NORMAL} />
      </main>
      <LegendBar variant="dia-a-dia" />
    </>
  );
};

export default OperacionDiaADiaPage;
