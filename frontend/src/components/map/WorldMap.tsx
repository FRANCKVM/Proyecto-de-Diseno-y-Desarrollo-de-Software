import { useMemo } from "react";
import { MapContainer as LeafletMap, TileLayer } from "react-leaflet";
import type { LatLngBoundsExpression } from "leaflet";
import type { AirportWithCoords } from "@/types/airport.types";
import { getEstadoSemaforo } from "@/utils/airportHelpers";
import AirportMarker from "@/components/map/AirportMarker";
import FlightMarker from "@/components/map/FlightMarker";
import RouteLine from "@/components/map/RouteLine";

/**
 * Vuelo en formato consumible por el mapa.
 * Coincide con `DemoFlight` pero la pagina puede transformar la fuente
 * que sea (mock, sim engine, websocket) a este shape antes de pasarlo.
 */
export interface MapFlight {
  id: string;
  fromIcao: string;
  toIcao: string;
  progress: number;
}

interface WorldMapProps {
  airports: AirportWithCoords[];
  flights?: MapFlight[];
  /** Mapa de ICAO -> porcentaje de ocupacion 0-100. */
  occupancyByIcao?: Record<string, number>;
  onAirportClick?: (airport: AirportWithCoords) => void;
  onFlightClick?: (flightId: string) => void;
}

/**
 * Limites geograficos en los que se permite posicionar la camara.
 * El usuario no puede panear fuera de [-180, 180]; los tiles se
 * repiten visualmente para llenar el viewport pero no son interactivos.
 */
const WORLD_BOUNDS: LatLngBoundsExpression = [
  [-85, -180],
  [85, 180],
];

/**
 * Tile layer CartoDB Positron (Light All).
 *
 * Estetica gris claro minimalista, ideal para que los marcadores y rutas
 * de operacion sean los protagonistas visuales del mapa.
 *
 * Sin API key, atribucion requerida por terminos de uso de CARTO y OSM.
 */
const TILE_URL =
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const TILE_SUBDOMAINS = "abcd";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

/**
 * Centro inicial: [20, 0] permite ver Sudamerica, Europa y Asia
 * en una sola vista a zoom 2.
 */
const INITIAL_CENTER: [number, number] = [20, 0];
const INITIAL_ZOOM = 2;

/**
 * Mapa mundial operativo del sistema Tasf.B2B.
 *
 * Capa base: CartoDB Positron (gris claro minimalista).
 * Capas operacionales (orden de pintado, de fondo a frente):
 *   1. Rutas (lineas dashed)
 *   2. Aeropuertos (marcadores concentricos)
 *   3. Aviones en vuelo
 *
 * Los tiles se permiten repetir horizontalmente (sin `noWrap`) para
 * que a zoom bajo el mapa llene el viewport completo en pantallas
 * anchas. El `maxBounds` con viscosidad 1 mantiene la camara dentro
 * del rango [-180, 180] real, asi que los markers nunca aparecen
 * duplicados aunque los tiles si.
 */
const WorldMap = ({
  airports,
  flights = [],
  occupancyByIcao = {},
  onAirportClick,
  onFlightClick,
}: WorldMapProps) => {
  // Lookup O(1) de aeropuertos por ICAO para resolver origen/destino
  // de cada vuelo sin recorrer el array en cada render.
  const airportsByIcao = useMemo(
    () => new Map(airports.map((a) => [a.icao, a])),
    [airports]
  );

  return (
    <LeafletMap
      center={INITIAL_CENTER}
      zoom={INITIAL_ZOOM}
      minZoom={2}
      maxZoom={6}
      maxBounds={WORLD_BOUNDS}
      maxBoundsViscosity={1}
      worldCopyJump={false}
      className="w-full h-full bg-map-bg"
    >
      <TileLayer
        url={TILE_URL}
        subdomains={TILE_SUBDOMAINS}
        attribution={TILE_ATTRIBUTION}
        detectRetina
      />

      {/* Capa 1: rutas (al fondo) */}
      {flights.map((f) => {
        const from = airportsByIcao.get(f.fromIcao);
        const to = airportsByIcao.get(f.toIcao);
        if (!from || !to) return null;
        return <RouteLine key={`route-${f.id}`} from={from} to={to} />;
      })}

      {/* Capa 2: aeropuertos */}
      {airports.map((a) => {
        const ocupacion = occupancyByIcao[a.icao];
        const estado =
          ocupacion !== undefined ? getEstadoSemaforo(ocupacion) : "normal";
        return (
          <AirportMarker
            key={a.id}
            airport={a}
            estado={estado}
            ocupacion={ocupacion}
            onClick={onAirportClick}
          />
        );
      })}

      {/* Capa 3: aviones (encima de todo) */}
      {flights.map((f) => {
        const from = airportsByIcao.get(f.fromIcao);
        const to = airportsByIcao.get(f.toIcao);
        if (!from || !to) return null;
        return (
          <FlightMarker
            key={f.id}
            flightId={f.id}
            fromAirport={from}
            toAirport={to}
            progress={f.progress}
            onClick={onFlightClick}
          />
        );
      })}
    </LeafletMap>
  );
};

export default WorldMap;
