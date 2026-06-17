import { useEffect, useState } from "react";
import DrawerBase from "@/components/drawers/DrawerBase";
import InfoRow from "@/components/molecules/InfoRow";
import Tag from "@/components/atoms/Tag";
import ProgressBar from "@/components/atoms/ProgressBar";
import { getAirportByIcao } from "@/services/airportService";
import {
  cancelFlightByCode,
  listFlightsByAirport,
} from "@/services/flightService";
import { useDrawerStore } from "@/store/drawerStore";
import { getEstadoSemaforo } from "@/utils/airportHelpers";
import {
  buildShipmentRouteSegments,
  resolveShipmentFocusTarget,
} from "@/utils/shipmentFocus";
import { cacheFlightsForAirport } from "@/store/referenceDataStore";
import type { AirportWithCoords } from "@/types/airport.types";
import type { BackendSolicitudEnvio } from "@/types/backendSimulation.types";
import type { EstadoVuelo, VueloDetalle } from "@/types/flight.types";
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
  shipments?: BackendSolicitudEnvio[];
  showFlights?: boolean;
  referenceMinute?: number | null;
}

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
};

const ENVIO_ESTADO_LABEL: Record<BackendSolicitudEnvio["estado"], string> = {
  INGRESADO: "Ingresado",
  PARCIAL: "Parcial",
  EN_PROCESO: "En proceso",
  COMPLETADO: "Completado",
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

const formatShipmentDateTime = (fecha: string, hora: string): string => {
  const iso = `${fecha}T${hora}${hora.length === 5 ? ":00" : ""}Z`;
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return `${fecha} ${hora}`;
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const hourPart = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${day}/${month} ${hourPart}:${minute}`;
};

const getShipmentKey = (shipment: BackendSolicitudEnvio): string =>
  shipment.idEnvio !== null
    ? `envio-${shipment.idEnvio}`
    : `${shipment.fecha}-${shipment.hora}-${shipment.origen.codigo}-${shipment.destino.codigo}-${shipment.contarBolsas}`;

const formatShipmentCode = (idEnvio: number): string =>
  `ENV-${String(idEnvio).padStart(3, "0")}`;

const getShipmentCodeLabel = (shipment: BackendSolicitudEnvio): string =>
  shipment.idEnvio !== null
    ? formatShipmentCode(shipment.idEnvio)
    : `Envio ${shipment.origen.codigo}-${shipment.destino.codigo}`;

type FlightFilter = "todos" | EstadoVuelo;

const AirportDrawer = ({
  icao,
  ocupacion,
  rangosSemaforo,
  idSimulacion,
  shipments = [],
  showFlights = true,
  referenceMinute,
}: AirportDrawerProps) => {
  const close = useDrawerStore((s) => s.close);
  const openFlight = useDrawerStore((s) => s.openFlight);
  const openShipment = useDrawerStore((s) => s.openShipment);

  const [airport, setAirport] = useState<AirportWithCoords | null>(null);
  const [flights, setFlights] = useState<VueloDetalle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEstado, setSelectedEstado] = useState<FlightFilter>("todos");
  const [cancellingFlightCode, setCancellingFlightCode] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

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

  useEffect(() => {
    setSelectedEstado("todos");
  }, [icao, idSimulacion]);

  const estado: EstadoSemaforo =
    ocupacion !== undefined
      ? getEstadoSemaforo(ocupacion, rangosSemaforo)
      : "normal";

  const capacity = airport?.capacity ?? 300;
  const ocupadas = ocupacion !== undefined
    ? Math.round((ocupacion / 100) * capacity)
    : 0;
  const availableEstados = Array.from(
    new Set(flights.map((flight) => flight.estado))
  ) as EstadoVuelo[];
  const filterOptions: FlightFilter[] = ["todos", ...availableEstados];
  const filteredFlights = selectedEstado === "todos"
    ? flights
    : flights.filter((flight) => flight.estado === selectedEstado);
  const outgoingShipments = shipments.filter((shipment) => shipment.origen.codigo === icao);
  const incomingShipments = shipments.filter((shipment) => shipment.destino.codigo === icao);
  const handleOpenShipment = (shipment: BackendSolicitudEnvio) => {
    if (shipment.idEnvio === null) {
      return;
    }

    openShipment(
      formatShipmentCode(shipment.idEnvio),
      {
        idSimulacion,
        ...resolveShipmentFocusTarget(shipment, referenceMinute),
        shipmentRouteSegments: buildShipmentRouteSegments(shipment),
      }
    );
  };

  const handleCancelFlight = async (flight: VueloDetalle) => {
    setCancellingFlightCode(flight.codigo);
    setCancelError(null);

    try {
      const updatedFlight = await cancelFlightByCode(
        flight.codigo,
        flight.fechaSalida,
        idSimulacion
      );
      setFlights((currentFlights) => {
        const nextFlights = currentFlights.map((candidate) =>
          candidate.codigo === updatedFlight.codigo ? updatedFlight : candidate
        );
        if (idSimulacion == null) {
          cacheFlightsForAirport(icao, nextFlights);
        }
        return nextFlights;
      });
      setSelectedEstado("cancelado");
    } catch (error: any) {
      const message =
        typeof error?.response?.data === "string"
          ? error.response.data
          : "No se pudo cancelar el vuelo.";
      setCancelError(message);
    } finally {
      setCancellingFlightCode(null);
    }
  };

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
      title={`${airport.icao} - ${airport.name}`}
      onClose={close}
    >
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

      <section className="mb-6">
        <h3 className="text-section-title mb-2">Informacion general</h3>
        <InfoRow label="Pais" value={airport.country} />
        <InfoRow label="Codigo IATA / ICAO" value={airport.icao} />
        <InfoRow label="Codigo ciudad" value={airport.cityCode.toUpperCase()} />
        <InfoRow label="Zona horaria" value={`UTC${airport.gmt >= 0 ? "+" : ""}${airport.gmt}`} />
        <InfoRow label="Capacidad" value={`${airport.capacity} maletas`} />
      </section>

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

      {showFlights && (
        <section>
          <h3 className="text-section-title mb-3">
            Vuelos del dia{filteredFlights.length > 0 && ` (${filteredFlights.length})`}
          </h3>
          {filterOptions.length > 1 && (
            <div className="mb-4">
              <label
                htmlFor="airport-flight-filter"
                className="block text-label-sm text-text-tertiary mb-1"
              >
                Filtrar por estado
              </label>
              <select
                id="airport-flight-filter"
                value={selectedEstado}
                onChange={(event) =>
                  setSelectedEstado(event.target.value as FlightFilter)
                }
                className="w-full bg-field border border-border rounded-input px-3 py-2 text-button text-text-primary focus:outline-none focus:border-primary"
              >
                {filterOptions.map((estadoFiltro) => {
                  const count = estadoFiltro === "todos"
                    ? flights.length
                    : flights.filter((flight) => flight.estado === estadoFiltro).length;

                  return (
                    <option key={estadoFiltro} value={estadoFiltro}>
                      {(estadoFiltro === "todos"
                        ? "Todos"
                        : (VUELO_ESTADO_LABEL[estadoFiltro] ?? estadoFiltro)) + ` (${count})`}
                    </option>
                  );
                })}
              </select>
            </div>
          )}
          {cancelError && (
            <p className="text-secondary text-danger mb-3">{cancelError}</p>
          )}
          {filteredFlights.length === 0 ? (
            <p className="text-body text-text-tertiary">
              No hay vuelos asociados a este aeropuerto para el filtro seleccionado.
            </p>
          ) : (
            <ul className="space-y-2">
              {filteredFlights.map((v) => (
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
                      {v.estado === "cancelado"
                        ? `Salida programada: ${formatArrivalTime(v.fechaSalida)}`
                        : `Llegada: ${formatArrivalTime(v.fechaLlegadaEstimada)}`}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Tag
                      variant={v.estado === "en_vuelo" ? "primary" : "neutral"}
                    >
                      {VUELO_ESTADO_LABEL[v.estado] ?? v.estado}
                    </Tag>
                    {v.estado === "programado" && (
                      <button
                        type="button"
                        onClick={() => {
                          void handleCancelFlight(v);
                        }}
                        disabled={cancellingFlightCode === v.codigo}
                        className="px-3 py-1.5 rounded-input border border-danger text-secondary text-danger bg-card hover:bg-danger/10 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {cancellingFlightCode === v.codigo
                          ? "Cancelando..."
                          : "Cancelar"}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {!showFlights && (
        <>
          <section>
            <h3 className="text-section-title mb-3">
              Envios salientes{outgoingShipments.length > 0 && ` (${outgoingShipments.length})`}
            </h3>
            {outgoingShipments.length === 0 ? (
              <p className="text-body text-text-tertiary">
                No hay envios salientes asociados a este almacen.
              </p>
            ) : (
              <ul className="space-y-2">
                {outgoingShipments.map((shipment) => (
                  <li
                    key={getShipmentKey(shipment)}
                    className="bg-field rounded-input px-3 py-2 flex items-center justify-between"
                  >
                    <div>
                      {shipment.idEnvio !== null ? (
                        <button
                          type="button"
                          className="text-button text-primary hover:underline block"
                          onClick={() => handleOpenShipment(shipment)}
                        >
                          {getShipmentCodeLabel(shipment)}
                        </button>
                      ) : (
                        <p className="text-button text-text-primary">
                          {getShipmentCodeLabel(shipment)}
                        </p>
                      )}
                      <span className="text-secondary text-text-secondary">
                        {shipment.origen.codigo} &gt; {shipment.destino.codigo}
                      </span>
                      <span className="text-secondary text-text-tertiary block">
                        Registro: {formatShipmentDateTime(shipment.fecha, shipment.hora)}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Tag
                        variant={shipment.estado === "COMPLETADO" ? "normal" : "primary"}
                      >
                        {ENVIO_ESTADO_LABEL[shipment.estado]}
                      </Tag>
                      <span className="text-secondary text-text-tertiary">
                        {shipment.contarBolsas} maletas
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-6">
            <h3 className="text-section-title mb-3">
              Envios entrantes{incomingShipments.length > 0 && ` (${incomingShipments.length})`}
            </h3>
            {incomingShipments.length === 0 ? (
              <p className="text-body text-text-tertiary">
                No hay envios entrantes asociados a este almacen.
              </p>
            ) : (
              <ul className="space-y-2">
                {incomingShipments.map((shipment) => (
                  <li
                    key={getShipmentKey(shipment)}
                    className="bg-field rounded-input px-3 py-2 flex items-center justify-between"
                  >
                    <div>
                      {shipment.idEnvio !== null ? (
                        <button
                          type="button"
                          className="text-button text-primary hover:underline block"
                          onClick={() => handleOpenShipment(shipment)}
                        >
                          {getShipmentCodeLabel(shipment)}
                        </button>
                      ) : (
                        <p className="text-button text-text-primary">
                          {getShipmentCodeLabel(shipment)}
                        </p>
                      )}
                      <span className="text-secondary text-text-secondary">
                        {shipment.origen.codigo} &gt; {shipment.destino.codigo}
                      </span>
                      <span className="text-secondary text-text-tertiary block">
                        Registro: {formatShipmentDateTime(shipment.fecha, shipment.hora)}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Tag
                        variant={shipment.estado === "COMPLETADO" ? "normal" : "primary"}
                      >
                        {ENVIO_ESTADO_LABEL[shipment.estado]}
                      </Tag>
                      <span className="text-secondary text-text-tertiary">
                        {shipment.contarBolsas} maletas
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </DrawerBase>
  );
};

export default AirportDrawer;
