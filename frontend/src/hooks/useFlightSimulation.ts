import { useEffect, useRef, useState } from "react";
import { useSimulationControlStore } from "@/store/simulationControlStore";
import { getShipmentRouteGroups } from "@/utils/shipmentAssignments";
import {
  generateFlight,
  generateFlightPool,
} from "@/services/sources2.0/flightGenerator.mock";
import type {
  AnimatedFlight,
  FlightSimulationConfig,
} from "@/types/simulation.types";
import type { BackendSolicitudEnvio } from "@/types/backendSimulation.types";

/**
 * Cuantos vuelos extra se anaden por cada +1.0 de factor de demanda.
 * Configurado en 5 segun la decision tomada en la conversacion de C1:
 * "cada +1.0 de demanda anade ~5 vuelos al pool activo".
 */
const FLIGHTS_PER_DEMAND_UNIT = 5;

const getCurrentUtcMinute = (): number => {
  const now = new Date();
  return now.getUTCHours() * 60 + now.getUTCMinutes();
};

const clampProgress = (value: number): number =>
  Math.max(0, Math.min(1, value));

const DAY_MINUTES = 24 * 60;

const normalizeDailyMinute = (minute: number): number =>
  ((minute % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;

const parseLocalDateTimeMs = (value: string | null | undefined): number | null => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
};

const getShipmentMinute = (
  shipment: BackendSolicitudEnvio,
  simulationStartMs: number | null
): number | null => {
  if (simulationStartMs === null) {
    return null;
  }

  const shipmentMs = parseLocalDateTimeMs(`${shipment.fecha}T${shipment.hora}`);
  if (shipmentMs === null) {
    return null;
  }

  return Math.max(0, Math.floor((shipmentMs - simulationStartMs) / 60_000));
};

const getNextFlightWindow = (
  earliestMinute: number,
  departureMinute: number | null | undefined,
  arrivalMinute: number | null | undefined
): { departure: number; arrival: number; durationMinutes: number } => {
  const departure = normalizeDailyMinute(departureMinute ?? 0);
  let arrival = arrivalMinute ?? departure;

  while (arrival <= departure) {
    arrival += DAY_MINUTES;
  }

  const durationMinutes = Math.max(1, arrival - departure);
  const occurrenceOffset = Math.max(
    0,
    Math.ceil((earliestMinute - departure) / DAY_MINUTES)
  );
  const occurrenceDeparture = departure + occurrenceOffset * DAY_MINUTES;

  return {
    departure: occurrenceDeparture,
    arrival: occurrenceDeparture + durationMinutes,
    durationMinutes,
  };
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

interface ActiveFlightAggregate {
  idVuelo: number;
  departure: number;
  segmentIndex: number;
  fromIcao: string;
  toIcao: string;
  progress: number;
  durationMinutes: number;
  capacity?: number | null;
  reportedUsedCapacity?: number | null;
  activeBags: number;
  firstShipmentId: number | null;
  firstShipmentIndex: number;
}

const buildFlightsFromShipments = (
  shipments: BackendSolicitudEnvio[],
  currentMinute: number,
  simulationStartMs: number | null
): AnimatedFlight[] => {
  const activeFlightsByOccurrence = new Map<string, ActiveFlightAggregate>();

  shipments.forEach((shipment, shipmentIndex) => {
    const shipmentMinute = getShipmentMinute(shipment, simulationStartMs);
    const routeGroups = getShipmentRouteGroups(shipment);

    routeGroups.forEach((group, groupIndex) => {
      const routeFlights = group.ruta?.vuelos ?? [];
      let earliestDeparture = shipmentMinute ?? 0;

      routeFlights.forEach((flight, segmentIndex) => {
        const { departure, arrival, durationMinutes } = getNextFlightWindow(
          earliestDeparture,
          flight.salidaUtcMin,
          flight.llegadaUtcMin
        );

        earliestDeparture = arrival;

        if (currentMinute < departure || currentMinute >= arrival) {
          return;
        }

        const progress = clampProgress(
          (currentMinute - departure) / durationMinutes
        );
        const occurrenceKey = `${flight.idVuelo}-${departure}`;
        const existing = activeFlightsByOccurrence.get(occurrenceKey);

        if (existing) {
          existing.activeBags += group.cantidadBolsas;
          existing.reportedUsedCapacity = Math.max(
            existing.reportedUsedCapacity ?? 0,
            flight.capacidadUsada ?? 0
          );
          return;
        }

        activeFlightsByOccurrence.set(occurrenceKey, {
          idVuelo: flight.idVuelo,
          departure,
          segmentIndex: groupIndex * 100 + segmentIndex,
          fromIcao: flight.desde.codigo,
          toIcao: flight.hasta.codigo,
          progress,
          durationMinutes,
          capacity: flight.capacidad,
          reportedUsedCapacity: flight.capacidadUsada,
          activeBags: group.cantidadBolsas,
          firstShipmentId: shipment.idEnvio,
          firstShipmentIndex: shipmentIndex,
        });
      });
    });
  });

  return Array.from(activeFlightsByOccurrence.values()).map((flight) => {
    const usedCapacity =
      flight.activeBags > 0
        ? flight.activeBags
        : (flight.reportedUsedCapacity ?? 0);

    return {
      id: `shipment-${flight.firstShipmentId ?? flight.firstShipmentIndex}-flight-${
        flight.idVuelo
      }-${flight.segmentIndex}-${flight.departure}`,
      code: String(flight.idVuelo),
      fromIcao: flight.fromIcao,
      toIcao: flight.toIcao,
      progress: flight.progress,
      occupancyPct: calculateOccupancyPct(usedCapacity, flight.capacity),
      durationSeconds: flight.durationMinutes * 60,
    };
  });
};

/**
 * Hook de simulacion visual de vuelos en tiempo real.
 *
 * Mantiene un pool de vuelos animados que avanzan en cada frame del
 * navegador (requestAnimationFrame). Cuando un vuelo llega a su destino
 * (progress >= 1), se respawnea con nuevo origen/destino aleatorio.
 *
 * Lee del simulationControlStore:
 *   - speed: multiplica la velocidad de avance del progress.
 *   - demandFactor: si scaleByDemand=true, escala el numero de vuelos.
 *
 * Retorna un array referencialmente nuevo cada frame para que React
 * Leaflet pinte la nueva posicion. Internamente se usa una ref para
 * mantener el state mutable y evitar reconciliaciones costosas.
 *
 * @param config Configuracion de la pantalla que invoca el hook.
 * @returns Array de vuelos animados, listo para pasar a WorldMap.
 */
export const useFlightSimulation = (
  config: FlightSimulationConfig
): AnimatedFlight[] => {
  const {
    baseFlightCount,
    scaleByDemand = false,
    backendShipments,
    backendClockMinutes,
    backendSimulationStart,
    backendSimMinutesPerSecond,
  } = config;

  // Pool mutable de vuelos. Se mantiene en una ref para que el rAF loop
  // no provoque renders en cada frame por si solo; los renders los
  // dispara el setState con el array clonado.
  const flightsRef = useRef<AnimatedFlight[]>(generateFlightPool(baseFlightCount));
  const [flights, setFlights] = useState<AnimatedFlight[]>(flightsRef.current);
  const backendMinuteRef = useRef<number>(backendClockMinutes ?? getCurrentUtcMinute());

  useEffect(() => {
    if (backendClockMinutes !== null && backendClockMinutes !== undefined) {
      backendMinuteRef.current = backendClockMinutes;
    }
  }, [backendClockMinutes]);

  // Lectura inicial del store. Las suscripciones se hacen via `subscribe`
  // para evitar re-renders del componente cuando cambia el store.
  // En el tick de animacion siempre leemos el ultimo valor.
  useEffect(() => {
    if (backendShipments) {
      let rafId = 0;
      let lastTimestamp = performance.now();

      const tick = (now: number) => {
        const dtMs = now - lastTimestamp;
        lastTimestamp = now;
        const dtSeconds = dtMs / 1000;
        const { speed } = useSimulationControlStore.getState();
        const simMinutesPerSecond = backendSimMinutesPerSecond ?? 0;

        const currentMinute =
          backendClockMinutes !== null && backendClockMinutes !== undefined
            ? backendMinuteRef.current +
              dtSeconds * speed * simMinutesPerSecond
            : getCurrentUtcMinute();

        if (backendClockMinutes !== null && backendClockMinutes !== undefined) {
          backendMinuteRef.current = currentMinute;
        }

        const nextFlights = buildFlightsFromShipments(
          backendShipments,
          currentMinute,
          parseLocalDateTimeMs(backendSimulationStart)
        );
        flightsRef.current = nextFlights;
        setFlights(nextFlights);

        rafId = requestAnimationFrame(tick);
      };

      const initialMinute =
        backendClockMinutes !== null && backendClockMinutes !== undefined
          ? backendClockMinutes
          : getCurrentUtcMinute();
      const initialFlights = buildFlightsFromShipments(
        backendShipments,
        initialMinute,
        parseLocalDateTimeMs(backendSimulationStart)
      );
      flightsRef.current = initialFlights;
      setFlights(initialFlights);

      rafId = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(rafId);
    }

    let rafId = 0;
    let lastTimestamp = performance.now();

    const tick = (now: number) => {
      const dtMs = now - lastTimestamp;
      lastTimestamp = now;
      const dtSeconds = dtMs / 1000;

      // Lectura no-reactiva del store: getState() siempre devuelve el
      // valor actual sin suscribir el componente a cambios.
      const { speed, demandFactor } = useSimulationControlStore.getState();

      // Calculo del tamano objetivo del pool segun demanda.
      const targetCount = scaleByDemand
        ? baseFlightCount +
          Math.round((demandFactor - 1) * FLIGHTS_PER_DEMAND_UNIT)
        : baseFlightCount;

      const pool = flightsRef.current;

      // Avance del progress y respawn de vuelos completados.
      for (let i = 0; i < pool.length; i++) {
        const f = pool[i];
        const advance = (dtSeconds * speed) / f.durationSeconds;
        const nextProgress = f.progress + advance;

        if (nextProgress >= 1) {
          // Respawn: mismo id, nuevo trayecto, progress 0.
          pool[i] = generateFlight(f.id, 0);
        } else {
          // Avanza in-place. Mutamos el objeto porque el array completo
          // se clona al hacer setState; los componentes hijos comparan
          // por shallow y reciben referencias nuevas.
          pool[i] = { ...f, progress: nextProgress };
        }
      }

      // Ajuste del tamano del pool por cambio en demandFactor.
      if (pool.length < targetCount) {
        // Anadimos vuelos nuevos hasta alcanzar el target.
        for (let i = pool.length; i < targetCount; i++) {
          pool.push(generateFlight(`SIM-${String(i).padStart(3, "0")}`, Math.random()));
        }
      } else if (pool.length > targetCount) {
        // Recortamos los excedentes desde el final.
        pool.length = targetCount;
      }

      // Push al state. Clonamos para forzar re-render.
      setFlights([...pool]);

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [
    baseFlightCount,
    scaleByDemand,
    backendShipments,
    backendClockMinutes,
    backendSimulationStart,
    backendSimMinutesPerSecond,
  ]);

  return flights;
};
