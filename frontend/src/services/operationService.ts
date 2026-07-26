import api from "@/services/api";
import { mockResolve } from "@/services/sources2.0";
import { USE_MOCK_DATA } from "@/utils/constants";
import { EMPTY_SHIPMENT_STATUS_COUNTS } from "@/utils/shipmentStatus";
import type {
  CreateOperationShipmentRequest,
  BackendBaggageItem,
  BackendEstadoOperacion,
  BackendMapaSimulacionEstado,
  BackendOperacionHomeResumen,
  BackendPageQuery,
  BackendPagedResponse,
  BackendSolicitudEnvio,
  OperationShipmentTxtUploadResponse,
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

export const getOperationHomeSummary = async (
  limiteActividad = 5
): Promise<BackendOperacionHomeResumen | null> => {
  if (USE_MOCK_DATA) {
    return mockResolve<BackendOperacionHomeResumen | null>(null);
  }

  try {
    const { data } = await api.get<BackendOperacionHomeResumen>(
      "/operacion/resumen-home",
      { params: { limiteActividad } }
    );
    return data;
  } catch {
    return null;
  }
};

const emptyPagedResponse = <T>(
  size: number,
  countsByStatus: Record<string, number> = EMPTY_SHIPMENT_STATUS_COUNTS
): BackendPagedResponse<T> => ({
  items: [],
  page: 0,
  size,
  totalItems: 0,
  totalPages: 0,
  hasMore: false,
  countsByStatus,
  countsByDirection: {
    todos: 0,
    entrantes: 0,
    salientes: 0,
  },
});

export const listOperationShipmentsPage = async (
  params: BackendPageQuery
): Promise<BackendPagedResponse<BackendSolicitudEnvio>> => {
  if (USE_MOCK_DATA) {
    return mockResolve<BackendPagedResponse<BackendSolicitudEnvio>>(
      emptyPagedResponse<BackendSolicitudEnvio>(params.size ?? 80)
    );
  }

  const { data } = await api.get<BackendPagedResponse<BackendSolicitudEnvio>>(
    "/operacion/envios/pagina",
    { params }
  );
  return data;
};

export const listOperationBaggagePage = async (
  params: BackendPageQuery
): Promise<BackendPagedResponse<BackendBaggageItem>> => {
  if (USE_MOCK_DATA) {
    return mockResolve<BackendPagedResponse<BackendBaggageItem>>(
      emptyPagedResponse<BackendBaggageItem>(params.size ?? 100)
    );
  }

  const { data } = await api.get<BackendPagedResponse<BackendBaggageItem>>(
    "/operacion/maletas",
    { params }
  );
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
      hora: now.toISOString().slice(11, 19),
      idCliente: 1,
      ruta: null,
      idSimulacion: null,
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
      estado: "REGISTRADO",
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

export const uploadOperationShipmentsTxt = async (
  file: File
): Promise<OperationShipmentTxtUploadResponse> => {
  if (USE_MOCK_DATA) {
    return mockResolve<OperationShipmentTxtUploadResponse>({
      totalLineas: 12,
      enviosRegistrados: 12,
      lineasOmitidas: 0,
      errores: [],
    });
  }

  const formData = new FormData();
  formData.append("archivo", file);

  try {
    const { data } = await api.post<OperationShipmentTxtUploadResponse>(
      "/operacion/envios/txt",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        timeout: 120_000,
      }
    );
    return data;
  } catch (error: any) {
    const message =
      error?.response?.data && typeof error.response.data === "string"
        ? error.response.data
        : "No se pudo cargar el archivo de envios.";
    throw new Error(message);
  }
};
