import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  MapContainer as LeafletMap,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import type { LatLngBoundsExpression, LatLngExpression } from "leaflet";
import type { AirportWithCoords } from "@/types/airport.types";
import type { EstadoSemaforo, RangoSemaforo } from "@/types/common.types";
import type { ShipmentRouteSegment } from "@/utils/shipmentFocus";
import { getEstadoSemaforo } from "@/utils/airportHelpers";
import {
  UMBRAL_SEMAFORO_AMBAR_DEFAULT,
  UMBRAL_SEMAFORO_VERDE_DEFAULT,
} from "@/utils/constants";
import { COLORS } from "@/styles/theme";
import AirportMarker from "@/components/map/AirportMarker";
import FlightMarker from "@/components/map/FlightMarker";
import FlightCancellationAlertMarker from "@/components/map/FlightCancellationAlertMarker";
import RouteLine from "@/components/map/RouteLine";
import { useCancellationAnimationStore } from "@/store/cancellationAnimationStore";

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
  departureMinute?: number;
  arrivalMinute?: number;
  durationSeconds?: number;
  progressVelocityPerSecond?: number;
  progressUpdatedAtMs?: number;
}

export interface MapFlightCancellationEvent {
  id: string;
  airportIcao: string;
  flightCode?: string | null;
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
  flightCancellationEvents?: MapFlightCancellationEvent[];
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
 * Capa base OpenStreetMap.
 * La base se pinta con opacidad reducida para bajar el peso visual del mapa.
 */
const BASE_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const BASE_TILE_SUBDOMAINS = "abc";

/**
 * Centro inicial: [20, 0] permite ver Sudamerica, Europa y Asia.
 * Zoom 3 equivale a arrancar con un click de acercamiento sobre el
 * encuadre mundial base.
 */
const INITIAL_CENTER: [number, number] = [20, 0];
const INITIAL_ZOOM = 3;
const OVERVIEW_MAX_ZOOM = 4.25;
const OVERVIEW_PADDING: [number, number] = [48, 48];
const REF_ZOOM = 0;
const CANCELLATION_ALERT_DURATION_MS = 4_800;
const SEEN_CANCELLATION_STORAGE_KEY = "tasf-seen-cancellation-alert-ids";
const MAX_STORED_CANCELLATION_IDS = 500;
const LEGEND_MARGIN = 0;

const normalizeMapFlightId = (value: string | null | undefined): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  return value.startsWith("occ-") ? value.slice(4) : value;
};

interface FocusedMapFlight {
  id: string;
  flight: MapFlight;
  from: AirportWithCoords;
  to: AirportWithCoords;
}

interface VisibleCancellationAlert extends MapFlightCancellationEvent {
  renderId: string;
}

const readSeenCancellationIds = (): Set<string> => {
  if (typeof window === "undefined") {
    return new Set();
  }

  try {
    const rawValue = window.sessionStorage.getItem(
      SEEN_CANCELLATION_STORAGE_KEY
    );
    const parsed = rawValue ? JSON.parse(rawValue) : [];

    return new Set(Array.isArray(parsed) ? parsed.filter(Boolean) : []);
  } catch {
    return new Set();
  }
};

const persistSeenCancellationIds = (ids: Set<string>) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const boundedIds = Array.from(ids).slice(-MAX_STORED_CANCELLATION_IDS);
    window.sessionStorage.setItem(
      SEEN_CANCELLATION_STORAGE_KEY,
      JSON.stringify(boundedIds)
    );
  } catch {
    // El almacenamiento puede estar deshabilitado; el Set en memoria sigue cubriendo la sesion actual.
  }
};

const clampPercent = (value: number): number =>
  Math.max(0, Math.min(100, Math.round(value)));

const buildSemaphoreLegendItems = (rangosSemaforo?: RangoSemaforo) => {
  const verde = clampPercent(
    rangosSemaforo?.verde ?? UMBRAL_SEMAFORO_VERDE_DEFAULT
  );
  const ambar = clampPercent(
    Math.max(
      verde,
      rangosSemaforo?.ambar ?? UMBRAL_SEMAFORO_AMBAR_DEFAULT
    )
  );

  return [
    {
      key: "normal",
      label: "Verde",
      range: `0 - ${verde}%`,
      colorClass: "bg-success",
    },
    {
      key: "elevado",
      label: "Ambar",
      range: `${verde} - ${ambar}%`,
      colorClass: "bg-warning",
    },
    {
      key: "critico",
      label: "Rojo",
      range: `${ambar} - 100%`,
      colorClass: "bg-danger",
    },
  ];
};

const SemaphoreLegendCard = ({
  rangosSemaforo,
}: {
  rangosSemaforo?: RangoSemaforo;
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef({
    pointerId: 0,
    offsetX: 0,
    offsetY: 0,
  });
  const [position, setPosition] = useState<{ left: number; top: number } | null>(
    null
  );
  const items = useMemo(
    () => buildSemaphoreLegendItems(rangosSemaforo),
    [rangosSemaforo]
  );

  useEffect(() => {
    const container = containerRef.current;
    const card = cardRef.current;
    if (!container || !card) {
      return;
    }

    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);
  }, []);

  const clampPosition = (left: number, top: number) => {
    const container = containerRef.current;
    const card = cardRef.current;
    if (!container || !card) {
      return { left, top };
    }

    const containerRect = container.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();

    return {
      left: Math.max(
        LEGEND_MARGIN,
        Math.min(left, containerRect.width - cardRect.width - LEGEND_MARGIN)
      ),
      top: Math.max(
        LEGEND_MARGIN,
        Math.min(top, containerRect.height - cardRect.height - LEGEND_MARGIN)
      ),
    };
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    const card = cardRef.current;
    if (!container || !card) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const containerRect = container.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const left = cardRect.left - containerRect.left;
    const top = cardRect.top - containerRect.top;

    dragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - cardRect.left,
      offsetY: event.clientY - cardRect.top,
    };
    setPosition(clampPosition(left, top));
    card.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container || dragRef.current.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const containerRect = container.getBoundingClientRect();
    const left =
      event.clientX - containerRect.left - dragRef.current.offsetX;
    const top = event.clientY - containerRect.top - dragRef.current.offsetY;

    setPosition(clampPosition(left, top));
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    dragRef.current.pointerId = 0;
    cardRef.current?.releasePointerCapture(event.pointerId);
  };

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 z-[900]"
    >
      <div
        ref={cardRef}
        className="pointer-events-auto absolute max-w-full cursor-move select-none rounded-tl-card border border-border bg-card/95 px-3 py-2 shadow-card backdrop-blur-sm"
        style={
          position
            ? { left: position.left, top: position.top }
            : {
                left: "50%",
                bottom: LEGEND_MARGIN,
                transform: "translateX(-50%)",
              }
        }
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="shrink-0 text-label-sm text-text-primary">Semaforo</p>
          {items.map((item) => (
            <div key={item.key} className="flex items-center gap-1.5 whitespace-nowrap">
              <span
                className={`h-3.5 w-3.5 rounded-full ${item.colorClass}`}
                aria-hidden
              />
              <span className="text-secondary text-text-primary">
                {item.label}
              </span>
              <span className="text-secondary text-text-primary">
                {item.range}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

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

const MapAutoFitController = ({
  positions,
  disabled,
  fitKey,
}: {
  positions: LatLngExpression[];
  disabled: boolean;
  fitKey: string;
}) => {
  const map = useMap();
  const isAutoFittingRef = useRef(false);
  const hasAutoFitRef = useRef(false);
  const userHasInteractedRef = useRef(false);

  useEffect(() => {
    hasAutoFitRef.current = false;
    userHasInteractedRef.current = false;
  }, [fitKey]);

  useEffect(() => {
    const markUserInteraction = () => {
      if (!isAutoFittingRef.current) {
        userHasInteractedRef.current = true;
      }
    };

    map.on("zoomstart", markUserInteraction);
    map.on("dragstart", markUserInteraction);

    return () => {
      map.off("zoomstart", markUserInteraction);
      map.off("dragstart", markUserInteraction);
    };
  }, [map]);

  useEffect(() => {
    if (
      disabled ||
      hasAutoFitRef.current ||
      userHasInteractedRef.current ||
      positions.length === 0
    ) {
      return;
    }

    isAutoFittingRef.current = true;
    hasAutoFitRef.current = true;
    map.invalidateSize();

    if (positions.length === 1) {
      map.setView(positions[0], OVERVIEW_MAX_ZOOM, { animate: false });
      window.setTimeout(() => {
        isAutoFittingRef.current = false;
      }, 0);
      return;
    }

    const bounds = L.latLngBounds(positions);
    if (!bounds.isValid()) {
      isAutoFittingRef.current = false;
      hasAutoFitRef.current = false;
      return;
    }

    map.fitBounds(bounds, {
      animate: false,
      maxZoom: OVERVIEW_MAX_ZOOM,
      padding: OVERVIEW_PADDING,
    });

    window.setTimeout(() => {
      isAutoFittingRef.current = false;
    }, 0);
  }, [disabled, fitKey, map, positions]);

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
  flightCancellationEvents = [],
  shipmentRouteSegments = [],
  onAirportClick,
  onFlightClick,
}: WorldMapProps) => {
  const manualCancellationEvents = useCancellationAnimationStore((s) => s.events);
  const [visibleCancellationAlerts, setVisibleCancellationAlerts] = useState<
    VisibleCancellationAlert[]
  >([]);
  const seenCancellationIdsRef = useRef(readSeenCancellationIds());
  const cancellationAlertTimersRef = useRef<number[]>([]);

  const allCancellationEvents = useMemo(
    () => [...flightCancellationEvents, ...manualCancellationEvents],
    [flightCancellationEvents, manualCancellationEvents]
  );

  useEffect(() => {
    allCancellationEvents.forEach((event) => {
      if (!event.airportIcao || seenCancellationIdsRef.current.has(event.id)) {
        return;
      }

      seenCancellationIdsRef.current.add(event.id);
      persistSeenCancellationIds(seenCancellationIdsRef.current);
      const renderId = `${event.id}-${Date.now()}`;
      setVisibleCancellationAlerts((current) => [
        ...current,
        { ...event, renderId },
      ]);

      const timerId = window.setTimeout(() => {
        setVisibleCancellationAlerts((current) =>
          current.filter((alert) => alert.renderId !== renderId)
        );
      }, CANCELLATION_ALERT_DURATION_MS);

      cancellationAlertTimersRef.current.push(timerId);
    });
  }, [allCancellationEvents]);

  useEffect(() => {
    return () => {
      cancellationAlertTimersRef.current.forEach((timerId) =>
        window.clearTimeout(timerId)
      );
    };
  }, []);

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
              (normalizeMapFlightId(entry.flight.id) === normalizeMapFlightId(focusedFlightId) ||
                normalizeMapFlightId(entry.flight.code) === normalizeMapFlightId(focusedFlightId))
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
  const shipmentRouteKey = useMemo(
    () =>
      shipmentRouteSegments
        .map((segment) => `${segment.fromIcao}:${segment.toIcao}`)
        .join("|"),
    [shipmentRouteSegments]
  );
  const shipmentRouteFlightKeys = useMemo(
    () =>
      new Set(
        shipmentRouteSegments.map(
          (segment) => `${segment.fromIcao}:${segment.toIcao}`
        )
      ),
    [shipmentRouteSegments]
  );
  const warehouseFilteredFlights =
    shipmentRouteSegments.length > 0
      ? focusedFlightId
        ? flights.filter(
            (flight) =>
              shipmentRouteFlightKeys.has(`${flight.fromIcao}:${flight.toIcao}`) &&
              (normalizeMapFlightId(flight.id) === normalizeMapFlightId(focusedFlightId) ||
                normalizeMapFlightId(flight.code) === normalizeMapFlightId(focusedFlightId))
          )
        : []
      : warehouseRegionFilter === "todos"
      ? flights
      : flights.filter(
          (flight) =>
            (visibleAirportIcaos.has(flight.fromIcao) &&
              visibleAirportIcaos.has(flight.toIcao)) ||
            (focusedFlightId !== null &&
              focusedFlightId !== undefined &&
              (normalizeMapFlightId(flight.id) === normalizeMapFlightId(focusedFlightId) ||
                normalizeMapFlightId(flight.code) === normalizeMapFlightId(focusedFlightId)))
        );
  const activeOnlyFlights = activeFlightOnlyId
    ? flights.filter(
        (flight) =>
          normalizeMapFlightId(flight.id) === normalizeMapFlightId(activeFlightOnlyId) ||
          normalizeMapFlightId(flight.code) === normalizeMapFlightId(activeFlightOnlyId)
      )
    : [];
  const activeFilterBaseFlights =
    activeFlightOnlyId && activeOnlyFlights.length > 0
      ? activeOnlyFlights
      : warehouseFilteredFlights;
  const visibleFlights = activeFilterBaseFlights.filter((flight) => {
    if (activeFlightOnlyId && activeOnlyFlights.length > 0) {
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
  const overviewPositions = useMemo(() => {
    const positions: LatLngExpression[] = visibleAirports.map((airport) => [
      airport.lat,
      airport.lng,
    ]);

    visibleFlights.forEach((flight) => {
      const from = airportsByIcao.get(flight.fromIcao);
      const to = airportsByIcao.get(flight.toIcao);
      if (!from || !to) {
        return;
      }

      positions.push([from.lat, from.lng], [to.lat, to.lng]);
    });

    return positions;
  }, [airportsByIcao, visibleAirports, visibleFlights]);
  const hasFocusedMapItem = Boolean(focusedAirport || focusedFlight);
  const shouldShowCancellationAlerts = shipmentRouteSegments.length === 0;

  return (
    <LeafletMap
      center={INITIAL_CENTER}
      zoom={INITIAL_ZOOM}
      minZoom={2}
      maxZoom={6}
      zoomSnap={0.25}
      zoomDelta={0.5}
      zoomControl={false}
      attributionControl={false}
      maxBounds={WORLD_BOUNDS}
      maxBoundsViscosity={1}
      worldCopyJump={false}
      className="w-full h-full bg-map-bg"
    >
      <TileLayer
        url={BASE_TILE_URL}
        subdomains={BASE_TILE_SUBDOMAINS}
        opacity={0.55}
        detectRetina
      />
      <MapAutoFitController
        positions={overviewPositions}
        disabled={hasFocusedMapItem}
        fitKey={shipmentRouteKey || "overview"}
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
            directional
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
            progressVelocityPerSecond={f.progressVelocityPerSecond}
            progressUpdatedAtMs={f.progressUpdatedAtMs}
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
          (normalizeMapFlightId(f.id) === normalizeMapFlightId(focusedFlightId) ||
            normalizeMapFlightId(f.code) === normalizeMapFlightId(focusedFlightId));
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
            durationSeconds={f.durationSeconds}
            progressVelocityPerSecond={f.progressVelocityPerSecond}
            progressUpdatedAtMs={f.progressUpdatedAtMs}
            occupancyPct={f.occupancyPct}
            estado={flightEstado}
            selected={selected}
            onClick={onFlightClick}
          />
        );
      })}

      {shouldShowCancellationAlerts && visibleCancellationAlerts.map((event) => {
        const airport = airportsByIcao.get(event.airportIcao);
        if (!airport) return null;

        return (
          <FlightCancellationAlertMarker
            key={event.renderId}
            airport={airport}
            flightCode={event.flightCode}
          />
        );
      })}

      <SemaphoreLegendCard rangosSemaforo={rangosSemaforo} />
    </LeafletMap>
  );
};

export default WorldMap;
