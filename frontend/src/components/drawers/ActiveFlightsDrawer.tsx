import { useMemo } from "react";
import { Plane } from "lucide-react";
import Tag from "@/components/atoms/Tag";
import DrawerBase from "@/components/drawers/DrawerBase";
import type { MapFlight } from "@/components/map/WorldMap";
import {
  useDrawerStore,
  type ActiveFlightSemaphoreFilter,
} from "@/store/drawerStore";
import { getEstadoSemaforo } from "@/utils/airportHelpers";
import type { AirportWithCoords } from "@/types/airport.types";
import type { EstadoSemaforo, RangoSemaforo } from "@/types/common.types";

interface ActiveFlightsDrawerProps {
  flights: MapFlight[];
  airports?: AirportWithCoords[];
  rangosSemaforo?: RangoSemaforo;
  idSimulacion?: number | null;
}

const TAG_VARIANT_BY_ESTADO: Record<EstadoSemaforo, "normal" | "elevado" | "critico"> = {
  normal: "normal",
  elevado: "elevado",
  critico: "critico",
};

const ESTADO_LABEL: Record<EstadoSemaforo, string> = {
  normal: "Verde",
  elevado: "Amarillo",
  critico: "Rojo",
};

const formatPercent = (value?: number) =>
  value === undefined
    ? "Sin dato"
    : `${value.toLocaleString("es-PE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}%`;

const ActiveFlightsDrawer = ({
  flights,
  airports = [],
  rangosSemaforo,
  idSimulacion,
}: ActiveFlightsDrawerProps) => {
  const close = useDrawerStore((s) => s.close);
  const openFlight = useDrawerStore((s) => s.openFlight);
  const selectedRegion = useDrawerStore((s) => s.activeFlightRegionFilter);
  const setSelectedRegion = useDrawerStore((s) => s.setActiveFlightRegionFilter);
  const semaphoreFilter = useDrawerStore((s) => s.activeFlightSemaphoreFilter);
  const setSemaphoreFilter = useDrawerStore(
    (s) => s.setActiveFlightSemaphoreFilter
  );

  const airportsByIcao = useMemo(
    () => new Map(airports.map((airport) => [airport.icao, airport])),
    [airports]
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
    () =>
      flights.filter((flight) => {
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

        return matchesRegion && matchesSemaphore;
      }),
    [airportsByIcao, flights, rangosSemaforo, selectedRegion, semaphoreFilter]
  );

  return (
    <DrawerBase
      eyebrow="Operacion"
      title={`Vuelos en vuelo (${filteredFlights.length}/${flights.length})`}
      onClose={close}
      footer={
        <div className="flex items-center justify-between text-secondary text-text-secondary">
          <span>Vuelos filtrados</span>
          <span className="text-button text-text-primary">
            {filteredFlights.length}/{flights.length}
          </span>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-card border border-primary/20 bg-primary-soft/50 px-4 py-3">
          <div className="flex items-center gap-2 text-primary">
            <Plane size={16} aria-hidden />
            <span className="text-button">Vuelos activos ahora</span>
          </div>
          <p className="mt-1 text-secondary text-text-secondary">
            Lista sincronizada con los aviones visibles actualmente en el mapa.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <div>
            <label
              htmlFor="active-flight-region-filter"
              className="block text-label-sm text-text-tertiary mb-1"
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
            <label
              htmlFor="active-flight-semaphore-filter"
              className="block text-label-sm text-text-tertiary mb-1"
            >
              Filtrar por semaforo
            </label>
            <select
              id="active-flight-semaphore-filter"
              value={semaphoreFilter}
              onChange={(event) =>
                setSemaphoreFilter(
                  event.target.value as ActiveFlightSemaphoreFilter
                )
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
        </div>

        {flights.length === 0 ? (
          <div className="rounded-card border border-border bg-field px-4 py-6 text-center">
            <p className="text-button text-text-primary">
              No hay vuelos en vuelo en este momento.
            </p>
            <p className="mt-1 text-secondary text-text-secondary">
              Cuando aparezcan aviones activos, se listaran aqui.
            </p>
          </div>
        ) : filteredFlights.length === 0 ? (
          <div className="rounded-card border border-border bg-field px-4 py-6 text-center">
            <p className="text-button text-text-primary">
              No hay vuelos que coincidan con los filtros.
            </p>
            <p className="mt-1 text-secondary text-text-secondary">
              Prueba con otro continente o estado de semaforo.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredFlights.map((flight) => {
              const displayCode = flight.code ?? flight.id;
              const from = airportsByIcao.get(flight.fromIcao);
              const to = airportsByIcao.get(flight.toIcao);
              const occupancy = flight.occupancyPct;
              const estado =
                occupancy !== undefined
                  ? getEstadoSemaforo(occupancy, rangosSemaforo)
                  : null;

              return (
                <button
                  key={flight.id}
                  type="button"
                  onClick={() =>
                    openFlight(flight.id, {
                      idSimulacion,
                      showOnlyOnMap: true,
                    })
                  }
                  className="w-full rounded-card border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-field hover:border-primary/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-button text-text-primary truncate">
                        {displayCode}
                      </p>
                      <p className="mt-1 text-secondary text-text-secondary">
                        {flight.fromIcao} &gt; {flight.toIcao}
                      </p>
                      <p className="mt-1 text-secondary text-text-tertiary">
                        {[from?.region, to?.region]
                          .filter(Boolean)
                          .join(" / ") || "Continente sin dato"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Tag variant="primary">En vuelo</Tag>
                      {occupancy === 0 ? (
                        <Tag variant="neutral">Vacio</Tag>
                      ) : estado ? (
                        <Tag variant={TAG_VARIANT_BY_ESTADO[estado]}>
                          {ESTADO_LABEL[estado]}
                        </Tag>
                      ) : (
                        <Tag variant="neutral">Sin dato</Tag>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-secondary">
                    <span className="text-text-tertiary">Progreso</span>
                    <span className="text-text-primary">
                      {Math.round(flight.progress * 100)}%
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-secondary">
                    <span className="text-text-tertiary">Ocupacion</span>
                    <span className="text-text-primary">
                      {formatPercent(flight.occupancyPct)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </DrawerBase>
  );
};

export default ActiveFlightsDrawer;
