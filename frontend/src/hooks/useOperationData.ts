import { useEffect, useState } from "react";
import {
  getOperationMap,
  getOperationState,
  listOperationShipments,
} from "@/services/operationService";
import type {
  BackendEstadoOperacion,
  BackendMapaSimulacionEstado,
  BackendSolicitudEnvio,
} from "@/types/backendSimulation.types";
import { USE_MOCK_DATA } from "@/utils/constants";

const POLL_INTERVAL_MS = 5000;

export const useOperationData = () => {
  const [estado, setEstado] = useState<BackendEstadoOperacion | null>(null);
  const [mapa, setMapa] = useState<BackendMapaSimulacionEstado | null>(null);
  const [envios, setEnvios] = useState<BackendSolicitudEnvio[]>([]);

  const poll = async () => {
    const [estadoActual, mapaActual, enviosActuales] = await Promise.all([
      getOperationState(),
      getOperationMap(),
      listOperationShipments(),
    ]);

    if (estadoActual) {
      setEstado(estadoActual);
    }

    if (mapaActual) {
      setMapa(mapaActual);
    }

    setEnvios(enviosActuales);
  };

  useEffect(() => {
    if (USE_MOCK_DATA) {
      return;
    }

    let cancelled = false;

    const safePoll = async () => {
      const [estadoActual, mapaActual, enviosActuales] = await Promise.all([
        getOperationState(),
        getOperationMap(),
        listOperationShipments(),
      ]);

      if (cancelled) {
        return;
      }

      if (estadoActual) {
        setEstado(estadoActual);
      }

      if (mapaActual) {
        setMapa(mapaActual);
      }

      setEnvios(enviosActuales);
    };

    void safePoll();
    const intervalId = window.setInterval(() => {
      void safePoll();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  return {
    estado,
    mapa,
    envios,
    refresh: poll,
  };
};
