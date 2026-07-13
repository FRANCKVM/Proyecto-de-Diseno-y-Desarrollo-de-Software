import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getCurrentLiveSimulationState,
  getLiveSimulationMap,
  getLiveSimulationState,
  listLiveSimulationShipments,
  startLiveSimulation,
  stopLiveSimulation,
} from "@/services/simulationService";
import { useSimulationConfigStore } from "@/store/simulationConfigStore";
import { useSimulationControlStore } from "@/store/simulationControlStore";
import { useLiveSimulationStore } from "@/store/liveSimulationStore";
import {
  useSimulationEvents,
  type SimulationRealtimeEvent,
} from "@/hooks/useSimulationEvents";
import { USE_MOCK_DATA } from "@/utils/constants";
import { buildEmptyMapFlights } from "@/utils/mapFlightHelpers";
import { parseBackendRealDateTime } from "@/utils/simulationClock";
import type { MapFlight } from "@/components/map/WorldMap";
import type {
  BackendEstadoSimulacion,
  BackendMapaSimulacionEstado,
} from "@/types/backendSimulation.types";
import type { TipoSimulacion } from "@/types/common.types";

const STATE_POLL_INTERVAL_MS = 3000;
const MAP_POLL_INTERVAL_MS = 6000;
const SHIPMENTS_POLL_INTERVAL_MS = 12000;
const FALLBACK_STATE_POLL_INTERVAL_MS = 5000;
const FALLBACK_MAP_POLL_INTERVAL_MS = 10000;
const FALLBACK_SHIPMENTS_POLL_INTERVAL_MS = 20000;
const SSE_FALLBACK_DELAY_MS = 10000;
const SSE_REFRESH_DEBOUNCE_MS = 700;
const SSE_SHIPMENTS_REFRESH_THROTTLE_MS = 15000;
const DEFAULT_SIMULATION_K = 1;

const K_BY_TIPO = {
  semanal: 15,
  colapso: 200,
} as const;

const DURACION_DIAS_BY_TIPO = {
  semanal: 5,
  colapso: 30,
} as const;

const inferSimulationType = (
  k: number | null,
  fallback: TipoSimulacion
): TipoSimulacion => {
  if (k === K_BY_TIPO.colapso) {
    return "colapso";
  }

  if (k === K_BY_TIPO.semanal) {
    return "semanal";
  }

  if (k !== null && k > 0) {
    return "colapso";
  }

  return fallback;
};

const resolveLiveReferenceMinute = (
  estado: BackendEstadoSimulacion | null
): number | null => {
  if (
    !estado ||
    !estado.fechaHoraInicioReal ||
    !estado.scMinutos ||
    !estado.intervaloRealMs ||
    estado.intervaloRealMs <= 0
  ) {
    return estado?.punteroConsumoMinutos ?? null;
  }

  const nowMs = Date.now();
  const realStart = parseBackendRealDateTime(estado.fechaHoraInicioReal, nowMs);
  const fallback = Math.max(0, estado.punteroConsumoMinutos ?? 0);

  if (!realStart) {
    return fallback;
  }

  const elapsedRealMs = Math.max(0, nowMs - realStart.getTime());
  let referenceMinute =
    (elapsedRealMs * estado.scMinutos) / estado.intervaloRealMs;

  if (estado.ultimoMinutoSimulacion !== null) {
    referenceMinute = Math.min(
      referenceMinute,
      Math.max(fallback, estado.ultimoMinutoSimulacion)
    );
  }

  return Math.max(fallback, referenceMinute);
};

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

interface UseLiveSimulationOptions {
  autoStart?: boolean;
  enablePolling?: boolean;
  pollingMode?: "none" | "state-only" | "full" | "sse";
}

export const useLiveSimulation = (
  options: UseLiveSimulationOptions = {}
) => {
  const {
    autoStart = true,
    enablePolling = true,
    pollingMode,
  } = options;
  const effectivePollingMode = pollingMode ?? (enablePolling ? "full" : "none");
  const tipoPeriodo = useSimulationConfigStore((s) => s.tipoPeriodo);
  const fechaInicio = useSimulationConfigStore((s) => s.fechaInicio);
  const horaInicio = useSimulationConfigStore((s) => s.horaInicio);
  const kColapso = useSimulationConfigStore((s) => s.kColapso);
  const speed = useSimulationControlStore((s) => s.speed);

  const {
    idSimulacion,
    tipoSimulacion,
    estado,
    mapa,
    envios,
    isRunning,
    setIdSimulacion,
    setTipoSimulacion,
    setEstado,
    setMapa,
    setEnvios,
    setIsRunning,
    reset,
  } = useLiveSimulationStore();

  const startedRef = useRef(false);
  const isFetchingStateRef = useRef(false);
  const isFetchingMapRef = useRef(false);
  const isFetchingShipmentsRef = useRef(false);
  const shipmentsRefreshTimerRef = useRef<number | null>(null);
  const stateRefreshTimerRef = useRef<number | null>(null);
  const pendingShipmentsRefreshRef = useRef(false);
  const lastShipmentsRefreshAtRef = useRef(0);
  const [isSseConnected, setIsSseConnected] = useState(false);
  const [sseFallbackActive, setSseFallbackActive] = useState(false);
  const [mapClockTickMs, setMapClockTickMs] = useState(() => Date.now());

  const attachState = (data: BackendEstadoSimulacion) => {
    if (data.idSimulacion === null) {
      return;
    }

    setEstado(data);
    setIdSimulacion(data.idSimulacion);
    setTipoSimulacion(inferSimulationType(data.k, tipoPeriodo));
    setIsRunning(Boolean(data.activa));
  };

  const fetchLiveState = useCallback(async () => {
    if (idSimulacion === null || isFetchingStateRef.current) {
      return;
    }
    isFetchingStateRef.current = true;

    try {
      const estadoActual = await getLiveSimulationState(idSimulacion);
      if (estadoActual) {
        setEstado(estadoActual);
        setIsRunning(Boolean(estadoActual.activa));
      }
    } finally {
      isFetchingStateRef.current = false;
    }
  }, [idSimulacion, setEstado, setIsRunning]);

  const fetchLiveMap = useCallback(async () => {
    if (idSimulacion === null || isFetchingMapRef.current) {
      return;
    }
    isFetchingMapRef.current = true;

    try {
      const mapaActual = await getLiveSimulationMap(idSimulacion);
      if (mapaActual) {
        setMapa(mapaActual);
      }
    } finally {
      isFetchingMapRef.current = false;
    }
  }, [idSimulacion, setMapa]);

  const fetchLiveShipments = useCallback(async () => {
    if (idSimulacion === null || isFetchingShipmentsRef.current) {
      return;
    }
    isFetchingShipmentsRef.current = true;

    try {
      const enviosActuales = await listLiveSimulationShipments(idSimulacion);
      setEnvios(enviosActuales);
      lastShipmentsRefreshAtRef.current = Date.now();
    } finally {
      isFetchingShipmentsRef.current = false;
    }
  }, [idSimulacion, setEnvios]);

  const fetchFullSnapshot = useCallback(async () => {
    await Promise.all([
      fetchLiveState(),
      fetchLiveMap(),
      fetchLiveShipments(),
    ]);
  }, [fetchLiveMap, fetchLiveShipments, fetchLiveState]);

  const scheduleStateRefresh = useCallback(() => {
    if (stateRefreshTimerRef.current !== null) {
      window.clearTimeout(stateRefreshTimerRef.current);
    }

    stateRefreshTimerRef.current = window.setTimeout(() => {
      stateRefreshTimerRef.current = null;
      void fetchLiveState();
    }, SSE_REFRESH_DEBOUNCE_MS);
  }, [fetchLiveState]);

  const scheduleShipmentsRefresh = useCallback(() => {
    pendingShipmentsRefreshRef.current = true;

    if (shipmentsRefreshTimerRef.current !== null) {
      window.clearTimeout(shipmentsRefreshTimerRef.current);
    }

    const runScheduledRefresh = () => {
      shipmentsRefreshTimerRef.current = null;

      if (!pendingShipmentsRefreshRef.current) {
        return;
      }

      if (isFetchingShipmentsRef.current) {
        shipmentsRefreshTimerRef.current = window.setTimeout(
          runScheduledRefresh,
          SSE_REFRESH_DEBOUNCE_MS
        );
        return;
      }

      const elapsedMs = Date.now() - lastShipmentsRefreshAtRef.current;
      if (elapsedMs < SSE_SHIPMENTS_REFRESH_THROTTLE_MS) {
        shipmentsRefreshTimerRef.current = window.setTimeout(
          runScheduledRefresh,
          SSE_SHIPMENTS_REFRESH_THROTTLE_MS - elapsedMs
        );
        return;
      }

      pendingShipmentsRefreshRef.current = false;
      void fetchLiveShipments();
    };

    shipmentsRefreshTimerRef.current = window.setTimeout(
      runScheduledRefresh,
      SSE_REFRESH_DEBOUNCE_MS
    );
  }, [fetchLiveShipments]);

  useEffect(() => {
    return () => {
      if (stateRefreshTimerRef.current !== null) {
        window.clearTimeout(stateRefreshTimerRef.current);
      }
      if (shipmentsRefreshTimerRef.current !== null) {
        window.clearTimeout(shipmentsRefreshTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (USE_MOCK_DATA || idSimulacion !== null) {
      return;
    }

    let cancelled = false;

    const hydrateCurrentSimulation = async () => {
      const currentState = await getCurrentLiveSimulationState();

      if (
        cancelled ||
        !currentState ||
        currentState.idSimulacion === null ||
        !currentState.activa
      ) {
        return;
      }

      attachState(currentState);
    };

    void hydrateCurrentSimulation();

    return () => {
      cancelled = true;
    };
  }, [
    idSimulacion,
    setEstado,
    setIdSimulacion,
    setIsRunning,
    setTipoSimulacion,
    tipoPeriodo,
  ]);

  useEffect(() => {
    if (
      USE_MOCK_DATA ||
      !autoStart ||
      startedRef.current ||
      idSimulacion !== null
    ) {
      return;
    }

    let cancelled = false;
    startedRef.current = true;

    const k =
      tipoPeriodo === "colapso"
        ? kColapso
        : K_BY_TIPO[tipoPeriodo] ?? DEFAULT_SIMULATION_K;

    const ensureSimulation = async () => {
      const currentState = await getCurrentLiveSimulationState();

      if (cancelled) {
        return;
      }

      if (currentState && currentState.idSimulacion !== null && currentState.activa) {
        attachState(currentState);
        return;
      }

      let data: BackendEstadoSimulacion | null = null;

      try {
        data = await startLiveSimulation({
          k,
          fechaInicio,
          horaInicio,
          duracionDias: DURACION_DIAS_BY_TIPO[tipoPeriodo],
        });
      } catch {
        return;
      }

      if (cancelled) {
        return;
      }

      if (data && data.idSimulacion !== null) {
        attachState(data);
        return;
      }

      const fallbackState = await getCurrentLiveSimulationState();
      if (cancelled) {
        return;
      }

      if (fallbackState && fallbackState.idSimulacion !== null && fallbackState.activa) {
        attachState(fallbackState);
      }
    };

    void ensureSimulation();

    return () => {
      cancelled = true;
    };
  }, [
    fechaInicio,
    horaInicio,
    kColapso,
    autoStart,
    idSimulacion,
    setEstado,
    setIdSimulacion,
    setIsRunning,
    setTipoSimulacion,
      tipoPeriodo,
  ]);

  useEffect(() => {
    if (
      USE_MOCK_DATA ||
      effectivePollingMode !== "sse" ||
      idSimulacion === null
    ) {
      return;
    }

    void fetchFullSnapshot();
  }, [effectivePollingMode, fetchFullSnapshot, idSimulacion]);

  const handleSimulationEvent = useCallback(
    (event: SimulationRealtimeEvent) => {
      switch (event.type) {
        case "connected":
        case "heartbeat":
          return;
        case "map.snapshot":
          if (isMapSnapshotPayload(event.payload)) {
            setMapa(event.payload);
          }
          return;
        case "simulation.state":
          scheduleStateRefresh();
          return;
        case "simulation.finished":
          scheduleStateRefresh();
          return;
        case "map.updated":
        case "flight.updated":
        case "flight.arrived":
        case "flight.cancelled":
        case "warehouse.occupancy.updated":
          return;
        case "shipment.updated":
        case "shipment.replanned":
          scheduleShipmentsRefresh();
          return;
        case "error":
          scheduleStateRefresh();
          return;
      }
    },
    [scheduleShipmentsRefresh, scheduleStateRefresh, setMapa]
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

  useSimulationEvents(idSimulacion, {
    enabled:
      !USE_MOCK_DATA &&
      effectivePollingMode === "sse" &&
      idSimulacion !== null,
    onConnectedChange: handleSseConnectedChange,
    onEvent: handleSimulationEvent,
    onError: handleSseError,
  });

  useEffect(() => {
    if (
      USE_MOCK_DATA ||
      effectivePollingMode !== "sse" ||
      idSimulacion === null ||
      isSseConnected
    ) {
      setSseFallbackActive(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSseFallbackActive(true);
    }, SSE_FALLBACK_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [effectivePollingMode, idSimulacion, isSseConnected]);

  useEffect(() => {
    if (
      USE_MOCK_DATA ||
      effectivePollingMode === "none" ||
      idSimulacion === null ||
      (effectivePollingMode === "sse" && !sseFallbackActive)
    ) {
      return;
    }

    const canPollHeavyData = () =>
      typeof document === "undefined" || document.visibilityState === "visible";
    const isFallback = effectivePollingMode === "sse" && sseFallbackActive;
    const stateIntervalMs = isFallback
      ? FALLBACK_STATE_POLL_INTERVAL_MS
      : STATE_POLL_INTERVAL_MS;
    const mapIntervalMs = isFallback
      ? FALLBACK_MAP_POLL_INTERVAL_MS
      : MAP_POLL_INTERVAL_MS;
    const shipmentsIntervalMs = isFallback
      ? FALLBACK_SHIPMENTS_POLL_INTERVAL_MS
      : SHIPMENTS_POLL_INTERVAL_MS;
    const shouldPollHeavyData = effectivePollingMode === "full" || isFallback;

    const refreshVisibleData = () => {
      if (!canPollHeavyData()) {
        return;
      }

      void fetchLiveState();

      if (shouldPollHeavyData) {
        void fetchLiveMap();
        void fetchLiveShipments();
      }
    };

    refreshVisibleData();

    const stateIntervalId = window.setInterval(() => {
      if (canPollHeavyData()) {
        void fetchLiveState();
      }
    }, stateIntervalMs);
    const mapIntervalId =
      shouldPollHeavyData
        ? window.setInterval(() => {
            void fetchLiveMap();
          }, mapIntervalMs)
        : null;
    const shipmentsIntervalId =
      shouldPollHeavyData
        ? window.setInterval(() => {
            void fetchLiveShipments();
          }, shipmentsIntervalMs)
        : null;

    const handleVisibilityChange = () => {
      refreshVisibleData();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(stateIntervalId);
      if (mapIntervalId !== null) {
        window.clearInterval(mapIntervalId);
      }
      if (shipmentsIntervalId !== null) {
        window.clearInterval(shipmentsIntervalId);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    effectivePollingMode,
    fetchLiveMap,
    fetchLiveShipments,
    fetchLiveState,
    idSimulacion,
    sseFallbackActive,
  ]);

  useEffect(() => {
    if (USE_MOCK_DATA || !estado?.activa || !(mapa?.vuelos?.length)) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setMapClockTickMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [estado?.activa, mapa?.vuelos?.length]);

  const flights: MapFlight[] = useMemo(
    () => {
      const backendSimMinutesPerSecond =
        estado?.scMinutos && estado.intervaloRealMs && estado.intervaloRealMs > 0
          ? estado.scMinutos / (estado.intervaloRealMs / 1000)
          : null;
      const referenceMinute = resolveLiveReferenceMinute(estado);

      return buildEmptyMapFlights(mapa?.vuelos ?? [], {
        allowBackendProgressFallback: false,
        referenceMinute,
        simMinutesPerSecond:
          backendSimMinutesPerSecond !== null
            ? backendSimMinutesPerSecond * speed
            : null,
      });
    },
    [
      estado?.intervaloRealMs,
      estado?.fechaHoraInicioReal,
      estado?.punteroConsumoMinutos,
      estado?.scMinutos,
      estado?.ultimoMinutoSimulacion,
      mapClockTickMs,
      mapa?.vuelos,
      speed,
    ]
  );

  const occupancyByIcao = useMemo(
    () => mapa?.ocupacionPorAeropuerto ?? {},
    [mapa]
  );

  const stop = async () => {
    if (USE_MOCK_DATA) return;
    await stopLiveSimulation();
    reset();
    startedRef.current = false;
  };

  return {
    idSimulacion,
    estado,
    mapa,
    envios,
    flights,
    occupancyByIcao,
    isRunning,
    tipoSimulacion,
    stop,
  };
};
