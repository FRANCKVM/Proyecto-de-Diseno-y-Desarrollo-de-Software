import type { MapFlight } from "@/components/map/WorldMap";
import type { EstadoSemaforo, RangoSemaforo } from "@/types/common.types";
import { getEstadoSemaforo } from "@/utils/airportHelpers";

const formatPercent = (value: number): string =>
  `${Math.round(value).toLocaleString("es-PE")}%`;

const average = (values: number[]): number =>
  values.reduce((total, value) => total + value, 0) / values.length;

export interface OccupancyMetric {
  value: string;
  estado: EstadoSemaforo;
}

const buildOccupancyMetric = (
  occupancies: number[],
  rangosSemaforo?: RangoSemaforo
): OccupancyMetric => {
  const averageOccupancy = occupancies.length === 0 ? 0 : average(occupancies);

  return {
    value: formatPercent(averageOccupancy),
    estado: getEstadoSemaforo(averageOccupancy, rangosSemaforo),
  };
};

export const getFlightOccupancyMetric = (
  flights: MapFlight[],
  rangosSemaforo?: RangoSemaforo
): OccupancyMetric => {
  const occupancies = flights
    .map((flight) => flight.occupancyPct)
    .filter((value): value is number => value !== undefined);

  return buildOccupancyMetric(occupancies, rangosSemaforo);
};

export const getWarehouseOccupancyMetric = (
  occupancyByIcao: Record<string, number>,
  rangosSemaforo?: RangoSemaforo
): OccupancyMetric => {
  const occupancies = Object.values(occupancyByIcao).filter(
    (value) => Number.isFinite(value)
  );

  return buildOccupancyMetric(occupancies, rangosSemaforo);
};
