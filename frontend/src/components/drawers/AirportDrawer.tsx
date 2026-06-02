import { useEffect, useState } from "react";
import DrawerBase from "@/components/drawers/DrawerBase";
import InfoRow from "@/components/molecules/InfoRow";
import Tag from "@/components/atoms/Tag";
import ProgressBar from "@/components/atoms/ProgressBar";
import { getAirportByIcao } from "@/services/airportService";
import { listFlightsByAirport } from "@/services/flightService";
import { useDrawerStore } from "@/store/drawerStore";
import { getEstadoSemaforo } from "@/utils/airportHelpers";
import type { AirportWithCoords } from "@/types/airport.types";
import type { VueloDetalle } from "@/types/flight.types";
import type { EstadoSemaforo, RangoSemaforo } from "@/types/common.types";

interface AirportDrawerProps {
  icao: string;
  /**
   * Porcentaje de ocupacion actual (lo provee la pagina desde su mapa
   * de occupancy). Se pasa como prop porque la fuente de verdad de
   * ocupacion en demo vive en el dataset de la pagina, no en el backend.
   */
  ocupacion?: number;
  rangosSemaforo?: RangoSemaforo;
  idSimulacion?: number | null;
}

/**
 * Mapeo de EstadoSemaforo a la variante visual del Tag.
 */
const TAG_VARIANT_BY_ESTADO: Record<EstadoSemaforo, "normal" | "elevado" | "critico"> = {
  normal: "normal",
  elevado: "elevado",
  critico: "critico",
};

const ESTADO_LABEL: Record<EstadoSemaforo, string> = {
  normal: "Normal",
  elevado: "Elevado",
  critico: "Critico",
};

const VUELO_ESTADO_LABEL: Record<string, string> = {
  programado: "Programado",
  en_vuelo: "En vuelo",
  completado: "Completado",
  cancelado: "Cancelado",
  abordando: "Abordando",
  aterrizando: "Aterrizando",
};

const formatArrivalTime = (iso: string): string => {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return "No disponible";
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${day}/${month} ${hour}:${minute}`;
};

/**
 * Drawer de detalle de aeropuerto.
 * Estandar 61 + mockup 04 del Figma.
 *
 * Carga el detalle del aeropuerto y sus vuelos conectados en paralelo
 * desde los servicios. Muestra estado de loading en la primera carga;
 * cuando los datos llegan, los renderiza progresivamente.
 */
const AirportDrawer = ({
  icao,
  ocupacion,
  rangosSemaforo,
  idSimulacion,
}: AirportDrawerProps) => {
  const close = useDrawerStore((s) => s.close);
  const openFlight = useDrawerStore((s) => s.openFlight);

  const [airport, setAirport] = useState<AirportWithCoords | null>(null);
  const [flights, setFlights] = useState<VueloDetalle[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    Promise.all([
      getAirportByIcao(icao),
      listFlightsByAirport(icao, idSimulacion),
    ])
      .then(([airportData, flightsData]) => {
        if (cancelled) return;
        setAirport(airportData);
        setFlights(flightsData);
        setIsLoading(false);
      })
      .catch(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [icao, idSimulacion]);

  const estado: EstadoSemaforo =
    ocupacion !== undefined
      ? getEstadoSemaforo(ocupacion, rangosSemaforo)
      : "normal";

  // Capacidad estimada para mostrar "X / Y maletas" en la barra del almacen.
  // Como el dato real viene del backend, en mock usamos la capacity del
  // aeropuerto del mock + un calculo proporcional al porcentaje.
  const capacity = airport?.capacity ?? 300;
  const ocupadas = ocupacion !== undefined
    ? Math.round((ocupacion / 100) * capacity)
    : 0;
  const activeFlights = flights.filter((flight) => flight.estado === "en_vuelo");

  if (isLoading || !airport) {
    return (
      <DrawerBase
        eyebrow="Aeropuerto"
        title={icao}
        onClose={close}
      >
        <p className="text-body text-text-tertiary">Cargando informacion...</p>
      </DrawerBase>
    );
  }

  return (
    <DrawerBase
      eyebrow="Aeropuerto"
      title={`${airport.icao} — ${airport.name}`}
      onClose={close}
    >
      {/* Estado */}
      <div className="flex items-center gap-3 mb-5">
        <Tag variant={TAG_VARIANT_BY_ESTADO[estado]}>{ESTADO_LABEL[estado]}</Tag>
        {ocupacion !== undefined && (
          <span className="text-button text-text-primary">
            Ocupacion:{" "}
            <span
              className={
                estado === "critico"
                  ? "text-danger"
                  : estado === "elevado"
                  ? "text-warning"
                  : "text-success"
              }
            >
              {Math.round(ocupacion)}%
            </span>
          </span>
        )}
      </div>

      {/* Informacion general */}
      <section className="mb-6">
        <h3 className="text-section-title mb-2">Informacion general</h3>
        <InfoRow label="Pais" value={airport.country} />
        <InfoRow label="Codigo IATA / ICAO" value={airport.icao} />
        <InfoRow label="Codigo ciudad" value={airport.cityCode.toUpperCase()} />
        <InfoRow label="Zona horaria" value={`UTC${airport.gmt >= 0 ? "+" : ""}${airport.gmt}`} />
        <InfoRow label="Capacidad" value={`${airport.capacity} maletas`} />
      </section>

      {/* Almacen */}
      {ocupacion !== undefined && (
        <section className="mb-6">
          <h3 className="text-section-title mb-3">Almacen</h3>
          <div className="bg-field rounded-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-body text-text-primary">
                Almacen Terminal 1
              </span>
              <span
                className={`text-button ${
                  estado === "critico"
                    ? "text-danger"
                    : estado === "elevado"
                    ? "text-warning"
                    : "text-success"
                }`}
              >
                {Math.round(ocupacion)}%
              </span>
            </div>
            <ProgressBar valor={ocupacion} variant={estado} />
            <p className="text-secondary text-text-tertiary mt-2">
              {ocupadas} / {capacity} maletas
            </p>
          </div>
        </section>
      )}

      {/* Vuelos conectados */}
      <section>
        <h3 className="text-section-title mb-3">
          Vuelos conectados{activeFlights.length > 0 && ` (${activeFlights.length})`}
        </h3>
        {activeFlights.length === 0 ? (
          <p className="text-body text-text-tertiary">
            No hay vuelos en curso asociados a este aeropuerto.
          </p>
        ) : (
          <ul className="space-y-2">
            {activeFlights.map((v) => (
              <li
                key={v.codigo}
                className="bg-field rounded-input px-3 py-2 flex items-center justify-between"
              >
                <div>
                  <button
                    type="button"
                    className="text-button text-primary hover:underline block"
                    onClick={() =>
                      openFlight(v.codigo, { idSimulacion })
                    }
                  >
                    {v.codigo}
                  </button>
                  <span className="text-secondary text-text-secondary">
                    {v.origenIcao} &gt; {v.destinoIcao}
                  </span>
                  <span className="text-secondary text-text-tertiary block">
                    Llegada: {formatArrivalTime(v.fechaLlegadaEstimada)}
                  </span>
                </div>
                <Tag
                  variant={v.estado === "en_vuelo" ? "primary" : "neutral"}
                >
                  {VUELO_ESTADO_LABEL[v.estado] ?? v.estado}
                </Tag>
              </li>
            ))}
          </ul>
        )}
      </section>
    </DrawerBase>
  );
};

export default AirportDrawer;
