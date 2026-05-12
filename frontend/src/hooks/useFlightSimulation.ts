import { useEffect, useRef, useState } from "react";
import { useSimulationControlStore } from "@/store/simulationControlStore";
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

const buildFlightsFromShipments = (
  shipments: BackendSolicitudEnvio[],
  currentMinute: number
): AnimatedFlight[] => {
  const flights: AnimatedFlight[] = [];

  shipments.forEach((shipment, shipmentIndex) => {
    const routeFlights = shipment.ruta?.vuelos ?? [];

    routeFlights.forEach((flight, segmentIndex) => {
      const durationMinutes = Math.max(
        1,
        (flight.llegadaUtcMin ?? 0) - (flight.salidaUtcMin ?? 0)
      );

      const progress =
        currentMinute <= flight.salidaUtcMin
          ? 0
          : currentMinute >= flight.llegadaUtcMin
          ? 1
          : clampProgress(
              (currentMinute - flight.salidaUtcMin) / durationMinutes
            );

      flights.push({
        id: `shipment-${shipment.idEnvio ?? shipmentIndex}-flight-${
          flight.idVuelo
        }-${segmentIndex}`,
        code: String(flight.idVuelo),
        fromIcao: flight.desde.codigo,
        toIcao: flight.hasta.codigo,
        progress,
        durationSeconds: durationMinutes * 60,
      });
    });
  });

  return flights;
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
          currentMinute
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
        initialMinute
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
    backendSimMinutesPerSecond,
  ]);

  return flights;
};
