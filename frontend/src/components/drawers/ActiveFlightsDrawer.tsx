import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import type { TagVariant } from "@/components/atoms/Tag";
import DrawerBase from "@/components/drawers/DrawerBase";
import FlightListCard from "@/components/molecules/FlightListCard";
import { useFlightCancellationAction } from "@/hooks/useFlightCancellationAction";
import {
  listFlightOccurrences,
  resolveFlightQueryDate,
} from "@/services/flightService";
import {
  useDrawerStore,
  type ActiveFlightSemaphoreFilter,
  type ActiveFlightStatusFilter,
} from "@/store/drawerStore";
import { getEstadoSemaforo } from "@/utils/airportHelpers";
import { cn } from "@/utils/cn";
import {
  addDaysToIsoDateUtc,
  formatUtcSimulationMinute,
  pad2,
  parseUtcDateTimeMs,
} from "@/utils/utcDateTime";
import type { AirportWithCoords } from "@/types/airport.types";
import type { RangoSemaforo } from "@/types/common.types";
import type { VueloDetalle } from "@/types/flight.types";

interface ActiveFlightsDrawerProps {
  airports?: AirportWithCoords[];
  rangosSemaforo?: RangoSemaforo;
  idSimulacion?: number | null;
  referenceMinute?: number | null;
  simulationStart?: string | null;
}

type FlightPanelStatus =
  | "programado"
  | "en_vuelo"
  | "completado"
  | "cancelado";

type FlightStatusFilter = ActiveFlightStatusFilter;

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
    label: "Vacíos",
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
    label: "Ámbar",
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
const FLIGHT_LIST_PAGE_SIZE = 80;

const normalizeMinute = (minute: number): number =>
  ((Math.floor(minute) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;

const resolveTemporalStatus = (
  status: FlightPanelStatus,
  departureMs: number,
  arrivalMs: number,
  referenceMs: number
): FlightPanelStatus => {
  if (status === "cancelado") {
    return "cancelado";
  }

  if (
    !Number.isFinite(departureMs) ||
    !Number.isFinite(arrivalMs) ||
    arrivalMs <= departureMs
  ) {
    return status;
  }

  if (referenceMs < departureMs) {
    return "programado";
  }

  if (referenceMs < arrivalMs) {
    return "en_vuelo";
  }

  return "completado";
};

const formatMinuteTime = (value: number): string => {
  const normalized = normalizeMinute(value);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;

  return `${pad2(hours)}:${pad2(minutes)}`;
};

const formatMinuteDateTime = (
  value: number | undefined,
  simulationStart: string | null | undefined
): string => {
  if (value === undefined) {
    return "Sin dato";
  }

  const simulationStartMs = parseUtcDateTimeMs(simulationStart);
  if (simulationStartMs !== null) {
    return formatUtcSimulationMinute(value, simulationStart);
  }

  const dayNumber = Math.floor(Math.max(0, value) / DAY_MINUTES) + 1;
  return `Día ${dayNumber} ${formatMinuteTime(value)}`;
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

const buildOccurrencePanelFlights = (
  occurrences: VueloDetalle[],
  simulationStart?: string | null,
  referenceMinute?: number | null,
  nowMs = Date.now()
): PanelFlight[] => {
  const simulationStartMs = parseUtcDateTimeMs(simulationStart);
  return occurrences.map((occurrence) => {
    const departureMs = parseUtcDateTimeMs(occurrence.fechaSalida) ?? NaN;
    const arrivalMs = parseUtcDateTimeMs(occurrence.fechaLlegadaEstimada) ?? NaN;
    const durationMs = Math.max(1, arrivalMs - departureMs);
    const referenceMs = simulationStartMs !== null && referenceMinute != null
      ? simulationStartMs + referenceMinute * 60_000
      : nowMs;
    const estado = resolveTemporalStatus(
      occurrence.estado,
      departureMs,
      arrivalMs,
      referenceMs
    );
    const progress = estado === "completado"
      ? 1
      : estado === "programado" || estado === "cancelado"
      ? 0
      : Math.min(0.999, Math.max(0.001, (referenceMs - departureMs) / durationMs));
    const departureMinute = simulationStartMs !== null
      ? Math.round((departureMs - simulationStartMs) / 60_000)
      : new Date(departureMs).getUTCHours() * 60 + new Date(departureMs).getUTCMinutes();
    const arrivalMinute = departureMinute + Math.max(1, Math.round(durationMs / 60_000));

    return {
      id: String(occurrence.idOcurrencia),
      detailCode: String(occurrence.idOcurrencia),
      code: occurrence.codigo,
      fromIcao: occurrence.origenIcao,
      toIcao: occurrence.destinoIcao,
      progress,
      estado,
      occupancyPct: occurrence.capacidad > 0
        ? (occurrence.ocupacion * 100) / occurrence.capacidad
        : 0,
      departureMinute,
      arrivalMinute,
      departureIso: occurrence.fechaSalida,
    };
  }).filter((flight) => {
    const departureMs = parseUtcDateTimeMs(flight.departureIso);

    if (
      simulationStartMs !== null &&
      departureMs !== null &&
      departureMs < simulationStartMs
    ) {
      return false;
    }

    return true;
  });
};

const formatFlightDisplayCode = (flight: PanelFlight): string =>
  `${flight.fromIcao}>${flight.toIcao}-${flight.code}`;

const ActiveFlightsDrawer = ({
  airports = [],
  rangosSemaforo,
  idSimulacion,
  referenceMinute,
  simulationStart,
}: ActiveFlightsDrawerProps) => {
  const close = useDrawerStore((s) => s.close);
  const openFlight = useDrawerStore((s) => s.openFlight);
  const focusFlightOnMap = useDrawerStore((s) => s.focusFlightOnMap);
  const selectedRegion = useDrawerStore((s) => s.activeFlightRegionFilter);
  const setSelectedRegion = useDrawerStore((s) => s.setActiveFlightRegionFilter);
  const semaphoreFilter = useDrawerStore((s) => s.activeFlightSemaphoreFilter);
  const setSemaphoreFilter = useDrawerStore(
    (s) => s.setActiveFlightSemaphoreFilter
  );
  const [sortMode, setSortMode] = useState<FlightSortMode>("ocupacion-desc");
  const selectedAirport = useDrawerStore((s) => s.activeFlightAirportFilter);
  const setSelectedAirport = useDrawerStore(
    (s) => s.setActiveFlightAirportFilter
  );
  const flightSearch = useDrawerStore((s) => s.activeFlightSearchFilter);
  const setFlightSearch = useDrawerStore((s) => s.setActiveFlightSearchFilter);
  const statusFilter = useDrawerStore((s) => s.activeFlightStatusFilter);
  const setStatusFilter = useDrawerStore((s) => s.setActiveFlightStatusFilter);
  const [visibleFlightLimit, setVisibleFlightLimit] = useState(
    FLIGHT_LIST_PAGE_SIZE
  );
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [cancelledFlightIds, setCancelledFlightIds] = useState<Set<string>>(
    () => new Set()
  );
  const [occurrences, setOccurrences] = useState<VueloDetalle[]>([]);
  const [occurrencesLoading, setOccurrencesLoading] = useState(true);
  const [occurrencesError, setOccurrencesError] = useState<string | null>(null);
  const queryDate = resolveFlightQueryDate(
    idSimulacion,
    simulationStart,
    referenceMinute
  );
  const occurrenceQueryDates = useMemo(() => {
    const previousDate = addDaysToIsoDateUtc(queryDate, -1);
    return previousDate ? [previousDate, queryDate] : [queryDate];
  }, [queryDate]);
  const {
    cancelFlight,
    cancellingFlightKey,
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

  useEffect(() => {
    let cancelled = false;
    let requestInFlight = false;
    const canPoll = () =>
      typeof document === "undefined" || document.visibilityState === "visible";

    const loadOccurrences = async (showLoading: boolean) => {
      if (!canPoll() || requestInFlight) return;
      requestInFlight = true;
      if (showLoading) {
        setOccurrencesLoading(true);
      }
      setOccurrencesError(null);

      try {
        const dataByDate = await Promise.all(
          occurrenceQueryDates.map((date) =>
            listFlightOccurrences(idSimulacion, date)
          )
        );
        const uniqueOccurrences = new Map<number, VueloDetalle>();
        dataByDate.flat().forEach((occurrence) => {
          uniqueOccurrences.set(occurrence.idOcurrencia, occurrence);
        });

        if (!cancelled) {
          setOccurrences(Array.from(uniqueOccurrences.values()));
        }
      } catch {
        if (!cancelled) {
          if (showLoading) {
            setOccurrences([]);
            setOccurrencesError("No se pudieron cargar las ocurrencias de vuelo.");
          }
        }
      } finally {
        requestInFlight = false;
        if (!cancelled && showLoading) {
          setOccurrencesLoading(false);
        }
      }
    };

    void loadOccurrences(true);
    const intervalId = window.setInterval(() => {
      void loadOccurrences(false);
    }, idSimulacion != null ? 5000 : 15000);
    const handleVisibilityChange = () => {
      if (canPoll()) {
        void loadOccurrences(false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [idSimulacion, occurrenceQueryDates]);

  useEffect(() => {
    setVisibleFlightLimit(FLIGHT_LIST_PAGE_SIZE);
  }, [
    flightSearch,
    selectedAirport,
    selectedRegion,
    semaphoreFilter,
    sortMode,
    statusFilter,
  ]);

  const panelFlights = useMemo(
    () => buildOccurrencePanelFlights(
      occurrences,
      simulationStart,
      referenceMinute,
      nowMs
    ),
    [nowMs, occurrences, referenceMinute, simulationStart]
  );
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
        const displayCode = formatFlightDisplayCode(flight).toLowerCase();
        const matchesSearch =
          normalizedSearch.length === 0 ||
          flight.code.toLowerCase().startsWith(normalizedSearch) ||
          displayCode.startsWith(normalizedSearch);

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
  const visibleSortedFlights = useMemo(
    () => sortedFlights.slice(0, visibleFlightLimit),
    [sortedFlights, visibleFlightLimit]
  );
  const hiddenFlightCount = sortedFlights.length - visibleSortedFlights.length;

  const handleCancelFlight = async (flight: PanelFlight) => {
    if (!flight.departureIso) {
      return;
    }

    await cancelFlight({
      actionKey: flight.detailCode,
      idOcurrencia: Number(flight.detailCode),
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
          <span>Vuelos mostrados</span>
          <span className="text-button text-text-primary">
            {visibleSortedFlights.length}/{filteredFlights.length}
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
              placeholder="Inicio del ID, ej. SKBO>SPIM-23"
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
              Filtrar por semáforo
            </span>
            <div className="flex items-center gap-3" role="group" aria-label="Filtrar por semáforo">
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
              <option value="ocupacion-desc">Ocupación: mayor a menor</option>
              <option value="ocupacion-asc">Ocupación: menor a mayor</option>
              <option value="salida">Hora de salida</option>
              <option value="llegada">Hora de llegada</option>
              <option value="origen">Origen</option>
              <option value="destino">Destino</option>
            </select>
          </div>
        </div>

        {occurrencesLoading ? (
          <div className="rounded-card border border-border bg-field px-4 py-6 text-center">
            <p className="text-button text-text-primary">Cargando vuelos...</p>
          </div>
        ) : occurrencesError ? (
          <div className="rounded-card border border-border bg-field px-4 py-6 text-center">
            <p className="text-button text-danger">{occurrencesError}</p>
          </div>
        ) : displayedPanelFlights.length === 0 ? (
          <div className="rounded-card border border-border bg-field px-4 py-6 text-center">
            <p className="text-button text-text-primary">
              No hay vuelos registrados en este momento.
            </p>
            <p className="mt-1 text-secondary text-text-primary">
              Cuando existan vuelos en rutas, se listarán aquí.
            </p>
          </div>
        ) : filteredFlights.length === 0 ? (
          <div className="rounded-card border border-border bg-field px-4 py-6 text-center">
            <p className="text-button text-text-primary">
              No hay vuelos que coincidan con los filtros.
            </p>
            <p className="mt-1 text-secondary text-text-primary">
              Prueba con otro estado, continente o semáforo.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleSortedFlights.map((flight) => {
              const progressPct = Math.round(flight.progress * 100);

              return (
                <FlightListCard
                  key={flight.id}
                  code={formatFlightDisplayCode(flight)}
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
                  canCancel={
                    (flight.estado === "programado" ||
                      flight.estado === "en_vuelo") &&
                    Boolean(flight.departureIso)
                  }
                  isCancelling={cancellingFlightKey === flight.detailCode}
                  notice={
                    cancelNotice?.actionKey === flight.detailCode
                      ? {
                          message: cancelNotice.message,
                          tone: cancelNotice.tone,
                        }
                      : null
                  }
                  onOpen={() =>
                    openFlight(`occ-${flight.detailCode}`, {
                      idSimulacion,
                      focusOnMap: false,
                    })
                  }
                  onFocusOnMap={
                    flight.estado === "en_vuelo"
                      ? () => focusFlightOnMap(flight.id)
                      : undefined
                  }
                  onCancel={() => {
                    void handleCancelFlight(flight);
                  }}
                />
              );
            })}
            {hiddenFlightCount > 0 && (
              <button
                type="button"
                onClick={() =>
                  setVisibleFlightLimit((currentLimit) =>
                    currentLimit + FLIGHT_LIST_PAGE_SIZE
                  )
                }
                className="w-full rounded-input border border-border bg-field px-3 py-2 text-button text-primary hover:border-primary hover:bg-primary-soft transition-colors"
              >
                Mostrar más ({hiddenFlightCount})
              </button>
            )}
          </div>
        )}
      </div>
    </DrawerBase>
  );
};

export default ActiveFlightsDrawer;
