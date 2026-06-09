import { useState } from "react";
import { Search } from "lucide-react";
import DrawerBase from "@/components/drawers/DrawerBase";
import Tag from "@/components/atoms/Tag";
import { useDrawerStore } from "@/store/drawerStore";
import { getEstadoSemaforo } from "@/utils/airportHelpers";
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
  | "ocupacion"
  | "llegada-proxima"
  | "salida-proxima";

type OccupancyFilter = "todos" | "vacios" | EstadoSemaforo;

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
  return `${hour}:${minutes} UTC`;
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
    for (const flight of shipment.ruta?.vuelos ?? []) {
      const airportMatches =
        kind === "arrival"
          ? flight.hasta.codigo === airportIcao
          : flight.desde.codigo === airportIcao;
      const flightMinute =
        kind === "arrival" ? flight.llegadaUtcMin : flight.salidaUtcMin;
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
  const selectedRegion = useDrawerStore((s) => s.warehouseRegionFilter);
  const setSelectedRegion = useDrawerStore((s) => s.setWarehouseRegionFilter);
  const [searchCode, setSearchCode] = useState("");
  const [sortMode, setSortMode] = useState<WarehouseSortMode>("ocupacion");
  const [occupancyFilter, setOccupancyFilter] = useState<OccupancyFilter>("todos");
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
    if (sortMode === "ocupacion") {
      const occupancyA = occupancyByIcao?.[a.icao] ?? -1;
      const occupancyB = occupancyByIcao?.[b.icao] ?? -1;
      if (occupancyA !== occupancyB) {
        return occupancyB - occupancyA;
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
      eyebrow="Almacenes"
      title={`Red global (${sortedAirports.length}/${airports.length})`}
      onClose={close}
    >
      <p className="text-body text-text-tertiary mb-5">
        Selecciona un almacen para revisar sus envios entrantes o salientes.
      </p>

      <div className="space-y-3 mb-5">
        <div>
          <label
            htmlFor="warehouse-code-search"
            className="block text-label-sm text-text-tertiary mb-1"
          >
            Buscar por codigo
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
            className="block text-label-sm text-text-tertiary mb-1"
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
          <label
            htmlFor="warehouse-occupancy-filter"
            className="block text-label-sm text-text-tertiary mb-1"
          >
            Filtrar por semaforo
          </label>
          <select
            id="warehouse-occupancy-filter"
            value={occupancyFilter}
            onChange={(event) =>
              setOccupancyFilter(event.target.value as OccupancyFilter)
            }
            className="w-full bg-field border border-border rounded-input px-3 py-2 text-button text-text-primary focus:outline-none focus:border-primary"
          >
            <option value="todos">Todos</option>
            <option value="vacios">Vacios</option>
            <option value="normal">Verde</option>
            <option value="elevado">Amarillo</option>
            <option value="critico">Rojo</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="warehouse-sort"
            className="block text-label-sm text-text-tertiary mb-1"
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
            <option value="ocupacion">Nivel de ocupacion</option>
            <option value="llegada-proxima">Llegada de vuelo mas proxima</option>
            <option value="salida-proxima">Salida de vuelo mas proxima</option>
          </select>
        </div>
      </div>

      {sortedAirports.length === 0 ? (
        <p className="text-body text-text-tertiary">
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
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => openWarehouseAirport(airport.icao)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-button text-primary hover:underline">
                        {airport.icao} - {airport.name}
                      </p>
                      <p className="text-secondary text-text-secondary">
                        {airport.country}
                      </p>
                      <p className="text-secondary text-text-tertiary">
                        Capacidad: {airport.capacity} maletas
                      </p>
                      <p className="text-secondary text-text-tertiary">
                        Prox. llegada: {formatUtcMinute(schedule?.nextArrival.minute ?? null)}
                      </p>
                      <p className="text-secondary text-text-tertiary">
                        Prox. salida: {formatUtcMinute(schedule?.nextDeparture.minute ?? null)}
                      </p>
                    </div>
                    {estado ? (
                      <div className="flex flex-col items-end gap-1">
                        <Tag variant={TAG_VARIANT_BY_ESTADO[estado]}>
                          {ESTADO_LABEL[estado]}
                        </Tag>
                        <span className="text-secondary text-text-tertiary">
                          {Math.round(ocupacion ?? 0)}%
                        </span>
                      </div>
                    ) : null}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </DrawerBase>
  );
};

export default WarehouseListDrawer;
