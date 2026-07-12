import { useEffect } from "react";
import { API_BASE_URL } from "@/utils/constants";

export interface SimulationRealtimeEvent<TPayload = unknown> {
  type: string;
  idSimulacion: number;
  payload: TPayload;
  timestamp: string;
}

interface UseSimulationEventsOptions {
  enabled?: boolean;
  onConnectedChange?: (connected: boolean) => void;
  onEvent?: (event: SimulationRealtimeEvent) => void;
  onError?: () => void;
}

const EVENT_TYPES = [
  "connected",
  "heartbeat",
  "simulation.state",
  "simulation.finished",
  "map.snapshot",
  "map.updated",
  "flight.updated",
  "flight.arrived",
  "flight.cancelled",
  "warehouse.occupancy.updated",
  "shipment.updated",
  "shipment.replanned",
  "error",
];

const buildSimulationStreamUrl = (idSimulacion: number): string => {
  const baseUrl = API_BASE_URL.replace(/\/$/, "");
  return `${baseUrl}/simulacion/${idSimulacion}/stream`;
};

const parseSseEvent = (event: MessageEvent): SimulationRealtimeEvent | null => {
  try {
    const parsed = JSON.parse(event.data) as SimulationRealtimeEvent;
    return parsed && typeof parsed.type === "string" ? parsed : null;
  } catch {
    return null;
  }
};

export const useSimulationEvents = (
  idSimulacion: number | null,
  {
    enabled = true,
    onConnectedChange,
    onEvent,
    onError,
  }: UseSimulationEventsOptions = {}
) => {
  useEffect(() => {
    if (!enabled || idSimulacion === null) {
      onConnectedChange?.(false);
      return;
    }

    const eventSource = new EventSource(buildSimulationStreamUrl(idSimulacion));

    const handleOpen = () => {
      onConnectedChange?.(true);
    };

    const handleError = () => {
      onConnectedChange?.(false);
      onError?.();
    };

    const handleMessage = (message: MessageEvent) => {
      const parsed = parseSseEvent(message);
      if (parsed) {
        onEvent?.(parsed);
      }
    };

    eventSource.onopen = handleOpen;
    eventSource.onerror = handleError;
    eventSource.onmessage = handleMessage;

    for (const eventType of EVENT_TYPES) {
      eventSource.addEventListener(eventType, handleMessage);
    }

    return () => {
      onConnectedChange?.(false);
      for (const eventType of EVENT_TYPES) {
        eventSource.removeEventListener(eventType, handleMessage);
      }
      eventSource.close();
    };
  }, [enabled, idSimulacion, onConnectedChange, onError, onEvent]);
};
