import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import type { TagVariant } from "@/components/atoms/Tag";
import DrawerBase from "@/components/drawers/DrawerBase";
import FlightListCard from "@/components/molecules/FlightListCard";
import type { MapFlight } from "@/components/map/WorldMap";
import { useFlightCancellationAction } from "@/hooks/useFlightCancellationAction";
import {
  useDrawerStore,
  type ActiveFlightSemaphoreFilter,
} from "@/store/drawerStore";
import { getEstadoSemaforo } from "@/utils/airportHelpers";
import { cn } from "@/utils/cn";
import { getShipmentRouteGroups } from "@/utils/shipmentAssignments";
import type { AirportWithCoords } from "@/types/airport.types";
import type {
  BackendSolicitudEnvio,
  BackendVuelo,
} from "@/types/backendSimulation.types";
import type { RangoSemaforo } from "@/types/common.types";

interface ActiveFlightsDrawerProps {
  flights: MapFlight[];
  airports?: AirportWithCoords[];
  rangosSemaforo?: RangoSemaforo;
  idSimulacion?: number | null;
  shipments?: BackendSolicitudEnvio[];
  referenceMinute?: number | null;
  simulationStart?: string | null;
}

type FlightPanelStatus =
  | "programado"
  | "en_vuelo"
  | "completado"
  | "cancelado";

type FlightStatusFilter = "todos" | FlightPanelStatus;

interface PanelFlight {
  id: string;
  detailCode: string;
  code: string;
  fromIcao: string;
  toIcao: string;
  progress: number;
  estado: FlightPanelStatus;
  occupancyPct?: number;
  departureMinute?: number;
  arrivalMinute?: number;
  departureIso?: string;
}

interface PanelFlightAggregate extends PanelFlight {
  activeBags: number;
  reportedUsedCapacity?: number | null;
  capacity?: number | null;
}

const STATUS_LABEL: Record<FlightPanelStatus, string> = {
  programado: "Programado",
  en_vuelo: "En vuelo",
  completado: "Completado",
  cancelado: "Cancelado",
};

const STATUS_TAG_VARIANT: Record<FlightPanelStatus, TagVariant> = {
  programado: "neutral",
  en_vuelo: "primary",
  completado: "normal",
  cancelado: "critico",
};

const STATUS_PRIORITY: Record<FlightPanelStatus, number> = {
  completado: 0,
  programado: 1,
  en_vuelo: 2,
  cancelado: 3,
};

const STATUS_FILTER_OPTIONS: Array<{
  value: FlightStatusFilter;
  label: string;
}> = [
  { value: "todos", label: "Todos" },
  { value: "programado", label: "Programados" },
  { value: "en_vuelo", label: "En vuelo" },
  { value: "completado", label: "Completados" },
  { value: "cancelado", label: "Cancelados" },
];

const SEMAPHORE_FILTER_OPTIONS: Array<{
  value: Exclude<ActiveFlightSemaphoreFilter, "todos">;
  label: string;
  className: string;
  activeClassName: string;
}> = [
  {
    value: "vacios",
    label: "Vacios",
    className: "border-[#4b5563] bg-[#d1d5db] hover:bg-[#9ca3af]",
    activeClassName: "border-[#111827] bg-[#374151] shadow-card ring-2 ring-[#111827]/25",
  },
  {
    value: "normal",
    label: "Verde",
    className: "border-[#16a34a] bg-[#bbf7d0] hover:bg-[#86efac]",
    activeClassName: "border-[#15803d] bg-[#16a34a] shadow-card ring-2 ring-[#16a34a]/25",
  },
  {
    value: "elevado",
    label: "Ambar",
    className: "border-[#f59e0b] bg-[#fde68a] hover:bg-[#fcd34d]",
    activeClassName: "border-[#d97706] bg-[#f59e0b] shadow-card ring-2 ring-[#f59e0b]/25",
  },
  {
    value: "critico",
    label: "Rojo",
    className: "border-[#ef4444] bg-[#fecaca] hover:bg-[#fca5a5]",
    activeClassName: "border-[#dc2626] bg-[#ef4444] shadow-card ring-2 ring-[#ef4444]/25",
  },
];

type FlightSortMode =
  | "ocupacion-desc"
  | "ocupacion-asc"
  | "salida"
  | "llegada"
  | "origen"
  | "destino";

const DAY_MINUTES = 24 * 60;

const clampProgress = (value: number): number =>
  Math.max(0, Math.min(1, value));

const normalizeMinute = (minute: number): number =>
  ((Math.floor(minute) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;

const parseLocalDateTimeMs = (value: string | null | undefined): number | null => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
};

const parseShipmentUtcMinute = (shipment: BackendSolicitudEnvio): number => {
  const [hour = "0", minute = "0"] = (shipment.hora ?? "00:00").split(":");
  return Number(hour) * 60 + Number(minute);
};

const getUtcMinutesSinceShipmentDay = (
  shipment: BackendSolicitudEnvio,
  nowMs: number
): number | null => {
  const shipmentDayMs = Date.parse(`${shipment.fecha}T00:00:00Z`);

  if (Number.isNaN(shipmentDayMs)) {
    return null;
  }

  return Math.floor((nowMs - shipmentDayMs) / 60_000);
};

const getShipmentStartMinute = (
  shipment: BackendSolicitudEnvio,
  simulationStartMs: number | null
): number => {
  if (simulationStartMs === null) {
    return parseShipmentUtcMinute(shipment);
  }

  const shipmentMs = parseLocalDateTimeMs(`${shipment.fecha}T${shipment.hora}`);
  if (shipmentMs === null) {
    return parseShipmentUtcMinute(shipment);
  }

  return Math.max(0, Math.floor((shipmentMs - simulationStartMs) / 60_000));
};

const getReferenceMinute = (
  shipment: BackendSolicitudEnvio,
  referenceMinute: number | null | undefined,
  simulationStartMs: number | null,
  nowMs: number
): number | null => {
  if (referenceMinute !== null && referenceMinute !== undefined) {
    return referenceMinute;
  }

  if (simulationStartMs !== null) {
    return 0;
  }

  return getUtcMinutesSinceShipmentDay(shipment, nowMs);
};

const getNextFlightWindow = (
  earliestMinute: number,
  flight: BackendVuelo
): { departure: number; arrival: number; durationMinutes: number } => {
  const departureBase = normalizeMinute(flight.salidaUtcMin ?? 0);
  let arrivalBase = flight.llegadaUtcMin ?? departureBase;

  while (arrivalBase <= departureBase) {
    arrivalBase += DAY_MINUTES;
  }

  const durationMinutes = Math.max(1, arrivalBase - departureBase);
  const occurrenceOffset = Math.max(
    0,
    Math.ceil((earliestMinute - departureBase) / DAY_MINUTES)
  );
  const departure = departureBase + occurrenceOffset * DAY_MINUTES;

  return {
    departure,
    arrival: departure + durationMinutes,
    durationMinutes,
  };
};

const getFlightStatus = (
  flight: BackendVuelo,
  referenceMinute: number,
  departure: number,
  arrival: number
): FlightPanelStatus => {
  if (flight.cancelado) {
    return "cancelado";
  }

  if (referenceMinute < departure) {
    return "programado";
  }

  if (referenceMinute >= arrival) {
    return "completado";
  }

  return "en_vuelo";
};

const getProgressByStatus = (
  status: FlightPanelStatus,
  referenceMinute: number,
  departure: number,
  durationMinutes: number
): number => {
  if (status === "completado") {
    return 1;
  }

  if (status !== "en_vuelo") {
    return 0;
  }

  return clampProgress((referenceMinute - departure) / durationMinutes);
};

const calculateOccupancyPct = (
  usedCapacity: number | null | undefined,
  totalCapacity: number | null | undefined
): number | undefined => {
  if (!totalCapacity || totalCapacity <= 0) {
    return undefined;
  }

  const used = Math.max(0, usedCapacity ?? 0);
  return Math.min(100, (used * 100) / totalCapacity);
};

const formatMinuteTime = (value: number): string => {
  const normalized = normalizeMinute(value);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

const formatMinuteDateTime = (
  value: number | undefined,
  simulationStart: string | null | undefined
): string => {
  if (value === undefined) {
    return "Sin dato";
  }

  const simulationStartMs = parseLocalDateTimeMs(simulationStart);
  if (simulationStartMs !== null) {
    const date = new Date(simulationStartMs + value * 60_000);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");

    return `${day}/${month} ${formatMinuteTime(value)}`;
  }

  const dayNumber = Math.floor(Math.max(0, value) / DAY_MINUTES) + 1;
  return `Dia ${dayNumber} ${formatMinuteTime(value)}`;
};

const getDepartureIso = (
  shipment: BackendSolicitudEnvio,
  simulationStartMs: number | null,
  departureMinute: number
): string | undefined => {
  const baseMs =
    simulationStartMs ??
    Date.parse(`${shipment.fecha}T00:00:00Z`);

  if (Number.isNaN(baseMs)) {
    return undefined;
  }

  return new Date(baseMs + departureMinute * 60_000).toISOString();
};

const compareNullableNumber = (
  a?: number,
  b?: number,
  direction: "asc" | "desc" = "asc"
): number => {
  const missingA = a === undefined || !Number.isFinite(a);
  const missingB = b === undefined || !Number.isFinite(b);

  if (missingA && missingB) {
    return 0;
  }

  if (missingA) {
    return 1;
  }

  if (missingB) {
    return -1;
  }

  return direction === "asc" ? a - b : b - a;
};

const buildFallbackPanelFlights = (flights: MapFlight[]): PanelFlight[] =>
  flights.map((flight) => ({
    id: flight.id,
    detailCode: flight.code ?? flight.id,
    code: flight.code ?? flight.id,
    fromIcao: flight.fromIcao,
    toIcao: flight.toIcao,
    progress: flight.progress,
    estado: "en_vuelo",
    occupancyPct: flight.occupancyPct,
    departureMinute: flight.departureMinute,
    arrivalMinute: flight.arrivalMinute,
  }));

const buildPanelFlightsFromShipments = (
  shipments: BackendSolicitudEnvio[],
  referenceMinute: number | null | undefined,
  simulationStart: string | null | undefined,
  nowMs: number
): PanelFlight[] => {
  if (shipments.length === 0) {
    return [];
  }

  const simulationStartMs = parseLocalDateTimeMs(simulationStart);
  const flightsByOccurrence = new Map<string, PanelFlightAggregate>();

  shipments.forEach((shipment, shipmentIndex) => {
    const shipmentReference = getReferenceMinute(
      shipment,
      referenceMinute,
      simulationStartMs,
      nowMs
    );

    if (shipmentReference === null) {
      return;
    }

    getShipmentRouteGroups(shipment).forEach((group, groupIndex) => {
      let earliestDeparture = getShipmentStartMinute(shipment, simulationStartMs);

      (group.ruta?.vuelos ?? []).forEach((flight, segmentIndex) => {
        const { departure, arrival, durationMinutes } = getNextFlightWindow(
          earliestDeparture,
          flight
        );
        earliestDeparture = arrival;

        const status = getFlightStatus(
          flight,
          shipmentReference,
          departure,
          arrival
        );
        const progress = getProgressByStatus(
          status,
          shipmentReference,
          departure,
          durationMinutes
        );
        const detailCode = `shipment-${shipment.idEnvio ?? shipmentIndex}-flight-${
          flight.idVuelo
        }-${groupIndex * 100 + segmentIndex}-${departure}`;
        const departureIso = getDepartureIso(
          shipment,
          simulationStartMs,
          departure
        );
        const occurrenceKey =
          simulationStartMs === null
            ? `${shipment.fecha}-${flight.idVuelo}-${departure}`
            : `${flight.idVuelo}-${departure}`;
        const existing = flightsByOccurrence.get(occurrenceKey);

        if (existing) {
          existing.activeBags += group.cantidadBolsas;
          existing.reportedUsedCapacity = Math.max(
            existing.reportedUsedCapacity ?? 0,
            flight.capacidadUsada ?? 0
          );

          if (STATUS_PRIORITY[status] > STATUS_PRIORITY[existing.estado]) {
            existing.estado = status;
            existing.progress = progress;
            existing.detailCode = detailCode;
            existing.id = detailCode;
            existing.departureIso = departureIso;
          }

          return;
        }

        flightsByOccurrence.set(occurrenceKey, {
          id: detailCode,
          detailCode,
          code: String(flight.idVuelo),
          fromIcao: flight.desde.codigo,
          toIcao: flight.hasta.codigo,
          progress,
          estado: status,
          departureMinute: departure,
          arrivalMinute: arrival,
          departureIso,
          activeBags: group.cantidadBolsas,
          reportedUsedCapacity: flight.capacidadUsada,
          capacity: flight.capacidad,
        });
      });
    });
  });

  const panelFlights = Array.from(flightsByOccurrence.values()).map((flight) => {
    const usedCapacity =
      flight.activeBags > 0
        ? flight.activeBags
        : (flight.reportedUsedCapacity ?? 0);

    return {
      ...flight,
      occupancyPct:
        flight.occupancyPct ?? calculateOccupancyPct(usedCapacity, flight.capacity),
    };
  });

  return panelFlights;
};

const ActiveFlightsDrawer = ({
  flights,
  airports = [],
  rangosSemaforo,
  idSimulacion,
  shipments = [],
  referenceMinute,
  simulationStart,
}: ActiveFlightsDrawerProps) => {
  const close = useDrawerStore((s) => s.close);
  const openFlight = useDrawerStore((s) => s.openFlight);
  const selectedRegion = useDrawerStore((s) => s.activeFlightRegionFilter);
  const setSelectedRegion = useDrawerStore((s) => s.setActiveFlightRegionFilter);
  const semaphoreFilter = useDrawerStore((s) => s.activeFlightSemaphoreFilter);
  const setSemaphoreFilter = useDrawerStore(
    (s) => s.setActiveFlightSemaphoreFilter
  );
  const [sortMode, setSortMode] = useState<FlightSortMode>("ocupacion-desc");
  const [selectedAirport, setSelectedAirport] = useState("todos");
  const [flightSearch, setFlightSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FlightStatusFilter>("todos");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [cancelledFlightIds, setCancelledFlightIds] = useState<Set<string>>(
    () => new Set()
  );
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
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const shipmentPanelFlights = useMemo(
    () =>
      buildPanelFlightsFromShipments(
        shipments,
        referenceMinute,
        simulationStart,
        nowMs
      ),
    [nowMs, referenceMinute, shipments, simulationStart]
  );
  const fallbackPanelFlights = useMemo(
    () => buildFallbackPanelFlights(flights),
    [flights]
  );
  const panelFlights =
    shipmentPanelFlights.length > 0
      ? shipmentPanelFlights
      : fallbackPanelFlights;
  const displayedPanelFlights = useMemo(
    () =>
      panelFlights.map((flight) =>
        cancelledFlightIds.has(flight.detailCode)
          ? { ...flight, estado: "cancelado" as FlightPanelStatus, progress: 0 }
          : flight
      ),
    [cancelledFlightIds, panelFlights]
  );

  const airportsByIcao = useMemo(
    () => new Map(airports.map((airport) => [airport.icao, airport])),
    [airports]
  );
  const airportOptions = useMemo(
    () =>
      Array.from(
        new Set(
          panelFlights.flatMap((flight) => [flight.fromIcao, flight.toIcao])
        )
      ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" })),
    [panelFlights]
  );
  const regionOptions = useMemo(
    () =>
      Array.from(
        new Set(
          airports
            .map((airport) => airport.region?.trim())
            .filter((region): region is string => Boolean(region))
        )
      ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" })),
    [airports]
  );
  const filteredFlights = useMemo(
    () => {
      const normalizedSearch = flightSearch.trim().toLowerCase();

      return displayedPanelFlights.filter((flight) => {
        const from = airportsByIcao.get(flight.fromIcao);
        const to = airportsByIcao.get(flight.toIcao);
        const occupancy = flight.occupancyPct;
        const estado =
          occupancy !== undefined
            ? getEstadoSemaforo(occupancy, rangosSemaforo)
            : null;
        const matchesRegion =
          selectedRegion === "todos" ||
          from?.region?.trim() === selectedRegion ||
          to?.region?.trim() === selectedRegion;
        const matchesSemaphore =
          semaphoreFilter === "todos" ||
          (semaphoreFilter === "vacios"
            ? occupancy === 0
            : occupancy !== undefined &&
              occupancy > 0 &&
              estado === semaphoreFilter);
        const matchesAirport =
          selectedAirport === "todos" ||
          flight.fromIcao === selectedAirport ||
          flight.toIcao === selectedAirport;
        const matchesStatus =
          statusFilter === "todos" || flight.estado === statusFilter;
        const matchesSearch =
          normalizedSearch.length === 0 ||
          flight.id.toLowerCase().includes(normalizedSearch) ||
          flight.code.toLowerCase().includes(normalizedSearch) ||
          flight.detailCode.toLowerCase().includes(normalizedSearch);

        return (
          matchesRegion &&
          matchesSemaphore &&
          matchesAirport &&
          matchesStatus &&
          matchesSearch
        );
      });
    },
    [
      airportsByIcao,
      flightSearch,
      displayedPanelFlights,
      rangosSemaforo,
      selectedAirport,
      selectedRegion,
      semaphoreFilter,
      statusFilter,
    ]
  );
  const sortedFlights = useMemo(
    () =>
      [...filteredFlights].sort((a, b) => {
        const codeCompare = a.code.localeCompare(b.code, "es", {
          sensitivity: "base",
          numeric: true,
        });

        switch (sortMode) {
          case "ocupacion-desc": {
            const result = compareNullableNumber(
              a.occupancyPct,
              b.occupancyPct,
              "desc"
            );
            return result || codeCompare;
          }
          case "ocupacion-asc": {
            const result = compareNullableNumber(
              a.occupancyPct,
              b.occupancyPct,
              "asc"
            );
            return result || codeCompare;
          }
          case "salida": {
            const result = compareNullableNumber(
              a.departureMinute,
              b.departureMinute
            );
            return result || codeCompare;
          }
          case "llegada": {
            const result = compareNullableNumber(
              a.arrivalMinute,
              b.arrivalMinute
            );
            return result || codeCompare;
          }
          case "origen": {
            const result = a.fromIcao.localeCompare(b.fromIcao, "es", {
              sensitivity: "base",
            });
            return result || codeCompare;
          }
          case "destino": {
            const result = a.toIcao.localeCompare(b.toIcao, "es", {
              sensitivity: "base",
            });
            return result || codeCompare;
          }
        }
      }),
    [filteredFlights, sortMode]
  );

  const handleCancelFlight = async (flight: PanelFlight) => {
    if (!flight.departureIso) {
      return;
    }

    await cancelFlight({
      actionKey: flight.detailCode,
      codigo: flight.detailCode,
      fechaSalida: flight.departureIso,
      departureMinute: flight.departureMinute,
      fallbackAirportIcao: flight.fromIcao,
      fallbackFlightCode: flight.code,
      onCancelled: ({ shiftedToNextDay }) => {
        if (!shiftedToNextDay) {
        setCancelledFlightIds((currentIds) => {
          const nextIds = new Set(currentIds);
          nextIds.add(flight.detailCode);
          return nextIds;
        });
        }
      },
    });
  };

  return (
    <DrawerBase
      title="Panel de vuelos"
      onClose={close}
      footer={
        <div className="flex items-center justify-between text-secondary text-text-primary">
          <span>Vuelos filtrados</span>
          <span className="text-button text-text-primary">
            {filteredFlights.length}/{displayedPanelFlights.length}
          </span>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label
              htmlFor="active-flight-search"
              className="block text-label-sm text-text-primary mb-1"
            >
              Buscar por ID de vuelo
            </label>
            <input
              id="active-flight-search"
              type="search"
              value={flightSearch}
              onChange={(event) => setFlightSearch(event.target.value)}
              placeholder="Ej. 1024 o VUE-1024"
              className="w-full bg-field border border-border rounded-input px-3 py-2 text-button text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label
              htmlFor="active-flight-status-filter"
              className="block text-label-sm text-text-primary mb-1"
            >
              Filtrar por estado
            </label>
            <select
              id="active-flight-status-filter"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as FlightStatusFilter)
              }
              className="w-full bg-field border border-border rounded-input px-3 py-2 text-button text-text-primary focus:outline-none focus:border-primary"
            >
              {STATUS_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="active-flight-region-filter"
              className="block text-label-sm text-text-primary mb-1"
            >
              Filtrar por continente
            </label>
            <select
              id="active-flight-region-filter"
              value={selectedRegion}
              onChange={(event) => setSelectedRegion(event.target.value)}
              className="w-full bg-field border border-border rounded-input px-3 py-2 text-button text-text-primary focus:outline-none focus:border-primary"
            >
              <option value="todos">Todos</option>
              {regionOptions.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="block text-label-sm text-text-primary mb-1">
              Filtrar por semaforo
            </span>
            <div className="flex items-center gap-3" role="group" aria-label="Filtrar por semaforo">
              <button
                type="button"
                aria-label="Mostrar todos"
                aria-pressed={semaphoreFilter === "todos"}
                title="Mostrar todos"
                onClick={() => setSemaphoreFilter("todos")}
                className={cn(
                  "h-9 w-9 rounded-full border-2 p-0 transition-all duration-150 focus-visible:outline-primary inline-flex items-center justify-center",
                  semaphoreFilter === "todos"
                    ? "border-[#111827] bg-white text-[#111827] shadow-card ring-2 ring-[#111827]/15"
                    : "border-[#9ca3af] bg-white text-[#4b5563] hover:bg-[#f3f4f6]"
                )}
              >
                <X size={16} aria-hidden />
              </button>
              {SEMAPHORE_FILTER_OPTIONS.map((option) => {
                const isSelected = semaphoreFilter === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-label={option.label}
                    aria-pressed={isSelected}
                    title={option.label}
                    onClick={() =>
                      setSemaphoreFilter(isSelected ? "todos" : option.value)
                    }
                    className={cn(
                      "h-9 w-9 rounded-full border-2 p-0 transition-all duration-150 focus-visible:outline-primary",
                      isSelected ? option.activeClassName : option.className
                    )}
                  />
                );
              })}
            </div>
          </div>

          <div>
            <label
              htmlFor="active-flight-airport-filter"
              className="block text-label-sm text-text-primary mb-1"
            >
              Filtrar por aeropuerto
            </label>
            <select
              id="active-flight-airport-filter"
              value={selectedAirport}
              onChange={(event) => setSelectedAirport(event.target.value)}
              className="w-full bg-field border border-border rounded-input px-3 py-2 text-button text-text-primary focus:outline-none focus:border-primary"
            >
              <option value="todos">Todos</option>
              {airportOptions.map((icao) => {
                const airport = airportsByIcao.get(icao);
                return (
                  <option key={icao} value={icao}>
                    {airport ? `${icao} - ${airport.name}` : icao}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label
              htmlFor="active-flight-sort"
              className="block text-label-sm text-text-primary mb-1"
            >
              Ordenar por
            </label>
            <select
              id="active-flight-sort"
              value={sortMode}
              onChange={(event) =>
                setSortMode(event.target.value as FlightSortMode)
              }
              className="w-full bg-field border border-border rounded-input px-3 py-2 text-button text-text-primary focus:outline-none focus:border-primary"
            >
              <option value="ocupacion-desc">Ocupacion: mayor a menor</option>
              <option value="ocupacion-asc">Ocupacion: menor a mayor</option>
              <option value="salida">Hora de salida</option>
              <option value="llegada">Hora de llegada</option>
              <option value="origen">Origen</option>
              <option value="destino">Destino</option>
            </select>
          </div>
        </div>

        {displayedPanelFlights.length === 0 ? (
          <div className="rounded-card border border-border bg-field px-4 py-6 text-center">
            <p className="text-button text-text-primary">
              No hay vuelos registrados en este momento.
            </p>
            <p className="mt-1 text-secondary text-text-primary">
              Cuando existan vuelos en rutas, se listaran aqui.
            </p>
          </div>
        ) : filteredFlights.length === 0 ? (
          <div className="rounded-card border border-border bg-field px-4 py-6 text-center">
            <p className="text-button text-text-primary">
              No hay vuelos que coincidan con los filtros.
            </p>
            <p className="mt-1 text-secondary text-text-primary">
              Prueba con otro estado, continente o semaforo.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {cancelError && (
              <p className="text-secondary text-danger">{cancelError}</p>
            )}
            {sortedFlights.map((flight) => {
              const from = airportsByIcao.get(flight.fromIcao);
              const to = airportsByIcao.get(flight.toIcao);
              const progressPct = Math.round(flight.progress * 100);

              return (
                <FlightListCard
                  key={flight.id}
                  code={flight.code}
                  routeText={`${flight.fromIcao} > ${flight.toIcao}`}
                  metaText={
                    [from?.region, to?.region].filter(Boolean).join(" / ") ||
                    "Continente sin dato"
                  }
                  statusLabel={STATUS_LABEL[flight.estado]}
                  statusVariant={STATUS_TAG_VARIANT[flight.estado]}
                  departureText={formatMinuteDateTime(
                    flight.departureMinute,
                    simulationStart
                  )}
                  arrivalText={formatMinuteDateTime(
                    flight.arrivalMinute,
                    simulationStart
                  )}
                  progressPct={progressPct}
                  occupancyPct={flight.occupancyPct}
                  rangosSemaforo={rangosSemaforo}
                  canCancel={flight.estado === "programado" && Boolean(flight.departureIso)}
                  isCancelling={cancellingFlightKey === flight.detailCode}
                  notice={
                    cancelNotice?.actionKey === flight.detailCode
                      ? cancelNotice.message
                      : null
                  }
                  onOpen={() =>
                    openFlight(flight.detailCode, {
                      idSimulacion,
                      showOnlyOnMap: flight.estado === "en_vuelo",
                    })
                  }
                  onCancel={() => {
                    void handleCancelFlight(flight);
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    </DrawerBase>
  );
};

export default ActiveFlightsDrawer;
