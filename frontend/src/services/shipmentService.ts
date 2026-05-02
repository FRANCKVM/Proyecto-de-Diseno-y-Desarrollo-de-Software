import api from "@/services/api";
import { mockResolve } from "@/services/sources2.0";
import { ENVIOS_DETALLE_MOCK } from "@/services/sources2.0/shipments.mock";
import { USE_MOCK_DATA } from "@/utils/constants";
import type { EnvioDetalle } from "@/types/shipment.types";

/**
 * Servicio de envios.
 *
 * Si USE_MOCK_DATA=true, devuelve datos del mock. Si es false,
 * ataca el backend.
 */

/**
 * Obtiene el detalle de un envio por su codigo.
 * Endpoint: GET /envios/{codigo}
 */
export const getShipmentByCode = async (
  codigo: string
): Promise<EnvioDetalle | null> => {
  if (USE_MOCK_DATA) {
    const found = ENVIOS_DETALLE_MOCK.find((e) => e.codigo === codigo);
    return mockResolve<EnvioDetalle | null>(found ?? null);
  }
  try {
    const { data } = await api.get<EnvioDetalle>(`/envios/${codigo}`);
    return data;
  } catch {
    return null;
  }
};
