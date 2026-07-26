import type { AirportWithCoords } from "@/types/airport.types";

const DEFAULT_ORIGIN_ICAO = "SPIM";

const TIMEZONE_TO_AIRPORT_ICAO: Record<string, string> = {
  "America/Lima": "SPIM",
  "America/Argentina/Buenos_Aires": "SABE",
  "America/Buenos_Aires": "SABE",
  "Europe/Copenhagen": "EKCH",
  "Europe/Paris": "EKCH",
};

export interface BrowserOriginAirportResolution {
  airport: AirportWithCoords | null;
  timeZone: string | null;
  isExactMatch: boolean;
}

export const getBrowserTimeZone = (): string | null => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
};

export const resolveBrowserOriginAirport = (
  airports: AirportWithCoords[],
  timeZone = getBrowserTimeZone()
): BrowserOriginAirportResolution => {
  const airportByIcao = new Map(airports.map((airport) => [airport.icao, airport]));
  const mappedIcao = timeZone ? TIMEZONE_TO_AIRPORT_ICAO[timeZone] : undefined;
  const mappedAirport = mappedIcao ? airportByIcao.get(mappedIcao) : undefined;

  if (mappedAirport) {
    return {
      airport: mappedAirport,
      timeZone,
      isExactMatch: true,
    };
  }

  return {
    airport: airportByIcao.get(DEFAULT_ORIGIN_ICAO) ?? airports[0] ?? null,
    timeZone,
    isExactMatch: false,
  };
};
