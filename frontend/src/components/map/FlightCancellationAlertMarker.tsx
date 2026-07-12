import { useMemo } from "react";
import L from "leaflet";
import { Marker } from "react-leaflet";
import type { AirportWithCoords } from "@/types/airport.types";

interface FlightCancellationAlertMarkerProps {
  airport: AirportWithCoords;
  flightCode?: string | null;
}

const ALERT_WIDTH = 132;
const ALERT_HEIGHT = 42;

const buildAlertHtml = (flightCode?: string | null): string => `
  <div class="tasf-cancel-alert" aria-hidden="true">
    <div class="tasf-cancel-alert-tooltip">
      <span>${flightCode ?? "sin dato"}</span>
      <strong>Cancelado</strong>
    </div>
  </div>
`;

const FlightCancellationAlertMarker = ({
  airport,
  flightCode,
}: FlightCancellationAlertMarkerProps) => {
  const icon = useMemo(
    () =>
      L.divIcon({
        html: buildAlertHtml(flightCode),
        className: "",
        iconSize: [ALERT_WIDTH, ALERT_HEIGHT],
        iconAnchor: [ALERT_WIDTH / 2, ALERT_HEIGHT],
      }),
    [flightCode]
  );

  return (
    <Marker
      position={[airport.lat, airport.lng]}
      icon={icon}
      interactive={false}
      zIndexOffset={3000}
    />
  );
};

export default FlightCancellationAlertMarker;
