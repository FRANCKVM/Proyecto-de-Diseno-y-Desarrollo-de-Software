import { useEffect, useMemo, useRef } from "react";
import {
  getCurrentLiveSimulationState,
  getLiveSimulationMap,
  getLiveSimulationState,
  listLiveSimulationShipments,
  startLiveSimulation,
  stopLiveSimulation,
} from "@/services/simulationService";
import { useSimulationConfigStore } from "@/store/simulationConfigStore";
import { useLiveSimulationStore } from "@/store/liveSimulationStore";
import { USE_MOCK_DATA } from "@/utils/constants";
import type { MapFlight } from "@/components/map/WorldMap";
import type { BackendEstadoSimulacion } from "@/types/backendSimulation.types";
import type { TipoSimulacion } from "@/types/common.types";

const POLL_INTERVAL_MS = 3000;
const DEFAULT_SIMULATION_K = 1;

const K_BY_TIPO = {
  semanal: 15,
  colapso: 30,
} as const;

const DURACION_DIAS_BY_TIPO = {
  semanal: 5,
  colapso: null,
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

  return fallback;
};

interface UseLiveSimulationOptions {
  autoStart?: boolean;
  enablePolling?: boolean;
}

export const useLiveSimulation = (
  options: UseLiveSimulationOptions = {}
) => {
  const { autoStart = true, enablePolling = true } = options;
  const tipoPeriodo = useSimulationConfigStore((s) => s.tipoPeriodo);
  const fechaInicio = useSimulationConfigStore((s) => s.fechaInicio);
  const horaInicio = useSimulationConfigStore((s) => s.horaInicio);

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

  const attachState = (data: BackendEstadoSimulacion) => {
    if (data.idSimulacion === null) {
      return;
    }

    setEstado(data);
    setIdSimulacion(data.idSimulacion);
    setTipoSimulacion(inferSimulationType(data.k, tipoPeriodo));
    setIsRunning(Boolean(data.activa));
  };

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
        currentState.idSimulacion === null
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

    const k = K_BY_TIPO[tipoPeriodo] ?? DEFAULT_SIMULATION_K;

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
    autoStart,
    idSimulacion,
    setEstado,
    setIdSimulacion,
    setIsRunning,
    setTipoSimulacion,
    tipoPeriodo,
  ]);

  useEffect(() => {
    if (USE_MOCK_DATA || !enablePolling || idSimulacion === null) {
      return;
    }

    let cancelled = false;

    const poll = async () => {
      const [estadoActual, mapaActual, enviosActuales] = await Promise.all([
        getLiveSimulationState(idSimulacion),
        getLiveSimulationMap(idSimulacion),
        listLiveSimulationShipments(idSimulacion),
      ]);

      if (cancelled) {
        return;
      }

      if (estadoActual) {
        setEstado(estadoActual);
        setIsRunning(Boolean(estadoActual.activa));
      }

      if (mapaActual) {
        setMapa(mapaActual);
      }

      setEnvios(enviosActuales);
    };

    poll();
    const intervalId = window.setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    enablePolling,
    idSimulacion,
    setEnvios,
    setEstado,
    setIsRunning,
    setMapa,
  ]);

  const flights: MapFlight[] = useMemo(
    () =>
      (mapa?.vuelos ?? []).map((vuelo) => ({
        id: vuelo.id,
        fromIcao: vuelo.fromIcao,
        toIcao: vuelo.toIcao,
        progress: vuelo.progress,
      })),
    [mapa]
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
    envios,
    flights,
    occupancyByIcao,
    isRunning,
    tipoSimulacion,
    stop,
  };
};
