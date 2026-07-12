import { useState } from "react";
import { Eye, Search, X } from "lucide-react";
import DrawerBase from "@/components/drawers/DrawerBase";
import {
  useDrawerStore,
  type WarehouseSemaphoreFilter,
} from "@/store/drawerStore";
import { getEstadoSemaforo } from "@/utils/airportHelpers";
import { getShipmentRouteGroups } from "@/utils/shipmentAssignments";
import { cn } from "@/utils/cn";
import type { AirportWithCoords } from "@/types/airport.types";
import type { BackendSolicitudEnvio } from "@/types/backendSimulation.types";
import type { EstadoSemaforo, RangoSemaforo } from "@/types/common.types";

interface WarehouseListDrawerProps {
  airports: AirportWithCoords[];
  occupancyByIcao?: Record<string, number>;
  rangosSemaforo?: RangoSemaforo;
  shipments?: BackendSolicitudEnvio[];
  referenceMinute?: number | null;
}

type WarehouseSortMode =
  | "ocupacion-desc"
  | "ocupacion-asc"
  | "llegada-proxima"
  | "salida-proxima";

const SEMAPHORE_TEXT_CLASS: Record<EstadoSemaforo, string> = {
  normal: "text-success",
  elevado: "text-warning",
  critico: "text-danger",
};

const SEMAPHORE_FILTER_OPTIONS: Array<{
  value: Exclude<WarehouseSemaphoreFilter, "todos">;
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

const DAY_MINUTES = 24 * 60;

const getCurrentUtcMinute = (): number => {
  const now = new Date();
  return now.getUTCHours() * 60 + now.getUTCMinutes();
};

const normalizeMinute = (minute: number): number =>
  ((Math.floor(minute) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;

const getMinutesUntil = (
  targetMinute: number | null | undefined,
  referenceMinute: number
): number | null => {
  if (targetMinute === null || targetMinute === undefined) {
    return null;
  }

  const normalizedTarget = normalizeMinute(targetMinute);
  const normalizedReference = normalizeMinute(referenceMinute);
  return (normalizedTarget - normalizedReference + DAY_MINUTES) % DAY_MINUTES;
};

const formatUtcMinute = (minute: number | null): string => {
  if (minute === null) {
    return "Sin vuelos";
  }

  const normalized = normalizeMinute(minute);
  const hour = String(Math.floor(normalized / 60)).padStart(2, "0");
  const minutes = String(normalized % 60).padStart(2, "0");
  return `${hour}:${minutes}`;
};

const getNearestFlightMinute = (
  shipments: BackendSolicitudEnvio[],
  airportIcao: string,
  referenceMinute: number,
  kind: "arrival" | "departure"
): { minute: number | null; distance: number | null } => {
  let nearestMinute: number | null = null;
  let nearestDistance: number | null = null;

  for (const shipment of shipments) {
    for (const group of getShipmentRouteGroups(shipment)) {
      for (const occurrence of group.ruta?.ocurrencias ?? []) {
        const flight = occurrence.vuelo;
        const airportMatches =
          kind === "arrival"
            ? flight.hasta.codigo === airportIcao
            : flight.desde.codigo === airportIcao;
        const eventDate = new Date(
          kind === "arrival" ? occurrence.fechaHoraLlegada : occurrence.fechaHoraSalida
        );
        const flightMinute = eventDate.getUTCHours() * 60 + eventDate.getUTCMinutes();
        const distance = getMinutesUntil(flightMinute, referenceMinute);

        if (!airportMatches || distance === null) {
          continue;
        }

        if (nearestDistance === null || distance < nearestDistance) {
          nearestDistance = distance;
          nearestMinute = normalizeMinute(flightMinute);
        }
      }
    }
  }

  return { minute: nearestMinute, distance: nearestDistance };
};

const WarehouseListDrawer = ({
  airports,
  occupancyByIcao,
  rangosSemaforo,
  shipments = [],
  referenceMinute,
}: WarehouseListDrawerProps) => {
  const close = useDrawerStore((s) => s.close);
  const openWarehouseAirport = useDrawerStore((s) => s.openWarehouseAirport);
  const focusWarehouseOnMap = useDrawerStore((s) => s.focusWarehouseOnMap);
  const selectedRegion = useDrawerStore((s) => s.warehouseRegionFilter);
  const setSelectedRegion = useDrawerStore((s) => s.setWarehouseRegionFilter);
  const occupancyFilter = useDrawerStore((s) => s.warehouseSemaphoreFilter);
  const setOccupancyFilter = useDrawerStore(
    (s) => s.setWarehouseSemaphoreFilter
  );
  const [searchCode, setSearchCode] = useState("");
  const [sortMode, setSortMode] = useState<WarehouseSortMode>("ocupacion-desc");
  const currentReferenceMinute = referenceMinute ?? getCurrentUtcMinute();

  const regionOptions = Array.from(
    new Set(
      airports
        .map((airport) => airport.region?.trim())
        .filter((region): region is string => Boolean(region))
    )
  ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));

  const normalizedSearch = searchCode.trim().toUpperCase();
  const filteredAirports = airports.filter((airport) => {
    const ocupacion = occupancyByIcao?.[airport.icao] ?? 0;
    const estado = getEstadoSemaforo(ocupacion, rangosSemaforo);
    const matchesCode =
      normalizedSearch.length === 0 ||
      airport.icao.toUpperCase().includes(normalizedSearch);
    const matchesRegion =
      selectedRegion === "todos" ||
      airport.region?.trim() === selectedRegion;
    const matchesOccupancy =
      occupancyFilter === "todos" ||
      (occupancyFilter === "vacios"
        ? ocupacion === 0
        : ocupacion > 0 && estado === occupancyFilter);

    return matchesCode && matchesRegion && matchesOccupancy;
  });

  const flightScheduleByIcao = new Map(
    filteredAirports.map((airport) => [
      airport.icao,
      {
        nextArrival: getNearestFlightMinute(
          shipments,
          airport.icao,
          currentReferenceMinute,
          "arrival"
        ),
        nextDeparture: getNearestFlightMinute(
          shipments,
          airport.icao,
          currentReferenceMinute,
          "departure"
        ),
      },
    ])
  );

  const sortedAirports = [...filteredAirports].sort((a, b) => {
    if (sortMode === "ocupacion-desc" || sortMode === "ocupacion-asc") {
      const occupancyA = occupancyByIcao?.[a.icao] ?? -1;
      const occupancyB = occupancyByIcao?.[b.icao] ?? -1;
      if (occupancyA !== occupancyB) {
        return sortMode === "ocupacion-desc"
          ? occupancyB - occupancyA
          : occupancyA - occupancyB;
      }
    }

    if (sortMode === "llegada-proxima") {
      const arrivalA = flightScheduleByIcao.get(a.icao)?.nextArrival.distance;
      const arrivalB = flightScheduleByIcao.get(b.icao)?.nextArrival.distance;
      if (arrivalA !== arrivalB) {
        return (arrivalA ?? Number.POSITIVE_INFINITY) - (arrivalB ?? Number.POSITIVE_INFINITY);
      }
    }

    if (sortMode === "salida-proxima") {
      const departureA = flightScheduleByIcao.get(a.icao)?.nextDeparture.distance;
      const departureB = flightScheduleByIcao.get(b.icao)?.nextDeparture.distance;
      if (departureA !== departureB) {
        return (departureA ?? Number.POSITIVE_INFINITY) - (departureB ?? Number.POSITIVE_INFINITY);
      }
    }

    const country = a.country.localeCompare(b.country, "es", { sensitivity: "base" });
    return country !== 0
      ? country
      : a.name.localeCompare(b.name, "es", { sensitivity: "base" });
  });

  return (
    <DrawerBase
      title="Panel de almacenes"
      onClose={close}
    >
      <p className="text-body text-text-primary mb-5">
        Selecciona un almacén para revisar sus envíos entrantes o salientes.
      </p>

      <div className="space-y-3 mb-5">
        <div>
          <label
            htmlFor="warehouse-code-search"
            className="block text-label-sm text-text-primary mb-1"
          >
            Buscar por código
          </label>
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
              aria-hidden
            />
            <input
              id="warehouse-code-search"
              type="search"
              value={searchCode}
              onChange={(event) => setSearchCode(event.target.value)}
              placeholder="Ej. SPIM"
              className="w-full bg-field border border-border rounded-input pl-9 pr-3 py-2 text-button text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="warehouse-region-filter"
            className="block text-label-sm text-text-primary mb-1"
          >
            Filtrar por continente
          </label>
          <select
            id="warehouse-region-filter"
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
              aria-pressed={occupancyFilter === "todos"}
              title="Mostrar todos"
              onClick={() => setOccupancyFilter("todos")}
              className={cn(
                "h-9 w-9 rounded-full border-2 p-0 transition-all duration-150 focus-visible:outline-primary inline-flex items-center justify-center",
                occupancyFilter === "todos"
                  ? "border-[#111827] bg-white text-[#111827] shadow-card ring-2 ring-[#111827]/15"
                  : "border-[#9ca3af] bg-white text-[#4b5563] hover:bg-[#f3f4f6]"
              )}
            >
              <X size={16} aria-hidden />
            </button>
            {SEMAPHORE_FILTER_OPTIONS.map((option) => {
              const isSelected = occupancyFilter === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  aria-label={option.label}
                  aria-pressed={isSelected}
                  title={option.label}
                  onClick={() =>
                    setOccupancyFilter(isSelected ? "todos" : option.value)
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
            htmlFor="warehouse-sort"
            className="block text-label-sm text-text-primary mb-1"
          >
            Ordenar por
          </label>
          <select
            id="warehouse-sort"
            value={sortMode}
            onChange={(event) =>
              setSortMode(event.target.value as WarehouseSortMode)
            }
            className="w-full bg-field border border-border rounded-input px-3 py-2 text-button text-text-primary focus:outline-none focus:border-primary"
          >
            <option value="ocupacion-desc">Ocupación: mayor a menor</option>
            <option value="ocupacion-asc">Ocupación: menor a mayor</option>
            <option value="llegada-proxima">Llegada de vuelo más próxima</option>
            <option value="salida-proxima">Salida de vuelo más próxima</option>
          </select>
        </div>
      </div>

      {sortedAirports.length === 0 ? (
        <p className="text-body text-text-primary">
          No hay almacenes que coincidan con los filtros.
        </p>
      ) : (
        <ul className="space-y-2">
          {sortedAirports.map((airport) => {
            const ocupacion = occupancyByIcao?.[airport.icao];
            const estado = ocupacion !== undefined
              ? getEstadoSemaforo(ocupacion, rangosSemaforo)
              : null;
            const schedule = flightScheduleByIcao.get(airport.icao);

            return (
              <li
                key={airport.icao}
                className="bg-field rounded-input px-3 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <button
                      type="button"
                      className="block max-w-full text-left"
                      onClick={() =>
                        openWarehouseAirport(airport.icao, {
                          focusOnMap: false,
                        })
                      }
                    >
                      <span className="block truncate text-button text-primary hover:underline">
                        {airport.icao} - {airport.name}
                      </span>
                    </button>
                    <p className="text-secondary text-text-primary">
                      {airport.country}
                    </p>
                    <p className="text-secondary text-text-primary">
                      Capacidad: {airport.capacity} maletas
                    </p>
                    <p className="text-secondary text-text-primary">
                      Próx. llegada: {formatUtcMinute(schedule?.nextArrival.minute ?? null)}
                    </p>
                    <p className="text-secondary text-text-primary">
                      Próx. salida: {formatUtcMinute(schedule?.nextDeparture.minute ?? null)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {estado ? (
                      <div className="flex min-w-[3.5rem] justify-end">
                        <span
                          className={cn(
                            "text-button font-semibold",
                            SEMAPHORE_TEXT_CLASS[estado]
                          )}
                        >
                          {Math.round(ocupacion ?? 0)}%
                        </span>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => focusWarehouseOnMap(airport.icao)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-primary bg-card text-primary transition-colors hover:bg-primary/10"
                      aria-label="Enfocar almacén en el mapa"
                      title="Ver almacén en el mapa"
                    >
                      <Eye size={16} strokeWidth={2.2} aria-hidden />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </DrawerBase>
  );
};

export default WarehouseListDrawer;
