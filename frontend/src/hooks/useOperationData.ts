import { useEffect, useRef, useState } from "react";
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

const STATE_POLL_INTERVAL_MS = 5000;
const MAP_POLL_INTERVAL_MS = 10000;
const SHIPMENTS_POLL_INTERVAL_MS = 15000;

export const useOperationData = () => {
  const [estado, setEstado] = useState<BackendEstadoOperacion | null>(null);
  const [mapa, setMapa] = useState<BackendMapaSimulacionEstado | null>(null);
  const [envios, setEnvios] = useState<BackendSolicitudEnvio[]>([]);
  const isFetchingStateRef = useRef(false);
  const isFetchingMapRef = useRef(false);
  const isFetchingShipmentsRef = useRef(false);

  const fetchState = async () => {
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
  };

  const fetchMap = async () => {
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
  };

  const fetchShipments = async () => {
    if (isFetchingShipmentsRef.current) {
      return;
    }
    isFetchingShipmentsRef.current = true;

    try {
      const enviosActuales = await listOperationShipments();
      setEnvios(enviosActuales);
    } finally {
      isFetchingShipmentsRef.current = false;
    }
  };

  const refresh = async () => {
    await Promise.all([fetchState(), fetchMap(), fetchShipments()]);
  };

  useEffect(() => {
    if (USE_MOCK_DATA) {
      return;
    }

    let cancelled = false;
    const canPoll = () =>
      typeof document === "undefined" || document.visibilityState === "visible";

    const safeFetchState = async () => {
      if (!canPoll() || isFetchingStateRef.current) {
        return;
      }
      isFetchingStateRef.current = true;

      try {
        const estadoActual = await getOperationState();
        if (!cancelled && estadoActual) {
          setEstado(estadoActual);
        }
      } finally {
        isFetchingStateRef.current = false;
      }
    };

    const safeFetchMap = async () => {
      if (!canPoll() || isFetchingMapRef.current) {
        return;
      }
      isFetchingMapRef.current = true;

      try {
        const mapaActual = await getOperationMap();
        if (!cancelled && mapaActual) {
          setMapa(mapaActual);
        }
      } finally {
        isFetchingMapRef.current = false;
      }
    };

    const safeFetchShipments = async () => {
      if (!canPoll() || isFetchingShipmentsRef.current) {
        return;
      }
      isFetchingShipmentsRef.current = true;

      try {
        const enviosActuales = await listOperationShipments();
        if (!cancelled) {
          setEnvios(enviosActuales);
        }
      } finally {
        isFetchingShipmentsRef.current = false;
      }
    };

    const refreshVisibleData = () => {
      if (!canPoll()) {
        return;
      }

      void safeFetchState();
      void safeFetchMap();
      void safeFetchShipments();
    };

    refreshVisibleData();

    const stateIntervalId = window.setInterval(() => {
      void safeFetchState();
    }, STATE_POLL_INTERVAL_MS);
    const mapIntervalId = window.setInterval(() => {
      void safeFetchMap();
    }, MAP_POLL_INTERVAL_MS);
    const shipmentsIntervalId = window.setInterval(() => {
      void safeFetchShipments();
    }, SHIPMENTS_POLL_INTERVAL_MS);
    const handleVisibilityChange = () => {
      refreshVisibleData();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(stateIntervalId);
      window.clearInterval(mapIntervalId);
      window.clearInterval(shipmentsIntervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return {
    estado,
    mapa,
    envios,
    refresh,
  };
};
