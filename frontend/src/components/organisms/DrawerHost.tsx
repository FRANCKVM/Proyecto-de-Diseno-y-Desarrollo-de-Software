import { useDrawerStore } from "@/store/drawerStore";
import AirportDrawer from "@/components/drawers/AirportDrawer";
import FlightDrawer from "@/components/drawers/FlightDrawer";
import ShipmentDrawer from "@/components/drawers/ShipmentDrawer";
import ShipmentFormDrawer from "@/components/drawers/ShipmentFormDrawer";
import ShipmentOverviewDrawer from "@/components/drawers/ShipmentOverviewDrawer";
import WarehouseListDrawer from "@/components/drawers/WarehouseListDrawer";
import ActiveFlightsDrawer from "@/components/drawers/ActiveFlightsDrawer";
import BaggageDrawer from "@/components/drawers/BaggageDrawer";
import type { MapFlight } from "@/components/map/WorldMap";
import type { AirportWithCoords } from "@/types/airport.types";
import type { BackendSolicitudEnvio } from "@/types/backendSimulation.types";
import type { RangoSemaforo } from "@/types/common.types";

interface DrawerHostProps {
  /**
   * Mapa de ICAO -> ocupacion para que el AirportDrawer pueda mostrar
   * el porcentaje del semaforo. Cada pagina pasa su dataset propio.
   */
  occupancyByIcao?: Record<string, number>;
  airports?: AirportWithCoords[];
  rangosSemaforo?: RangoSemaforo;
  idSimulacion?: number | null;
  shipments?: BackendSolicitudEnvio[];
  activeFlights?: MapFlight[];
  referenceMinute?: number | null;
  simulationStart?: string | null;
  onShipmentCreated?: () => Promise<void> | void;
}

/**
 * Host de drawers del sistema.
 *
 * Lee del drawerStore que tipo de entidad se selecciono y monta el
 * drawer correspondiente. Solo un drawer activo a la vez.
 *
 * Las paginas que tienen mapa montan este host una sola vez y los
 * markers (a traves del store) disparan los `open*`.
 *
 * El `key` con la entidad asegura que al saltar de un drawer a otro
 * (o entre items del mismo tipo) la animacion slide-in se reinicie
 * y los efectos del componente se reseten.
 */
const DrawerHost = ({
  occupancyByIcao,
  airports = [],
  rangosSemaforo,
  idSimulacion,
  shipments = [],
  activeFlights = [],
  referenceMinute,
  simulationStart,
  onShipmentCreated,
}: DrawerHostProps) => {
  const selection = useDrawerStore((s) => s.selection);

  if (!selection) return null;

  switch (selection.type) {
    case "warehouse-list":
      return (
        <WarehouseListDrawer
          key="warehouse-list"
          airports={airports}
          occupancyByIcao={occupancyByIcao}
          rangosSemaforo={rangosSemaforo}
          shipments={shipments}
          referenceMinute={referenceMinute}
        />
      );
    case "warehouse-airport":
      return (
        <AirportDrawer
          key={`warehouse-airport-${selection.icao}`}
          icao={selection.icao}
          ocupacion={occupancyByIcao?.[selection.icao]}
          rangosSemaforo={rangosSemaforo}
          idSimulacion={idSimulacion}
          shipments={shipments}
          showFlights={false}
          referenceMinute={referenceMinute}
          simulationStart={simulationStart}
        />
      );
    case "shipments-panel":
      return (
        <ShipmentOverviewDrawer
          key="shipments-panel"
          shipments={shipments}
          idSimulacion={idSimulacion}
          referenceMinute={referenceMinute}
          simulationStart={simulationStart}
        />
      );
    case "baggage-panel":
      return (
        <BaggageDrawer
          key="baggage-panel"
          shipments={shipments}
          idSimulacion={idSimulacion}
          referenceMinute={referenceMinute}
          simulationStart={simulationStart}
        />
      );
    case "active-flights-panel":
      return (
        <ActiveFlightsDrawer
          key="active-flights-panel"
          flights={activeFlights}
          airports={airports}
          rangosSemaforo={rangosSemaforo}
          idSimulacion={idSimulacion}
          shipments={shipments}
          referenceMinute={referenceMinute}
          simulationStart={simulationStart}
        />
      );
    case "airport":
      return (
        <AirportDrawer
          key={`airport-${selection.icao}`}
          icao={selection.icao}
          ocupacion={occupancyByIcao?.[selection.icao]}
          rangosSemaforo={rangosSemaforo}
          idSimulacion={idSimulacion}
          shipments={shipments}
          showFlights
          referenceMinute={referenceMinute}
          simulationStart={simulationStart}
        />
      );
    case "flight":
      return (
        <FlightDrawer
          key={`flight-${selection.codigo}-${selection.idSimulacion ?? "real"}`}
          codigo={selection.codigo}
          idSimulacion={selection.idSimulacion}
          shipments={shipments}
          referenceMinute={referenceMinute}
        />
      );
    case "shipment":
      return (
        <ShipmentDrawer
          key={`shipment-${selection.codigo}-${selection.idSimulacion ?? "real"}`}
          codigo={selection.codigo}
          idSimulacion={selection.idSimulacion}
        />
      );
    case "shipment-form":
      return (
        <ShipmentFormDrawer
          key="shipment-form"
          airports={airports}
          occupancyByIcao={occupancyByIcao}
          onCreated={onShipmentCreated}
        />
      );
  }
};

export default DrawerHost;
