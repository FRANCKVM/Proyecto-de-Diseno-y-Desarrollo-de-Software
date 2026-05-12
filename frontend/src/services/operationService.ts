import api from "@/services/api";
import { mockResolve } from "@/services/sources2.0";
import { USE_MOCK_DATA } from "@/utils/constants";
import type {
  CreateOperationShipmentRequest,
  BackendEstadoOperacion,
  BackendMapaSimulacionEstado,
  BackendSolicitudEnvio,
} from "@/types/backendSimulation.types";

export const getOperationState = async (): Promise<BackendEstadoOperacion | null> => {
  if (USE_MOCK_DATA) {
    return mockResolve<BackendEstadoOperacion | null>(null);
  }

  try {
    const { data } = await api.get<BackendEstadoOperacion>("/operacion/estado");
    return data;
  } catch {
    return null;
  }
};

export const getOperationMap = async (): Promise<BackendMapaSimulacionEstado | null> => {
  if (USE_MOCK_DATA) {
    return mockResolve<BackendMapaSimulacionEstado | null>(null);
  }

  try {
    const { data } = await api.get<BackendMapaSimulacionEstado>("/operacion/mapa");
    return data;
  } catch {
    return null;
  }
};

export const listOperationShipments = async (): Promise<BackendSolicitudEnvio[]> => {
  if (USE_MOCK_DATA) {
    return mockResolve<BackendSolicitudEnvio[]>([]);
  }

  const { data } = await api.get<BackendSolicitudEnvio[]>("/operacion/envios");
  return data;
};

export const createOperationShipment = async (
  payload: CreateOperationShipmentRequest
): Promise<BackendSolicitudEnvio> => {
  if (USE_MOCK_DATA) {
    const now = new Date();
    return mockResolve<BackendSolicitudEnvio>({
      idEnvio: Date.now(),
      fecha: now.toISOString().slice(0, 10),
      hora: now.toTimeString().slice(0, 8),
      idCliente: 1,
      ruta: null,
      simulacion: null,
      origen: {
        codigo: payload.origenIcao,
        ciudad: payload.origenIcao,
        region: "",
        pais: "",
        alias: null,
        desplazamientoGMT: 0,
        capacidad: 0,
        latitud: 0,
        longitud: 0,
      },
      destino: {
        codigo: payload.destinoIcao,
        ciudad: payload.destinoIcao,
        region: "",
        pais: "",
        alias: null,
        desplazamientoGMT: 0,
        capacidad: 0,
        latitud: 0,
        longitud: 0,
      },
      contarBolsas: payload.contarBolsas,
      diasTiempoMaximo: payload.origenIcao === payload.destinoIcao ? 1 : 2,
      estado: "INGRESADO",
    });
  }

  try {
    const { data } = await api.post<BackendSolicitudEnvio>("/operacion/envios", payload);
    return data;
  } catch (error: any) {
    const message =
      error?.response?.data && typeof error.response.data === "string"
        ? error.response.data
        : "No se pudo registrar el envio.";
    throw new Error(message);
  }
};
