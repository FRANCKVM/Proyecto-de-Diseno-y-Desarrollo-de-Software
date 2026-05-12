import TopBar from "@/components/organisms/TopBar";
import LegendBar from "@/components/organisms/LegendBar";
import WorldMap from "@/components/map/WorldMap";
import DrawerHost from "@/components/organisms/DrawerHost";
import { OCCUPANCY_NORMAL } from "@/services/sources2.0/demoOccupancy.mock";
import { useAirports } from "@/hooks/useAirports";
import { useFlightSimulation } from "@/hooks/useFlightSimulation";
import { useOperationData } from "@/hooks/useOperationData";
import { useDrawerStore } from "@/store/drawerStore";
import { USE_MOCK_DATA } from "@/utils/constants";

/**
 * Pantalla de operacion dia a dia.
 * Estandar 61, seccion 5.5 + mockup 08.
 *
 * Densidad de vuelos alta (25). Drawers wireados.
 */
const OperacionDiaADiaPage = () => {
  const { airports, isLoading } = useAirports();
  const { estado, mapa, envios, refresh } = useOperationData();

  const flights = useFlightSimulation({
    baseFlightCount: 25,
    scaleByDemand: false,
    backendShipments: USE_MOCK_DATA ? undefined : envios,
  });

  const occupancy = USE_MOCK_DATA
    ? OCCUPANCY_NORMAL
    : (mapa?.ocupacionPorAeropuerto ?? {});

  const openAirport = useDrawerStore((s) => s.openAirport);
  const openFlight = useDrawerStore((s) => s.openFlight);
  const openShipmentForm = useDrawerStore((s) => s.openShipmentForm);

  const handleRegistrarEnvio = () => {
    openShipmentForm();
  };

  return (
    <>
      <TopBar
        variant="dia-a-dia"
        fechaActual={
          USE_MOCK_DATA
            ? "Lun 07/04/2026 09:45 (GMT-5)"
            : (estado?.fechaActual ?? new Date().toISOString())
        }
        kpis={{
          enviosHoy: USE_MOCK_DATA ? 23 : (estado?.enviosHoy ?? envios.length),
          enTransito: USE_MOCK_DATA ? flights.length : (estado?.enTransito ?? 0),
          entregadas: USE_MOCK_DATA ? 89 : (estado?.entregadas ?? 0),
          cumplimiento: USE_MOCK_DATA
            ? "100%"
            : `${estado?.cumplimiento ?? 0}%`,
        }}
        onRegistrarEnvio={handleRegistrarEnvio}
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
        <DrawerHost
          occupancyByIcao={occupancy}
          airports={airports}
          onShipmentCreated={refresh}
        />
      </main>
      <LegendBar variant="dia-a-dia" />
    </>
  );
};

export default OperacionDiaADiaPage;
