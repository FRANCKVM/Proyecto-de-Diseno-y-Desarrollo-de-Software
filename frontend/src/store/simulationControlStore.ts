import { create } from "zustand";
import type { SimulationSpeed } from "@/types/simulation.types";

/**
 * Estado global de los controles de simulacion.
 *
 * El TopBar y el SimulationControlPanel leen y escriben este store.
 * El hook `useFlightSimulation` solo lo lee (velocidad y demanda) para
 * ajustar su comportamiento sin acoplarse a UI.
 *
 * Diseno: la cantidad de vuelos animados = baseCount + (demanda - 1) * 5,
 * donde baseCount lo define cada pantalla. Esto da un escalado lineal
 * que el usuario percibe como "mas demanda = mas operacion en pantalla".
 */
interface SimulationControlState {
  /** Multiplicador de velocidad del reloj de simulacion. */
  speed: SimulationSpeed;
  /** Dia simulado actual (1-indexed). */
  simulatedDay: number;
  /**
   * Factor de demanda del escenario de colapso. En operacion normal
   * vale 1.0; valores mayores implican mas vuelos simultaneos.
   */
  demandFactor: number;

  // Setters granulares
  setSpeed: (speed: SimulationSpeed) => void;
  setSimulatedDay: (day: number) => void;
  setDemandFactor: (factor: number) => void;

  // Helpers de UI
  incrementDay: () => void;
  decrementDay: () => void;
  resetDay: () => void;
  jumpToLastDay: (totalDays: number) => void;
  incrementDemand: () => void;
  decrementDemand: () => void;

  /** Reinicia todos los valores al estado por defecto. */
  reset: () => void;
}

/** Limites del factor de demanda. */
const MIN_DEMAND = 1;
const MAX_DEMAND = 5;
/** Paso de incremento/decremento del factor de demanda. */
const DEMAND_STEP = 0.2;

const INITIAL_STATE = {
  speed: 1 as SimulationSpeed,
  simulatedDay: 1,
  demandFactor: 1,
};

/**
 * Redondea a 1 decimal para evitar floats sucios al sumar steps de 0.2.
 */
const roundDemand = (n: number): number => Math.round(n * 10) / 10;

export const useSimulationControlStore = create<SimulationControlState>(
  (set) => ({
    ...INITIAL_STATE,

    setSpeed: (speed) => set({ speed }),
    setSimulatedDay: (simulatedDay) =>
      set({ simulatedDay: Math.max(1, simulatedDay) }),
    setDemandFactor: (factor) =>
      set({
        demandFactor: roundDemand(
          Math.max(MIN_DEMAND, Math.min(MAX_DEMAND, factor))
        ),
      }),

    incrementDay: () =>
      set((s) => ({ simulatedDay: s.simulatedDay + 1 })),
    decrementDay: () =>
      set((s) => ({ simulatedDay: Math.max(1, s.simulatedDay - 1) })),
    resetDay: () => set({ simulatedDay: 1 }),
    jumpToLastDay: (totalDays) =>
      set({ simulatedDay: Math.max(1, totalDays) }),

    incrementDemand: () =>
      set((s) => ({
        demandFactor: roundDemand(
          Math.min(MAX_DEMAND, s.demandFactor + DEMAND_STEP)
        ),
      })),
    decrementDemand: () =>
      set((s) => ({
        demandFactor: roundDemand(
          Math.max(MIN_DEMAND, s.demandFactor - DEMAND_STEP)
        ),
      })),

    reset: () => set(INITIAL_STATE),
  })
);
