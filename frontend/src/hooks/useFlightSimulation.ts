import { useEffect, useRef, useState } from "react";
import { useSimulationControlStore } from "@/store/simulationControlStore";
import { generateFlight, generateFlightPool } from "@/services/sources2.0/flightGenerator.mock";
import type { AnimatedFlight, FlightSimulationConfig } from "@/types/simulation.types";

const FLIGHTS_PER_DEMAND_UNIT = 5;
const FLIGHT_SNAPSHOT_INTERVAL_MS = 250;

/** Animador exclusivo de datos mock; los vuelos reales ya llegan resueltos por ocurrencia. */
export const useFlightSimulation = ({ baseFlightCount, scaleByDemand = false }: FlightSimulationConfig): AnimatedFlight[] => {
  const flightsRef = useRef<AnimatedFlight[]>(generateFlightPool(baseFlightCount));
  const [flights, setFlights] = useState<AnimatedFlight[]>(flightsRef.current);

  useEffect(() => {
    flightsRef.current = generateFlightPool(baseFlightCount);
    setFlights(flightsRef.current);
    let rafId = 0;
    let lastTimestamp = performance.now();
    let lastSnapshotTimestamp = 0;
    const tick = (now: number) => {
      const dtSeconds = (now - lastTimestamp) / 1000;
      lastTimestamp = now;
      const { speed, demandFactor } = useSimulationControlStore.getState();
      const targetCount = scaleByDemand
        ? baseFlightCount + Math.round((demandFactor - 1) * FLIGHTS_PER_DEMAND_UNIT)
        : baseFlightCount;
      const pool = flightsRef.current;
      let publish = now - lastSnapshotTimestamp >= FLIGHT_SNAPSHOT_INTERVAL_MS;
      for (let i = 0; i < pool.length; i++) {
        const flight = pool[i];
        const progress = flight.progress + (dtSeconds * speed) / flight.durationSeconds;
        if (progress >= 1) {
          const next = generateFlight(flight.id, 0);
          pool[i] = { ...next, progressVelocityPerSecond: speed / next.durationSeconds, progressUpdatedAtMs: now };
          publish = true;
        } else {
          pool[i] = { ...flight, progress, progressVelocityPerSecond: speed / flight.durationSeconds, progressUpdatedAtMs: now };
        }
      }
      while (pool.length < targetCount) {
        const next = generateFlight(`SIM-${String(pool.length).padStart(3, "0")}`, Math.random());
        pool.push({ ...next, progressVelocityPerSecond: speed / next.durationSeconds, progressUpdatedAtMs: now });
        publish = true;
      }
      if (pool.length > targetCount) {
        pool.length = targetCount;
        publish = true;
      }
      if (publish) {
        lastSnapshotTimestamp = now;
        setFlights([...pool]);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [baseFlightCount, scaleByDemand]);
  return flights;
};
