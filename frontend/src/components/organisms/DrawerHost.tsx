import { useDrawerStore } from "@/store/drawerStore";
import AirportDrawer from "@/components/drawers/AirportDrawer";
import FlightDrawer from "@/components/drawers/FlightDrawer";
import ShipmentDrawer from "@/components/drawers/ShipmentDrawer";

interface DrawerHostProps {
  /**
   * Mapa de ICAO -> ocupacion para que el AirportDrawer pueda mostrar
   * el porcentaje del semaforo. Cada pagina pasa su dataset propio.
   */
  occupancyByIcao?: Record<string, number>;
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
const DrawerHost = ({ occupancyByIcao }: DrawerHostProps) => {
  const selection = useDrawerStore((s) => s.selection);

  if (!selection) return null;

  switch (selection.type) {
    case "airport":
      return (
        <AirportDrawer
          key={`airport-${selection.icao}`}
          icao={selection.icao}
          ocupacion={occupancyByIcao?.[selection.icao]}
        />
      );
    case "flight":
      return (
        <FlightDrawer
          key={`flight-${selection.codigo}`}
          codigo={selection.codigo}
        />
      );
    case "shipment":
      return (
        <ShipmentDrawer
          key={`shipment-${selection.codigo}`}
          codigo={selection.codigo}
        />
      );
  }
};

export default DrawerHost;
