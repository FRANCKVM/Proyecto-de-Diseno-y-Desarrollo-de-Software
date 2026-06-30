import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import DrawerBase from "@/components/drawers/DrawerBase";
import InfoRow from "@/components/molecules/InfoRow";
import FlightListCard from "@/components/molecules/FlightListCard";
import Tag from "@/components/atoms/Tag";
import ProgressBar from "@/components/atoms/ProgressBar";
import { getAirportByIcao } from "@/services/airportService";
import { listFlightsByAirport } from "@/services/flightService";
import { useFlightCancellationAction } from "@/hooks/useFlightCancellationAction";
import { useDrawerStore } from "@/store/drawerStore";
import { getEstadoSemaforo } from "@/utils/airportHelpers";
import {
  buildShipmentRouteSegments,
  resolveShipmentFocusTarget,
} from "@/utils/shipmentFocus";
import { getShipmentRouteGroups } from "@/utils/shipmentAssignments";
import { cn } from "@/utils/cn";
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
  simulationStart?: string | null;
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

const VUELO_ESTADO_TAG_VARIANT: Record<
  EstadoVuelo,
  "primary" | "neutral" | "normal" | "critico"
> = {
  programado: "neutral",
  en_vuelo: "primary",
  completado: "normal",
  cancelado: "critico",
};

const ENVIO_ESTADO_LABEL: Record<BackendSolicitudEnvio["estado"], string> = {
  INGRESADO: "Ingresado",
  PARCIAL: "Parcial",
  EN_PROCESO: "En proceso",
  COMPLETADO: "Completado",
};

const formatFlightDateTime = (iso: string): string => {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return "Sin dato";
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${day}/${month} ${hour}:${minute}`;
};

const getFlightOccupancyPct = (flight: VueloDetalle): number | undefined => {
  if (!flight.capacidad || flight.capacidad <= 0) {
    return undefined;
  }

  return Math.min(100, Math.max(0, (flight.ocupacion * 100) / flight.capacidad));
};

const getFlightProgressPct = (flight: VueloDetalle): number => {
  if (flight.estado === "completado") {
    return 100;
  }

  if (flight.estado !== "en_vuelo") {
    return 0;
  }

  const departureMs = Date.parse(flight.fechaSalida);
  const arrivalMs = Date.parse(flight.fechaLlegadaEstimada);

  if (
    Number.isNaN(departureMs) ||
    Number.isNaN(arrivalMs) ||
    arrivalMs <= departureMs
  ) {
    return 0;
  }

  const progress = ((Date.now() - departureMs) * 100) / (arrivalMs - departureMs);
  return Math.round(Math.max(0, Math.min(100, progress)));
};

const getFlightActionKey = (flight: VueloDetalle): string =>
  `${flight.codigo}-${flight.fechaSalida}`;

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
type AirportViewMode = "vuelos" | "envios";
type DirectionFilter = "todos" | "entrantes" | "salientes";
const PANEL_REFRESH_MS_SIMULATION = 1500;
const PANEL_REFRESH_MS_OPERATION = 5000;

const DIRECTION_LABEL: Record<DirectionFilter, string> = {
  todos: "Todos",
  entrantes: "Entrantes",
  salientes: "Salientes",
};

const hasIncomingShipmentAtAirport = (
  shipment: BackendSolicitudEnvio,
  airportIcao: string
): boolean => {
  if (shipment.destino.codigo === airportIcao) {
    return true;
  }

  return getShipmentRouteGroups(shipment).some((group) =>
    group.ruta?.vuelos?.some((flight) => flight.hasta.codigo === airportIcao)
  );
};

const hasOutgoingShipmentAtAirport = (
  shipment: BackendSolicitudEnvio,
  airportIcao: string
): boolean => {
  if (shipment.origen.codigo === airportIcao) {
    return true;
  }

  return getShipmentRouteGroups(shipment).some((group) =>
    group.ruta?.vuelos?.some((flight) => flight.desde.codigo === airportIcao)
  );
};

const AirportDrawer = ({
  icao,
  ocupacion,
  rangosSemaforo,
  idSimulacion,
  shipments = [],
  showFlights = true,
  referenceMinute,
  simulationStart,
}: AirportDrawerProps) => {
  const close = useDrawerStore((s) => s.close);
  const openFlight = useDrawerStore((s) => s.openFlight);
  const openShipment = useDrawerStore((s) => s.openShipment);

  const [airport, setAirport] = useState<AirportWithCoords | null>(null);
  const [flights, setFlights] = useState<VueloDetalle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeView, setActiveView] = useState<AirportViewMode>(
    showFlights ? "vuelos" : "envios"
  );
  const [selectedEstado, setSelectedEstado] = useState<FlightFilter>("todos");
  const [flightSearch, setFlightSearch] = useState("");
  const [selectedFlightDirection, setSelectedFlightDirection] =
    useState<DirectionFilter>("todos");
  const [selectedShipmentDirection, setSelectedShipmentDirection] =
    useState<DirectionFilter>("todos");
  const {
    cancelFlight,
    cancellingFlightKey,
    cancelError,
    cancelNotice,
  } = useFlightCancellationAction({
    idSimulacion,
    referenceMinute,
    simulationStart,
  });

  useEffect(() => {
    let cancelled = false;

    const refreshMs =
      idSimulacion != null
        ? PANEL_REFRESH_MS_SIMULATION
        : PANEL_REFRESH_MS_OPERATION;

    const loadAirportData = async (
      showLoading: boolean,
      forceRefresh: boolean
    ) => {
      if (showLoading) {
        setIsLoading(true);
      }

      try {
        const [airportData, flightsData] = await Promise.all([
          getAirportByIcao(icao),
          listFlightsByAirport(icao, idSimulacion, { forceRefresh }),
        ]);

        if (cancelled) return;
        setAirport(airportData);
        setFlights(flightsData);
      } finally {
        if (!cancelled && showLoading) {
          setIsLoading(false);
        }
      }
    };

    void loadAirportData(true, false);
    const intervalId = window.setInterval(() => {
      void loadAirportData(false, true);
    }, refreshMs);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [icao, idSimulacion]);

  useEffect(() => {
    setActiveView(showFlights ? "vuelos" : "envios");
    setSelectedEstado("todos");
    setFlightSearch("");
    setSelectedFlightDirection("todos");
    setSelectedShipmentDirection("todos");
  }, [icao, idSimulacion, showFlights]);

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
  const incomingFlightsCount = flights.filter(
    (flight) => flight.destinoIcao === icao
  ).length;
  const outgoingFlightsCount = flights.filter(
    (flight) => flight.origenIcao === icao
  ).length;
  const filteredFlights = flights.filter((flight) => {
    const normalizedSearch = flightSearch.trim().toLowerCase();
    const matchesEstado =
      selectedEstado === "todos" || flight.estado === selectedEstado;
    const matchesDirection =
      selectedFlightDirection === "todos" ||
      (selectedFlightDirection === "entrantes" && flight.destinoIcao === icao) ||
      (selectedFlightDirection === "salientes" && flight.origenIcao === icao);
    const matchesSearch =
      normalizedSearch.length === 0 ||
      flight.codigo.toLowerCase().includes(normalizedSearch);

    return matchesEstado && matchesDirection && matchesSearch;
  });
  const shipmentRelations = shipments.map((shipment) => ({
    shipment,
    incoming: hasIncomingShipmentAtAirport(shipment, icao),
    outgoing: hasOutgoingShipmentAtAirport(shipment, icao),
  }));
  const incomingShipmentsCount = shipmentRelations.filter(
    (relation) => relation.incoming
  ).length;
  const outgoingShipmentsCount = shipmentRelations.filter(
    (relation) => relation.outgoing
  ).length;
  const airportShipmentsCount = shipmentRelations.filter(
    (relation) => relation.incoming || relation.outgoing
  ).length;
  const filteredShipmentRelations = shipmentRelations.filter((relation) => {
    if (selectedShipmentDirection === "entrantes") {
      return relation.incoming;
    }

    if (selectedShipmentDirection === "salientes") {
      return relation.outgoing;
    }

    return relation.incoming || relation.outgoing;
  });
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
    const actionKey = getFlightActionKey(flight);

    await cancelFlight({
      actionKey,
      codigo: flight.codigo,
      fechaSalida: flight.fechaSalida,
      fallbackAirportIcao: flight.origenIcao,
      fallbackFlightCode: flight.codigo,
      onCancelled: ({ updatedFlight }) => {
        setFlights((currentFlights) => {
          const nextFlights = currentFlights.map((candidate) =>
            candidate.codigo === updatedFlight.codigo ? updatedFlight : candidate
          );
          if (idSimulacion == null) {
            cacheFlightsForAirport(icao, nextFlights);
          }
          return nextFlights;
        });
      },
    });
  };

  if (isLoading || !airport) {
    return (
      <DrawerBase
        eyebrow="Aeropuerto"
        title={icao}
        onClose={close}
      >
        <p className="text-body text-text-primary">Cargando informacion...</p>
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
            <p className="text-secondary text-text-primary mt-2">
              {ocupadas} / {capacity} maletas
            </p>
          </div>
        </section>
      )}

      <section>
        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveView("vuelos")}
            className={cn(
              "px-3 py-2 rounded-input border text-button transition-colors",
              activeView === "vuelos"
                ? "bg-primary border-primary text-text-inverse"
                : "bg-card border-border text-text-primary hover:bg-field"
            )}
          >
            Vuelos
          </button>
          <button
            type="button"
            onClick={() => setActiveView("envios")}
            className={cn(
              "px-3 py-2 rounded-input border text-button transition-colors",
              activeView === "envios"
                ? "bg-primary border-primary text-text-inverse"
                : "bg-card border-border text-text-primary hover:bg-field"
            )}
          >
            Envios
          </button>
        </div>

        {activeView === "vuelos" ? (
          <>
            <h3 className="text-section-title mb-3">
              Vuelos del almacen{filteredFlights.length > 0 && ` (${filteredFlights.length})`}
            </h3>
            <div className="mb-4 grid grid-cols-1 gap-3">
              <div>
                <label
                  htmlFor="airport-flight-search"
                  className="block text-label-sm text-text-primary mb-1"
                >
                  Buscar por ID de vuelo
                </label>
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
                    aria-hidden
                  />
                  <input
                    id="airport-flight-search"
                    type="search"
                    value={flightSearch}
                    onChange={(event) => setFlightSearch(event.target.value)}
                    placeholder="Ej. 1024 o VUE-1024"
                    className="w-full bg-field border border-border rounded-input pl-9 pr-3 py-2 text-button text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="airport-flight-direction-filter"
                  className="block text-label-sm text-text-primary mb-1"
                >
                  Filtrar por movimiento
                </label>
                <select
                  id="airport-flight-direction-filter"
                  value={selectedFlightDirection}
                  onChange={(event) =>
                    setSelectedFlightDirection(event.target.value as DirectionFilter)
                  }
                  className="w-full bg-field border border-border rounded-input px-3 py-2 text-button text-text-primary focus:outline-none focus:border-primary"
                >
                  <option value="todos">{DIRECTION_LABEL.todos} ({flights.length})</option>
                  <option value="entrantes">
                    {DIRECTION_LABEL.entrantes} ({incomingFlightsCount})
                  </option>
                  <option value="salientes">
                    {DIRECTION_LABEL.salientes} ({outgoingFlightsCount})
                  </option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="airport-flight-filter"
                  className="block text-label-sm text-text-primary mb-1"
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
            </div>

            {cancelError && (
              <p className="text-secondary text-danger mb-3">{cancelError}</p>
            )}
            {filteredFlights.length === 0 ? (
              <p className="text-body text-text-primary">
                No hay vuelos asociados a este almacen para la busqueda o filtros seleccionados.
              </p>
            ) : (
              <div className="space-y-2">
                {filteredFlights.map((v) => {
                  const actionKey = getFlightActionKey(v);
                  const occupancyPct = getFlightOccupancyPct(v);
                  const progressPct = getFlightProgressPct(v);

                  return (
                    <FlightListCard
                      key={`${v.codigo}-${v.fechaSalida}`}
                      code={v.codigo}
                      routeText={`${v.origenIcao} > ${v.destinoIcao}`}
                      metaText={v.origenIcao === icao ? "Saliente" : "Entrante"}
                      statusLabel={VUELO_ESTADO_LABEL[v.estado] ?? v.estado}
                      statusVariant={VUELO_ESTADO_TAG_VARIANT[v.estado]}
                      departureText={formatFlightDateTime(v.fechaSalida)}
                      arrivalText={formatFlightDateTime(v.fechaLlegadaEstimada)}
                      progressPct={progressPct}
                      occupancyPct={occupancyPct}
                      rangosSemaforo={rangosSemaforo}
                      canCancel={v.estado === "programado"}
                      isCancelling={cancellingFlightKey === actionKey}
                      notice={
                        cancelNotice?.actionKey === actionKey
                          ? cancelNotice.message
                          : null
                      }
                      onOpen={() =>
                        openFlight(v.codigo, {
                          idSimulacion,
                          showOnlyOnMap: v.estado === "en_vuelo",
                        })
                      }
                      onCancel={() => {
                        void handleCancelFlight(v);
                      }}
                    />
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
            <h3 className="text-section-title mb-3">
              Envios del almacen{filteredShipmentRelations.length > 0 && ` (${filteredShipmentRelations.length})`}
            </h3>
            <div className="mb-4">
              <label
                htmlFor="airport-shipment-direction-filter"
                className="block text-label-sm text-text-primary mb-1"
              >
                Filtrar por movimiento
              </label>
              <select
                id="airport-shipment-direction-filter"
                value={selectedShipmentDirection}
                onChange={(event) =>
                  setSelectedShipmentDirection(event.target.value as DirectionFilter)
                }
                className="w-full bg-field border border-border rounded-input px-3 py-2 text-button text-text-primary focus:outline-none focus:border-primary"
              >
                <option value="todos">
                  {DIRECTION_LABEL.todos} ({airportShipmentsCount})
                </option>
                <option value="entrantes">
                  {DIRECTION_LABEL.entrantes} ({incomingShipmentsCount})
                </option>
                <option value="salientes">
                  {DIRECTION_LABEL.salientes} ({outgoingShipmentsCount})
                </option>
              </select>
            </div>

            {filteredShipmentRelations.length === 0 ? (
              <p className="text-body text-text-primary">
                No hay envios asociados a este almacen para el filtro seleccionado.
              </p>
            ) : (
              <ul className="space-y-2">
                {filteredShipmentRelations.map(({ shipment, incoming, outgoing }) => (
                  <li
                    key={getShipmentKey(shipment)}
                    className="bg-field rounded-input px-3 py-2 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
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
                      <span className="text-secondary text-text-primary">
                        {shipment.origen.codigo} &gt; {shipment.destino.codigo}
                      </span>
                      <span className="text-secondary text-text-primary block">
                        Registro: {formatShipmentDateTime(shipment.fecha, shipment.hora)}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {outgoing && <Tag variant="primary">Saliente</Tag>}
                      {incoming && <Tag variant="neutral">Entrante</Tag>}
                      <Tag
                        variant={shipment.estado === "COMPLETADO" ? "normal" : "primary"}
                      >
                        {ENVIO_ESTADO_LABEL[shipment.estado]}
                      </Tag>
                      <span className="text-secondary text-text-primary">
                        {shipment.contarBolsas} maletas
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </DrawerBase>
  );
};

export default AirportDrawer;
