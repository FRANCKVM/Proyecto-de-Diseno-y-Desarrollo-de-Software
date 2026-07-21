import { useEffect } from "react";
import { API_BASE_URL } from "@/utils/constants";

export interface OperationRealtimeEvent<TPayload = unknown> {
  type: string;
  idSimulacion: number | null;
  payload: TPayload;
  timestamp: string;
}

interface UseOperationEventsOptions {
  enabled?: boolean;
  onConnectedChange?: (connected: boolean) => void;
  onEvent?: (event: OperationRealtimeEvent) => void;
  onError?: () => void;
}

const EVENT_TYPES = [
  "connected",
  "heartbeat",
  "operation.updated",
  "operation.map.snapshot",
  "error",
];

const buildOperationStreamUrl = (): string => {
  const baseUrl = API_BASE_URL.replace(/\/$/, "");
  return `${baseUrl}/operacion/stream`;
};

const parseSseEvent = (event: MessageEvent): OperationRealtimeEvent | null => {
  try {
    const parsed = JSON.parse(event.data) as OperationRealtimeEvent;
    return parsed && typeof parsed.type === "string" ? parsed : null;
  } catch {
    return null;
  }
};

export const useOperationEvents = ({
  enabled = true,
  onConnectedChange,
  onEvent,
  onError,
}: UseOperationEventsOptions = {}) => {
  useEffect(() => {
    if (!enabled) {
      onConnectedChange?.(false);
      return;
    }

    const eventSource = new EventSource(buildOperationStreamUrl());

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
  }, [enabled, onConnectedChange, onError, onEvent]);
};
