import { create } from "zustand";

export interface FlightCancellationMapEvent {
  id: string;
  airportIcao: string;
  flightCode?: string | null;
  createdAtMs: number;
}

interface CancellationAnimationState {
  events: FlightCancellationMapEvent[];
  addFlightCancellationEvent: (event: {
    airportIcao: string;
    flightCode?: string | null;
  }) => void;
}

const EVENT_RETENTION_MS = 30_000;

export const useCancellationAnimationStore =
  create<CancellationAnimationState>((set) => ({
    events: [],
    addFlightCancellationEvent: ({ airportIcao, flightCode }) =>
      set((state) => {
        const now = Date.now();
        const nextEvent: FlightCancellationMapEvent = {
          id: `manual-cancel-${airportIcao}-${flightCode ?? "vuelo"}-${now}`,
          airportIcao,
          flightCode,
          createdAtMs: now,
        };

        return {
          events: [
            ...state.events.filter(
              (event) => now - event.createdAtMs <= EVENT_RETENTION_MS
            ),
            nextEvent,
          ],
        };
      }),
  }));
