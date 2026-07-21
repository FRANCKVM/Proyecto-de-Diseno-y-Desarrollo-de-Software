import { useCallback, useEffect, useRef, useState } from "react";
import {
  getOperationMap,
  getOperationState,
} from "@/services/operationService";
import {
  useOperationEvents,
  type OperationRealtimeEvent,
} from "@/hooks/useOperationEvents";
import type {
  BackendEstadoOperacion,
  BackendMapaSimulacionEstado,
} from "@/types/backendSimulation.types";
import { USE_MOCK_DATA } from "@/utils/constants";

const STATE_POLL_INTERVAL_MS = 5000;
const MAP_POLL_INTERVAL_MS = 10000;
const SSE_FALLBACK_DELAY_MS = 10000;
const SSE_REFRESH_DEBOUNCE_MS = 500;

const isMapSnapshotPayload = (
  payload: unknown
): payload is BackendMapaSimulacionEstado => {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Partial<BackendMapaSimulacionEstado>;
  return (
    typeof candidate.idSimulacion === "number" &&
    typeof candidate.ocupacionPorAeropuerto === "object" &&
    Array.isArray(candidate.vuelos)
  );
};

export const useOperationData = () => {
  const [estado, setEstado] = useState<BackendEstadoOperacion | null>(null);
  const [mapa, setMapa] = useState<BackendMapaSimulacionEstado | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const isFetchingStateRef = useRef(false);
  const isFetchingMapRef = useRef(false);
  const refreshTimerRef = useRef<number | null>(null);
  const [isSseConnected, setIsSseConnected] = useState(false);
  const [sseFallbackActive, setSseFallbackActive] = useState(false);

  const fetchState = useCallback(async () => {
    if (isFetchingStateRef.current) {
      return;
    }
    isFetchingStateRef.current = true;

    try {
      const estadoActual = await getOperationState();
      if (estadoActual) {
        setEstado(estadoActual);
      }
    } finally {
      isFetchingStateRef.current = false;
    }
  }, []);

  const fetchMap = useCallback(async () => {
    if (isFetchingMapRef.current) {
      return;
    }
    isFetchingMapRef.current = true;

    try {
      const mapaActual = await getOperationMap();
      if (mapaActual) {
        setMapa(mapaActual);
      }
    } finally {
      isFetchingMapRef.current = false;
    }
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([fetchState(), fetchMap()]);
    setRefreshVersion((current) => current + 1);
  }, [fetchMap, fetchState]);

  const scheduleLightRefresh = useCallback(() => {
    if (refreshTimerRef.current !== null) {
      window.clearTimeout(refreshTimerRef.current);
    }

    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      void fetchState();
      void fetchMap();
    }, SSE_REFRESH_DEBOUNCE_MS);
  }, [fetchMap, fetchState]);

  useEffect(() => {
    if (USE_MOCK_DATA) {
      return;
    }

    void refresh();
  }, [refresh]);

  const handleOperationEvent = useCallback(
    (event: OperationRealtimeEvent) => {
      switch (event.type) {
        case "connected":
        case "heartbeat":
          return;
        case "operation.map.snapshot":
          if (isMapSnapshotPayload(event.payload)) {
            setMapa(event.payload);
          }
          return;
        case "operation.updated":
          scheduleLightRefresh();
          setRefreshVersion((current) => current + 1);
          return;
        case "error":
          scheduleLightRefresh();
          return;
      }
    },
    [scheduleLightRefresh]
  );

  const handleSseConnectedChange = useCallback((connected: boolean) => {
    setIsSseConnected(connected);
    if (connected) {
      setSseFallbackActive(false);
    }
  }, []);

  const handleSseError = useCallback(() => {
    setIsSseConnected(false);
  }, []);

  useOperationEvents({
    enabled: !USE_MOCK_DATA,
    onConnectedChange: handleSseConnectedChange,
    onEvent: handleOperationEvent,
    onError: handleSseError,
  });

  useEffect(() => {
    if (USE_MOCK_DATA || isSseConnected) {
      setSseFallbackActive(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSseFallbackActive(true);
    }, SSE_FALLBACK_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isSseConnected]);

  useEffect(() => {
    if (USE_MOCK_DATA || !sseFallbackActive) {
      return;
    }

    const canPoll = () =>
      typeof document === "undefined" || document.visibilityState === "visible";

    const refreshVisibleData = () => {
      if (!canPoll()) {
        return;
      }

      void fetchState();
      void fetchMap();
      setRefreshVersion((current) => current + 1);
    };

    refreshVisibleData();

    const stateIntervalId = window.setInterval(() => {
      if (canPoll()) {
        void fetchState();
      }
    }, STATE_POLL_INTERVAL_MS);
    const mapIntervalId = window.setInterval(() => {
      if (canPoll()) {
        void fetchMap();
      }
    }, MAP_POLL_INTERVAL_MS);
    const handleVisibilityChange = () => {
      refreshVisibleData();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(stateIntervalId);
      window.clearInterval(mapIntervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchMap, fetchState, sseFallbackActive]);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  return {
    estado,
    mapa,
    envios: [],
    refreshVersion,
    refresh,
  };
};
