import { useEffect, useMemo } from "react";
import { MapContainer as LeafletMap, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import type { LatLngBoundsExpression } from "leaflet";
import type { AirportWithCoords } from "@/types/airport.types";
import type { EstadoSemaforo, RangoSemaforo } from "@/types/common.types";
import type { ShipmentRouteSegment } from "@/utils/shipmentFocus";
import { getEstadoSemaforo } from "@/utils/airportHelpers";
import { COLORS } from "@/styles/theme";
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
  code?: string;
  fromIcao: string;
  toIcao: string;
  progress: number;
  occupancyPct?: number;
}

type ActiveFlightSemaphoreFilter = "todos" | "vacios" | EstadoSemaforo;
type WarehouseSemaphoreFilter = "todos" | "vacios" | EstadoSemaforo;

interface WorldMapProps {
  airports: AirportWithCoords[];
  flights?: MapFlight[];
  /** Mapa de ICAO -> porcentaje de ocupacion 0-100. */
  occupancyByIcao?: Record<string, number>;
  rangosSemaforo?: RangoSemaforo;
  focusedAirportIcao?: string | null;
  focusedFlightId?: string | null;
  warehouseRegionFilter?: string;
  warehouseSemaphoreFilter?: WarehouseSemaphoreFilter;
  activeFlightRegionFilter?: string;
  activeFlightSemaphoreFilter?: ActiveFlightSemaphoreFilter;
  activeFlightOnlyId?: string | null;
  shipmentRouteSegments?: ShipmentRouteSegment[];
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
 * Centro inicial: [20, 0] permite ver Sudamerica, Europa y Asia.
 * Zoom 3 equivale a arrancar con un click de acercamiento sobre el
 * encuadre mundial base.
 */
const INITIAL_CENTER: [number, number] = [20, 0];
const INITIAL_ZOOM = 3;
const REF_ZOOM = 0;

interface FocusedMapFlight {
  id: string;
  flight: MapFlight;
  from: AirportWithCoords;
  to: AirportWithCoords;
}

const MapFocusController = ({
  airport,
  flight,
}: {
  airport?: AirportWithCoords;
  flight?: FocusedMapFlight;
}) => {
  const map = useMap();

  useEffect(() => {
    if (flight) {
      const fromPx = map.project([flight.from.lat, flight.from.lng], REF_ZOOM);
      const toPx = map.project([flight.to.lat, flight.to.lng], REF_ZOOM);
      const midPx = L.point(
        fromPx.x + (toPx.x - fromPx.x) * flight.flight.progress,
        fromPx.y + (toPx.y - fromPx.y) * flight.flight.progress
      );
      const position = map.unproject(midPx, REF_ZOOM);

      map.flyTo([position.lat, position.lng], Math.max(map.getZoom(), 5), {
        animate: true,
        duration: 0.7,
      });
      return;
    }

    if (!airport) {
      return;
    }

    map.flyTo([airport.lat, airport.lng], Math.max(map.getZoom(), 5), {
      animate: true,
      duration: 0.8,
    });
  }, [airport, flight?.id, map]);

  return null;
};

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
  rangosSemaforo,
  focusedAirportIcao,
  focusedFlightId,
  warehouseRegionFilter = "todos",
  warehouseSemaphoreFilter = "todos",
  activeFlightRegionFilter = "todos",
  activeFlightSemaphoreFilter = "todos",
  activeFlightOnlyId,
  shipmentRouteSegments = [],
  onAirportClick,
  onFlightClick,
}: WorldMapProps) => {
  // Lookup O(1) de aeropuertos por ICAO para resolver origen/destino
  // de cada vuelo sin recorrer el array en cada render.
  const airportsByIcao = useMemo(
    () => new Map(airports.map((a) => [a.icao, a])),
    [airports]
  );
  const focusedAirport = focusedAirportIcao
    ? airportsByIcao.get(focusedAirportIcao)
    : undefined;
  const focusedFlight = focusedFlightId
    ? flights
        .map((flight) => {
          const from = airportsByIcao.get(flight.fromIcao);
          const to = airportsByIcao.get(flight.toIcao);
          return from && to ? { id: flight.id, flight, from, to } : null;
        })
        .find((entry): entry is FocusedMapFlight =>
          Boolean(
            entry &&
              (entry.flight.id === focusedFlightId ||
                entry.flight.code === focusedFlightId)
          )
        )
    : undefined;
  const visibleAirports = useMemo(
    () => {
      if (shipmentRouteSegments.length > 0) {
        const routeIcaos = new Set(
          shipmentRouteSegments.flatMap((segment) => [
            segment.fromIcao,
            segment.toIcao,
          ])
        );
        return airports.filter((airport) => routeIcaos.has(airport.icao));
      }

      return warehouseRegionFilter === "todos"
        ? airports.filter((airport) => {
            const occupancy = occupancyByIcao[airport.icao] ?? 0;
            const estado = getEstadoSemaforo(occupancy, rangosSemaforo);
            return (
              warehouseSemaphoreFilter === "todos" ||
              (warehouseSemaphoreFilter === "vacios"
                ? occupancy === 0
                : occupancy > 0 && estado === warehouseSemaphoreFilter)
            );
          })
        : airports.filter((airport) => {
            const occupancy = occupancyByIcao[airport.icao] ?? 0;
            const estado = getEstadoSemaforo(occupancy, rangosSemaforo);
            const matchesRegion =
              airport.region?.trim() === warehouseRegionFilter;
            const matchesSemaphore =
              warehouseSemaphoreFilter === "todos" ||
              (warehouseSemaphoreFilter === "vacios"
                ? occupancy === 0
                : occupancy > 0 && estado === warehouseSemaphoreFilter);

            return matchesRegion && matchesSemaphore;
          });
    },
    [
      airports,
      shipmentRouteSegments,
      warehouseRegionFilter,
      warehouseSemaphoreFilter,
      occupancyByIcao,
      rangosSemaforo,
    ]
  );
  const visibleAirportIcaos = useMemo(
    () => new Set(visibleAirports.map((airport) => airport.icao)),
    [visibleAirports]
  );
  const warehouseFilteredFlights =
    shipmentRouteSegments.length > 0
      ? []
      : warehouseRegionFilter === "todos"
      ? flights
      : flights.filter(
          (flight) =>
            (visibleAirportIcaos.has(flight.fromIcao) &&
              visibleAirportIcaos.has(flight.toIcao)) ||
            (focusedFlightId !== null &&
              focusedFlightId !== undefined &&
              (flight.id === focusedFlightId || flight.code === focusedFlightId))
        );
  const activeFilterBaseFlights = activeFlightOnlyId
    ? flights.filter(
        (flight) =>
          flight.id === activeFlightOnlyId || flight.code === activeFlightOnlyId
      )
    : warehouseFilteredFlights;
  const visibleFlights = activeFilterBaseFlights.filter((flight) => {
    if (activeFlightOnlyId) {
      return true;
    }

    const from = airportsByIcao.get(flight.fromIcao);
    const to = airportsByIcao.get(flight.toIcao);
    const occupancy = flight.occupancyPct;
    const estado =
      occupancy !== undefined
        ? getEstadoSemaforo(occupancy, rangosSemaforo)
        : null;
    const matchesRegion =
      activeFlightRegionFilter === "todos" ||
      from?.region?.trim() === activeFlightRegionFilter ||
      to?.region?.trim() === activeFlightRegionFilter;
    const matchesSemaphore =
      activeFlightSemaphoreFilter === "todos" ||
      (activeFlightSemaphoreFilter === "vacios"
        ? occupancy === 0
        : occupancy !== undefined &&
          occupancy > 0 &&
          estado === activeFlightSemaphoreFilter);

    return matchesRegion && matchesSemaphore;
  });

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
      <MapFocusController airport={focusedAirport} flight={focusedFlight} />

      {/* Capa 1: rutas (al fondo) */}
      {shipmentRouteSegments.map((segment, index) => {
        const from = airportsByIcao.get(segment.fromIcao);
        const to = airportsByIcao.get(segment.toIcao);
        if (!from || !to) return null;
        return (
          <RouteLine
            key={`shipment-route-${segment.fromIcao}-${segment.toIcao}-${index}`}
            from={from}
            to={to}
            progress={1}
            full
            color={COLORS.primary.base}
          />
        );
      })}

      {visibleFlights.map((f) => {
        const from = airportsByIcao.get(f.fromIcao);
        const to = airportsByIcao.get(f.toIcao);
        if (!from || !to) return null;
        return (
          <RouteLine
            key={`route-${f.id}`}
            from={from}
            to={to}
            progress={f.progress}
          />
        );
      })}

      {/* Capa 2: aeropuertos */}
      {visibleAirports.map((a) => {
        const ocupacion = occupancyByIcao[a.icao];
        const estado =
          ocupacion !== undefined
            ? getEstadoSemaforo(ocupacion, rangosSemaforo)
            : "normal";
        return (
          <AirportMarker
            key={a.id}
            airport={a}
            estado={estado}
            ocupacion={ocupacion}
            selected={a.icao === focusedAirportIcao}
            onClick={onAirportClick}
          />
        );
      })}

      {/* Capa 3: aviones (encima de todo) */}
      {visibleFlights.map((f) => {
        const from = airportsByIcao.get(f.fromIcao);
        const to = airportsByIcao.get(f.toIcao);
        if (!from || !to) return null;
        const selected =
          focusedFlightId !== null &&
          focusedFlightId !== undefined &&
          (f.id === focusedFlightId || f.code === focusedFlightId);
        const flightEstado =
          f.occupancyPct !== undefined
            ? getEstadoSemaforo(f.occupancyPct, rangosSemaforo)
            : undefined;
        return (
          <FlightMarker
            key={f.id}
            flightId={f.id}
            fromAirport={from}
            toAirport={to}
            progress={f.progress}
            estado={flightEstado}
            selected={selected}
            onClick={onFlightClick}
          />
        );
      })}
    </LeafletMap>
  );
};

export default WorldMap;
