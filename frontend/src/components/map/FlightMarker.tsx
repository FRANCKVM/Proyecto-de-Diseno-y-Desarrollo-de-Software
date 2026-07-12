import { useEffect, useRef } from "react";
import L from "leaflet";
import { useMap } from "react-leaflet";
import type { AirportWithCoords } from "@/types/airport.types";
import type { EstadoSemaforo } from "@/types/common.types";
import { ESTADO_COLOR_HEX } from "@/utils/airportHelpers";
import { COLORS } from "@/styles/theme";

interface FlightMarkerProps {
  flightId: string;
  fromAirport: AirportWithCoords;
  toAirport: AirportWithCoords;
  /** Avance del vuelo entre 0 y 1. */
  progress: number;
  durationSeconds?: number;
  progressVelocityPerSecond?: number;
  progressUpdatedAtMs?: number;
  occupancyPct?: number;
  /**
   * Color del avion segun estado del semaforo del vuelo.
   * Si no se provee, se pinta en text-primary (oscuro), el patron por
   * defecto sobre el mapa claro de CartoDB Positron.
   */
  estado?: EstadoSemaforo;
  selected?: boolean;
  onClick?: (flightId: string) => void;
}

const PLANE_SIZE = 22;
const REF_ZOOM = 0;
const ICON_BEARING_OFFSET = -45;
const PLANE_PATH =
  "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z";
const PLANE_CENTER = {
  cx: 12,
  cy: 12,
  r: 3.2,
} as const;
const EMPTY_FLIGHT_COLOR = "#6B7280";

const clampProgress = (value: number): number => Math.max(0, Math.min(1, value));
const roundPixel = (value: number): number => Math.round(value * 1000) / 1000;

const formatOccupancy = (value?: number): string =>
  value === undefined
    ? "Sin dato"
    : `${Math.round(value).toLocaleString("es-PE")}%`;

const buildTooltipHtml = (
  occupancyPct: number | undefined,
  color: string
): string =>
  `<span class="tasf-flight-tooltip-content" style="color:${color};">${formatOccupancy(
    occupancyPct
  )}</span>`;

const buildPlaneHtml = (
  bodyColor: string,
  centerColor: string | null,
  displayBearing: number,
  selected = false,
  tooltipHtml: string
): string => `
  <div class="tasf-flight-marker" style="position:relative; transform: rotate(${displayBearing}deg) ${selected ? "scale(1.2)" : ""}">
    ${
      selected
        ? `<div style="position:absolute; inset:-9px; border:3px solid ${COLORS.primary.base}; border-radius:999px; background:${COLORS.primary.soft}; opacity:0.9;"></div>`
        : ""
    }
    <svg width="${PLANE_SIZE}" height="${PLANE_SIZE}" viewBox="0 0 24 24"
         style="position:relative; z-index:1;"
         xmlns="http://www.w3.org/2000/svg"
         fill="${bodyColor}" stroke="#FFFFFF" stroke-width="1.5"
         stroke-linecap="round" stroke-linejoin="round"
         paint-order="stroke fill">
      <path d="${PLANE_PATH}"/>
      ${
        centerColor
          ? `<circle cx="${PLANE_CENTER.cx}" cy="${PLANE_CENTER.cy}" r="${PLANE_CENTER.r}"
               fill="${centerColor}" stroke="#FFFFFF" stroke-width="1.2" />`
          : ""
      }
    </svg>
  </div>
  <div class="tasf-flight-overlay-tooltip tasf-flight-tooltip">
    ${tooltipHtml}
  </div>
`;

const calculateDisplayBearing = (
  map: L.Map,
  fromAirport: AirportWithCoords,
  toAirport: AirportWithCoords
): number => {
  const fromPx = map.project([fromAirport.lat, fromAirport.lng], REF_ZOOM);
  const toPx = map.project([toAirport.lat, toAirport.lng], REF_ZOOM);
  const dx = toPx.x - fromPx.x;
  const dy = toPx.y - fromPx.y;
  const geoBearing = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
  return (geoBearing + ICON_BEARING_OFFSET + 360) % 360;
};

/**
 * Marcador de vuelo en transito.
 *
 * El avion se monta una sola vez en el marker pane de Leaflet y se mueve con
 * `translate3d`, evitando reproyectar y llamar `marker.setLatLng` en cada frame.
 * Para rutas rectas esto produce un desplazamiento mas estable al hacer zoom.
 */
const FlightMarker = ({
  flightId,
  fromAirport,
  toAirport,
  progress,
  progressVelocityPerSecond,
  progressUpdatedAtMs,
  occupancyPct,
  estado,
  selected = false,
  onClick,
}: FlightMarkerProps) => {
  const map = useMap();
  const elementRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number>(0);
  const fromPointRef = useRef<L.Point>(L.point(0, 0));
  const toPointRef = useRef<L.Point>(L.point(0, 0));
  const latestRef = useRef({
    flightId,
    progress,
    progressVelocityPerSecond,
    progressUpdatedAtMs,
    onClick,
  });

  useEffect(() => {
    latestRef.current = {
      flightId,
      progress,
      progressVelocityPerSecond,
      progressUpdatedAtMs,
      onClick,
    };
  }, [flightId, onClick, progress, progressUpdatedAtMs, progressVelocityPerSecond]);

  useEffect(() => {
    const pane = map.getPane("markerPane");
    if (!pane) {
      return;
    }

    const element = document.createElement("div");
    element.className = "tasf-flight-overlay-marker";
    element.style.zIndex = selected ? "1200" : "600";
    elementRef.current = element;
    pane.appendChild(element);

    const handleClick = (event: MouseEvent) => {
      L.DomEvent.stop(event);
      latestRef.current.onClick?.(latestRef.current.flightId);
    };
    const handleMouseOver = () => {
      if (tooltipRef.current) {
        tooltipRef.current.style.opacity = "1";
      }
    };
    const handleMouseOut = () => {
      if (tooltipRef.current) {
        tooltipRef.current.style.opacity = "0";
      }
    };

    element.addEventListener("click", handleClick);
    element.addEventListener("mouseover", handleMouseOver);
    element.addEventListener("mouseout", handleMouseOut);

    return () => {
      cancelAnimationFrame(rafRef.current);
      element.removeEventListener("click", handleClick);
      element.removeEventListener("mouseover", handleMouseOver);
      element.removeEventListener("mouseout", handleMouseOut);
      element.remove();
      elementRef.current = null;
      tooltipRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return;
    }

    const color =
      occupancyPct === 0
        ? EMPTY_FLIGHT_COLOR
        : estado
          ? ESTADO_COLOR_HEX[estado]
          : COLORS.text.primary;
    const centerColor =
      occupancyPct === 0
        ? EMPTY_FLIGHT_COLOR
        : estado
          ? ESTADO_COLOR_HEX[estado]
          : null;
    const displayBearing = calculateDisplayBearing(map, fromAirport, toAirport);

    element.style.zIndex = selected ? "1200" : "600";
    element.innerHTML = buildPlaneHtml(
      COLORS.text.primary,
      centerColor,
      displayBearing,
      selected,
      buildTooltipHtml(occupancyPct, color)
    );
    tooltipRef.current = element.querySelector<HTMLDivElement>(
      ".tasf-flight-overlay-tooltip"
    );
  }, [
    fromAirport,
    map,
    occupancyPct,
    selected,
    estado,
    toAirport,
  ]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return;
    }

    const updateEndpoints = () => {
      fromPointRef.current = map.latLngToLayerPoint([
        fromAirport.lat,
        fromAirport.lng,
      ]);
      toPointRef.current = map.latLngToLayerPoint([
        toAirport.lat,
        toAirport.lng,
      ]);
    };

    const setElementPosition = (nextProgress: number) => {
      const clampedProgress = clampProgress(nextProgress);
      const fromPoint = fromPointRef.current;
      const toPoint = toPointRef.current;
      const x =
        fromPoint.x + (toPoint.x - fromPoint.x) * clampedProgress - PLANE_SIZE / 2;
      const y =
        fromPoint.y + (toPoint.y - fromPoint.y) * clampedProgress - PLANE_SIZE / 2;

      element.style.transform = `translate3d(${roundPixel(x)}px, ${roundPixel(y)}px, 0)`;
    };

    const getAnimatedProgress = (now: number) => {
      const progressTimestamp = progressUpdatedAtMs ?? performance.now();
      const progressVelocity = progressVelocityPerSecond ?? 0;
      const elapsedSeconds = (now - progressTimestamp) / 1000;
      return progress + elapsedSeconds * progressVelocity;
    };

    const refreshPosition = () => {
      updateEndpoints();
      setElementPosition(getAnimatedProgress(performance.now()));
    };

    const tick = (now: number) => {
      const nextProgress = getAnimatedProgress(now);
      setElementPosition(nextProgress);

      if (nextProgress < 1 && (progressVelocityPerSecond ?? 0) > 0) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    cancelAnimationFrame(rafRef.current);
    updateEndpoints();
    setElementPosition(progress);

    if (progress < 1 && (progressVelocityPerSecond ?? 0) > 0) {
      rafRef.current = requestAnimationFrame(tick);
    }

    map.on("move zoom viewreset zoomanim", refreshPosition);

    return () => {
      cancelAnimationFrame(rafRef.current);
      map.off("move zoom viewreset zoomanim", refreshPosition);
    };
  }, [
    fromAirport.lat,
    fromAirport.lng,
    map,
    progress,
    progressUpdatedAtMs,
    progressVelocityPerSecond,
    toAirport.lat,
    toAirport.lng,
  ]);

  return null;
};

export default FlightMarker;
