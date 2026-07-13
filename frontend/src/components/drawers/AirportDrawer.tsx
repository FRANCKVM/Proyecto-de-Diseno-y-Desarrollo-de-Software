import { useEffect, useState } from "react";
import { Eye, Search } from "lucide-react";
import DrawerBase from "@/components/drawers/DrawerBase";
import InfoRow from "@/components/molecules/InfoRow";
import FlightListCard from "@/components/molecules/FlightListCard";
import FlightCancellationPopup from "@/components/molecules/FlightCancellationPopup";
import Tag from "@/components/atoms/Tag";
import { getAirportByIcao } from "@/services/airportService";
import {
  listFlightsByAirport,
  resolveFlightQueryDate,
} from "@/services/flightService";
import { useFlightCancellationAction } from "@/hooks/useFlightCancellationAction";
import { useDrawerStore } from "@/store/drawerStore";
import {
  buildShipmentRouteSegments,
} from "@/utils/shipmentFocus";
import { getShipmentRouteGroups } from "@/utils/shipmentAssignments";
import {
  formatShipmentDisplayCode,
  getShipmentApiIdentifier,
} from "@/utils/shipmentCode";
import { cn } from "@/utils/cn";
import {
  formatUtcDateTime,
  parseUtcDateTimeMs,
} from "@/utils/utcDateTime";
import { cacheFlightsForAirport } from "@/store/referenceDataStore";
import type { AirportWithCoords } from "@/types/airport.types";
import type { BackendSolicitudEnvio } from "@/types/backendSimulation.types";
import type { EstadoVuelo, VueloDetalle } from "@/types/flight.types";
import type { RangoSemaforo } from "@/types/common.types";

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
  return formatUtcDateTime(iso, "Sin dato");
};

const parseDateTimeMs = (value: string | null | undefined): number | null => {
  if (!value) {
    return null;
  }

  return parseUtcDateTimeMs(value);
};

const isFlightRelevantAtReference = (
  flight: VueloDetalle,
  simulationStart: string | null | undefined,
  referenceMinute: number | null | undefined
): boolean => {
  const simulationStartMs = parseDateTimeMs(simulationStart);
  if (simulationStartMs === null || referenceMinute == null) {
    return true;
  }

  const departureMs = parseDateTimeMs(flight.fechaSalida);
  return departureMs === null || departureMs >= simulationStartMs;
};

const resolveFlightStatusAtReference = (
  flight: VueloDetalle,
  simulationStart: string | null | undefined,
  referenceMinute: number | null | undefined
): EstadoVuelo => {
  if (flight.estado === "cancelado") {
    return "cancelado";
  }

  const simulationStartMs = parseDateTimeMs(simulationStart);
  if (simulationStartMs === null || referenceMinute == null) {
    return flight.estado;
  }

  const referenceMs = simulationStartMs + Math.max(0, referenceMinute) * 60_000;
  const departureMs = parseDateTimeMs(flight.fechaSalida);
  const arrivalMs = parseDateTimeMs(flight.fechaLlegadaEstimada);

  if (departureMs === null || arrivalMs === null || arrivalMs <= departureMs) {
    return flight.estado;
  }

  if (referenceMs < departureMs) {
    return "programado";
  }

  if (referenceMs < arrivalMs) {
    return "en_vuelo";
  }

  return "completado";
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

  const departureMs = parseUtcDateTimeMs(flight.fechaSalida);
  const arrivalMs = parseUtcDateTimeMs(flight.fechaLlegadaEstimada);

  if (
    departureMs === null ||
    arrivalMs === null ||
    arrivalMs <= departureMs
  ) {
    return 0;
  }

  const progress = ((Date.now() - departureMs) * 100) / (arrivalMs - departureMs);
  return Math.round(Math.max(0, Math.min(100, progress)));
};

const getFlightActionKey = (flight: VueloDetalle): string =>
  `${flight.codigo}-${flight.fechaSalida}`;

const formatFlightDisplayCode = (flight: VueloDetalle): string =>
  `${flight.origenIcao}>${flight.destinoIcao}-${flight.codigo}`;

const formatShipmentDateTime = (fecha: string, hora: string): string => {
  return formatUtcDateTime(
    `${fecha}T${hora}${hora.length === 5 ? ":00" : ""}`,
    `${fecha} ${hora}`
  );
};

const getShipmentKey = (shipment: BackendSolicitudEnvio): string =>
  shipment.idEnvio !== null
    ? `envio-${shipment.idEnvio}`
    : `${shipment.fecha}-${shipment.hora}-${shipment.origen.codigo}-${shipment.destino.codigo}-${shipment.contarBolsas}`;

const getShipmentCodeLabel = (shipment: BackendSolicitudEnvio): string =>
  shipment.idEnvio !== null
    ? formatShipmentDisplayCode(shipment.idEnvio)
    : `Envío ${shipment.origen.codigo}-${shipment.destino.codigo}`;

type ShipmentStatus = "planificados" | "en-curso" | "entregados";

const getShipmentTimeline = (
  shipment: BackendSolicitudEnvio,
  simulationStart?: string | null
): { firstDeparture: number | null; lastArrival: number | null } => {
  const routeGroups = getShipmentRouteGroups(shipment);
  let firstDeparture: number | null = null;
  let lastArrival: number | null = null;

  for (const group of routeGroups) {
    for (const occurrence of group.ruta?.ocurrencias ?? []) {
      const baseMs =
        parseDateTimeMs(simulationStart) ??
        parseDateTimeMs(`${shipment.fecha}T00:00:00`);
      const departureMs = parseDateTimeMs(occurrence.fechaHoraSalida);
      const arrivalMs = parseDateTimeMs(occurrence.fechaHoraLlegada);

      if (baseMs === null || departureMs === null || arrivalMs === null) {
        continue;
      }

      const departure = Math.round((departureMs - baseMs) / 60_000);
      const arrival = Math.round((arrivalMs - baseMs) / 60_000);
      firstDeparture =
        firstDeparture === null ? departure : Math.min(firstDeparture, departure);
      lastArrival = lastArrival === null ? arrival : Math.max(lastArrival, arrival);
    }
  }

  return { firstDeparture, lastArrival };
};

const resolveDerivedShipmentStatus = (
  shipment: BackendSolicitudEnvio,
  referenceMinute: number | null | undefined,
  simulationStart?: string | null
): ShipmentStatus => {
  if (shipment.estado === "COMPLETADO") {
    return "entregados";
  }

  if (referenceMinute === null || referenceMinute === undefined) {
    return shipment.estado === "PARCIAL" || shipment.estado === "EN_PROCESO"
      ? "en-curso"
      : "planificados";
  }

  const timeline = getShipmentTimeline(shipment, simulationStart);
  if (timeline.lastArrival !== null && referenceMinute >= timeline.lastArrival) {
    return "entregados";
  }

  if (
    shipment.estado === "PARCIAL" ||
    shipment.estado === "EN_PROCESO" ||
    (timeline.firstDeparture !== null && referenceMinute >= timeline.firstDeparture)
  ) {
    return "en-curso";
  }

  return "planificados";
};

const getDerivedShipmentStatusLabel = (
  shipment: BackendSolicitudEnvio,
  status: ShipmentStatus
): string => {
  if (status === "entregados") {
    return "Completado";
  }

  if (status === "en-curso") {
    return "En curso";
  }

  return ENVIO_ESTADO_LABEL[shipment.estado];
};

type FlightFilter = "todos" | EstadoVuelo;
type AirportViewMode = "vuelos" | "envios";
type DirectionFilter = "todos" | "entrantes" | "salientes";
const PANEL_REFRESH_MS_SIMULATION = 5000;
const PANEL_REFRESH_MS_OPERATION = 15000;

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
    group.ruta?.ocurrencias?.some((occurrence) => occurrence.vuelo.hasta.codigo === airportIcao)
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
    group.ruta?.ocurrencias?.some((occurrence) => occurrence.vuelo.desde.codigo === airportIcao)
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
  const focusFlightOnMap = useDrawerStore((s) => s.focusFlightOnMap);
  const openShipment = useDrawerStore((s) => s.openShipment);
  const focusShipmentRouteSegments = useDrawerStore(
    (s) => s.focusShipmentRouteSegments
  );

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
  const queryDate = resolveFlightQueryDate(
    idSimulacion,
    simulationStart,
    referenceMinute
  );
  const {
    cancelFlight,
    cancellingFlightKey,
    cancelError,
    cancelNotice,
    cancelPopup,
    dismissCancelPopup,
  } = useFlightCancellationAction({
    idSimulacion,
    referenceMinute,
    simulationStart,
  });

  useEffect(() => {
    if (!icao) {
      return;
    }

    let cancelled = false;
    let requestInFlight = false;
    const canPoll = () =>
      typeof document === "undefined" || document.visibilityState === "visible";

    const refreshMs =
      idSimulacion != null
        ? PANEL_REFRESH_MS_SIMULATION
        : PANEL_REFRESH_MS_OPERATION;

    const loadAirportData = async (
      showLoading: boolean,
      forceRefresh: boolean
    ) => {
      if (!canPoll() || requestInFlight) return;
      requestInFlight = true;
      if (showLoading) {
        setIsLoading(true);
      }

      try {
        const airportData = showLoading ? await getAirportByIcao(icao) : null;
        const flightsData = await listFlightsByAirport(icao, idSimulacion, {
          forceRefresh,
          fecha: queryDate,
        });

        if (cancelled) return;
        if (airportData) setAirport(airportData);
        setFlights(flightsData);
      } finally {
        requestInFlight = false;
        if (!cancelled && showLoading) {
          setIsLoading(false);
        }
      }
    };

    // La lista cacheada puede quedar desfasada respecto a la ocupación y los
    // envíos actuales. Al abrir el almacén solicitamos los vuelos actualizados.
    void loadAirportData(true, true);
    const intervalId = window.setInterval(() => {
      void loadAirportData(false, true);
    }, refreshMs);
    const handleVisibilityChange = () => {
      if (canPoll()) {
        void loadAirportData(false, true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [icao, idSimulacion, queryDate]);

  useEffect(() => {
    setActiveView(showFlights ? "vuelos" : "envios");
    setSelectedEstado("todos");
    setFlightSearch("");
    setSelectedFlightDirection("todos");
    setSelectedShipmentDirection("todos");
  }, [icao, idSimulacion, showFlights]);

  const capacity = airport?.capacity ?? 300;
  const ocupadas = ocupacion !== undefined
    ? Math.round((ocupacion / 100) * capacity)
    : 0;
  const currentFlights = flights
    .filter((flight) =>
      isFlightRelevantAtReference(flight, simulationStart, referenceMinute)
    )
    .map((flight) => ({
      ...flight,
      estado: resolveFlightStatusAtReference(
        flight,
        simulationStart,
        referenceMinute
      ),
    }));
  const availableEstados = Array.from(
    new Set(currentFlights.map((flight) => flight.estado))
  ) as EstadoVuelo[];
  const filterOptions: FlightFilter[] = ["todos", ...availableEstados];
  const incomingFlightsCount = currentFlights.filter(
    (flight) => flight.destinoIcao === icao
  ).length;
  const outgoingFlightsCount = currentFlights.filter(
    (flight) => flight.origenIcao === icao
  ).length;
  const filteredFlights = currentFlights.filter((flight) => {
    const normalizedSearch = flightSearch.trim().toLowerCase();
    const matchesEstado =
      selectedEstado === "todos" || flight.estado === selectedEstado;
    const matchesDirection =
      selectedFlightDirection === "todos" ||
      (selectedFlightDirection === "entrantes" && flight.destinoIcao === icao) ||
      (selectedFlightDirection === "salientes" && flight.origenIcao === icao);
    const matchesSearch =
      normalizedSearch.length === 0 ||
      flight.codigo.toLowerCase().startsWith(normalizedSearch) ||
      formatFlightDisplayCode(flight).toLowerCase().startsWith(normalizedSearch);

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
      getShipmentApiIdentifier(shipment.idEnvio),
        {
          idSimulacion,
          displayCodigo: getShipmentCodeLabel(shipment),
        }
    );
  };

  const handleFocusShipmentRoute = (shipment: BackendSolicitudEnvio) => {
    focusShipmentRouteSegments(buildShipmentRouteSegments(shipment));
  };

  const handleCancelFlight = async (flight: VueloDetalle) => {
    const actionKey = getFlightActionKey(flight);

    await cancelFlight({
      actionKey,
      idOcurrencia: flight.idOcurrencia,
      fechaSalida: flight.fechaSalida,
      fallbackAirportIcao: flight.origenIcao,
      fallbackFlightCode: flight.codigo,
      onCancelled: ({ updatedFlight }) => {
        setFlights((currentFlights) => {
          const nextFlights = currentFlights.map((candidate) =>
            candidate.idOcurrencia === updatedFlight.idOcurrencia
              ? updatedFlight
              : candidate
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
        <p className="text-body text-text-primary">Cargando información...</p>
      </DrawerBase>
    );
  }

  return (
    <DrawerBase
      eyebrow="Aeropuerto"
      title={`${airport.icao} - ${airport.name}`}
      onClose={close}
    >
      <FlightCancellationPopup
        message={cancelPopup?.message ?? null}
        tone={cancelPopup?.tone}
        onClose={dismissCancelPopup}
      />
      <section className="mb-6">
        <h3 className="text-section-title mb-2">Información general</h3>
        <InfoRow label="Pais" value={airport.country} />
        <InfoRow label="Código IATA / ICAO" value={airport.icao} />
        <InfoRow label="Código ciudad" value={airport.cityCode.toUpperCase()} />
        <InfoRow label="Zona horaria" value={`${airport.gmt >= 0 ? "+" : ""}${airport.gmt}`} />
        <InfoRow
          label="Ocupación"
          value={ocupacion !== undefined ? `${Math.round(ocupacion)}%` : "No disponible"}
        />
        <InfoRow label="Capacidad" value={`${ocupadas} / ${capacity} maletas`} />
      </section>

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
            Envíos
          </button>
        </div>

        {activeView === "vuelos" ? (
          <>
            <h3 className="text-section-title mb-3">
              Vuelos del almacén{filteredFlights.length > 0 && ` (${filteredFlights.length})`}
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
                    placeholder="Inicio del ID, ej. SKBO>SPIM-23"
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
                  <option value="todos">{DIRECTION_LABEL.todos} ({currentFlights.length})</option>
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
                      ? currentFlights.length
                      : currentFlights.filter((flight) => flight.estado === estadoFiltro).length;

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
                No hay vuelos asociados a este almacén para la búsqueda o filtros seleccionados.
              </p>
            ) : (
              <div className="space-y-2">
                {filteredFlights.map((v) => {
                  const actionKey = getFlightActionKey(v);
                  const occupancyPct = getFlightOccupancyPct(v);
                  const progressPct = getFlightProgressPct(v);

                  return (
                    <FlightListCard
                      key={v.idOcurrencia}
                      code={formatFlightDisplayCode(v)}
                      statusLabel={VUELO_ESTADO_LABEL[v.estado] ?? v.estado}
                      statusVariant={VUELO_ESTADO_TAG_VARIANT[v.estado]}
                      departureText={formatFlightDateTime(v.fechaSalida)}
                      arrivalText={formatFlightDateTime(v.fechaLlegadaEstimada)}
                      progressPct={progressPct}
                      occupancyPct={occupancyPct}
                      rangosSemaforo={rangosSemaforo}
                      canCancel={
                        v.estado === "programado" || v.estado === "en_vuelo"
                      }
                      isCancelling={cancellingFlightKey === actionKey}
                      notice={
                        cancelNotice?.actionKey === actionKey
                          ? cancelNotice.message
                          : null
                      }
                      onOpen={() =>
                        openFlight(`occ-${v.idOcurrencia}`, {
                          idSimulacion,
                          focusOnMap: false,
                        })
                      }
                      onFocusOnMap={
                        v.estado === "en_vuelo"
                          ? () => focusFlightOnMap(String(v.idOcurrencia))
                          : undefined
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
              Envíos del almacén{filteredShipmentRelations.length > 0 && ` (${filteredShipmentRelations.length})`}
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
                No hay envíos asociados a este almacén para el filtro seleccionado.
              </p>
            ) : (
              <ul className="space-y-2">
                {filteredShipmentRelations.map(({ shipment, incoming, outgoing }) => {
                  const derivedShipmentStatus = resolveDerivedShipmentStatus(
                    shipment,
                    referenceMinute,
                    simulationStart
                  );

                  return (
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
                      <button
                        type="button"
                        onClick={() => handleFocusShipmentRoute(shipment)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-primary bg-card text-primary transition-colors hover:bg-primary/10"
                        aria-label={`Enfocar ruta de ${getShipmentCodeLabel(shipment)} en el mapa`}
                        title="Ver ruta en el mapa"
                      >
                        <Eye size={16} strokeWidth={2.2} aria-hidden />
                      </button>
                      {outgoing && <Tag variant="primary">Saliente</Tag>}
                      {incoming && <Tag variant="neutral">Entrante</Tag>}
                      <Tag
                        variant={derivedShipmentStatus === "entregados" ? "normal" : "primary"}
                      >
                        {getDerivedShipmentStatusLabel(shipment, derivedShipmentStatus)}
                      </Tag>
                      <span className="text-secondary text-text-primary">
                        {shipment.contarBolsas} maletas
                      </span>
                    </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </section>
    </DrawerBase>
  );
};

export default AirportDrawer;
