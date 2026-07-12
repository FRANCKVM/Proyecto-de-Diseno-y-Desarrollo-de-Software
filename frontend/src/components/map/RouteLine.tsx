import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import { useMap } from "react-leaflet";
import type { AirportWithCoords } from "@/types/airport.types";
import { COLORS } from "@/styles/theme";

interface RouteLineProps {
  from: AirportWithCoords;
  to: AirportWithCoords;
  /** Avance del vuelo entre 0 y 1. */
  progress: number;
  progressVelocityPerSecond?: number;
  progressUpdatedAtMs?: number;
  /** Dibuja el segmento completo, util para rutas de envios. */
  full?: boolean;
  /**
   * Color del trazo. Por defecto gris secundario del estandar,
   * que se distingue claramente sobre el fondo claro de CartoDB
   * Positron sin saturar la vista.
   */
  color?: string;
  /** Muestra una punta sobre el segmento para indicar direccion. */
  directional?: boolean;
}

const ROUTE_ARROW_SIZE = 18;

const buildRouteArrowHtml = (color: string, angle: number): string => `
  <div class="tasf-route-arrow" style="--tasf-route-arrow-color:${color}; transform: rotate(${angle}deg);">
    <svg width="${ROUTE_ARROW_SIZE}" height="${ROUTE_ARROW_SIZE}" viewBox="0 0 18 18"
         xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M3 9H12.5" />
      <path d="M9 5L13 9L9 13" />
    </svg>
  </div>
`;

/**
 * Linea punteada que representa una ruta entre dos aeropuertos.
 *
 * Estandar 61, seccion 4.7: rutas como lineas dashed sobre el mapa.
 * El badge de cantidad de maletas en transito (visible en los mockups
 * 03 y 09) se renderiza en una capa aparte cuando llegue el motor de
 * simulacion en la entrega C; aqui solo va la linea base.
 */
const RouteLine = ({
  from,
  to,
  progress,
  progressVelocityPerSecond,
  progressUpdatedAtMs,
  full = false,
  color = COLORS.text.secondary,
  directional = false,
}: RouteLineProps) => {
  const map = useMap();
  const lineRef = useRef<HTMLDivElement | null>(null);
  const arrowRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number>(0);
  const fromLatLng = useMemo(() => L.latLng(from.lat, from.lng), [from.lat, from.lng]);
  const toLatLng = useMemo(() => L.latLng(to.lat, to.lng), [to.lat, to.lng]);
  const progressSnapshot = progress;
  const progressTimestamp = progressUpdatedAtMs ?? performance.now();
  const progressVelocity = progressVelocityPerSecond ?? 0;

  useEffect(() => {
    const routePane = map.getPanes().overlayPane;
    const arrowPane = map.getPanes().markerPane;
    const lineElement = document.createElement("div");
    let arrowElement: HTMLDivElement | null = null;

    lineElement.className = "tasf-route-overlay-line";
    routePane.appendChild(lineElement);
    lineRef.current = lineElement;

    if (directional) {
      arrowElement = document.createElement("div");
      arrowElement.className = "tasf-route-overlay-arrow";
      arrowPane.appendChild(arrowElement);
      arrowRef.current = arrowElement;
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      lineElement.remove();
      arrowElement?.remove();
      if (lineRef.current === lineElement) {
        lineRef.current = null;
      }
      if (arrowRef.current === arrowElement) {
        arrowRef.current = null;
      }
    };
  }, [directional, map]);

  useEffect(() => {
    const lineElement = lineRef.current;
    if (!lineElement) {
      return;
    }

    lineElement.style.setProperty("--tasf-route-color", color);
    lineElement.style.setProperty(
      "--tasf-route-weight",
      `${directional ? 2 : 1}px`
    );
    lineElement.style.setProperty("--tasf-route-opacity", "0.7");
  }, [color, directional]);

  useEffect(() => {
    const lineElement = lineRef.current;
    if (!lineElement) {
      return;
    }

    let isDisposed = false;

    const setLinePosition = (nextProgress: number) => {
      const arrowElement = arrowRef.current;
      const clampedProgress = Math.max(0, Math.min(1, nextProgress));
      const fromPoint = map.latLngToLayerPoint(fromLatLng);
      const toPoint = map.latLngToLayerPoint(toLatLng);
      const visibleProgress = full ? 0 : clampedProgress;

      if (!full && (visibleProgress <= 0 || visibleProgress >= 1)) {
        lineElement.style.display = "none";
      } else {
        const startPoint = L.point(
          fromPoint.x + (toPoint.x - fromPoint.x) * visibleProgress,
          fromPoint.y + (toPoint.y - fromPoint.y) * visibleProgress
        );
        const dx = toPoint.x - startPoint.x;
        const dy = toPoint.y - startPoint.y;
        const length = Math.hypot(dx, dy);
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

        lineElement.style.display = "block";
        lineElement.style.width = `${length}px`;
        lineElement.style.transform = `translate3d(${startPoint.x}px, ${startPoint.y}px, 0) rotate(${angle}deg)`;
      }

      if (arrowElement) {
        const routeDx = toPoint.x - fromPoint.x;
        const routeDy = toPoint.y - fromPoint.y;
        const arrowPoint = L.point(
          fromPoint.x + routeDx * 0.62,
          fromPoint.y + routeDy * 0.62
        );
        const arrowAngle = (Math.atan2(routeDy, routeDx) * 180) / Math.PI;

        arrowElement.innerHTML = buildRouteArrowHtml(color, arrowAngle);
        arrowElement.style.transform = `translate3d(${
          arrowPoint.x - ROUTE_ARROW_SIZE / 2
        }px, ${arrowPoint.y - ROUTE_ARROW_SIZE / 2}px, 0)`;
      }
    };

    const tick = (now: number) => {
      const elapsedSeconds = (now - progressTimestamp) / 1000;
      const nextProgress =
        progressSnapshot + elapsedSeconds * progressVelocity;

      setLinePosition(nextProgress);

      if (!isDisposed && nextProgress < 1 && progressVelocity > 0) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    const updateOnMapMove = () => {
      const elapsedSeconds = (performance.now() - progressTimestamp) / 1000;
      setLinePosition(progressSnapshot + elapsedSeconds * progressVelocity);
    };

    cancelAnimationFrame(rafRef.current);
    setLinePosition(progressSnapshot);

    if (!full && progressSnapshot < 1 && progressVelocity > 0) {
      rafRef.current = requestAnimationFrame(tick);
    }

    map.on("move zoom viewreset zoomanim", updateOnMapMove);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(rafRef.current);
      map.off("move zoom viewreset zoomanim", updateOnMapMove);
    };
  }, [
    color,
    fromLatLng,
    full,
    map,
    progressSnapshot,
    progressTimestamp,
    progressVelocity,
    toLatLng,
  ]);

  return null;
};

export default RouteLine;
