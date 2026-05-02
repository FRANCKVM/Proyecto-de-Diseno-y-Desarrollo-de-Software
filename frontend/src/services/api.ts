import axios, { type AxiosInstance } from "axios";
import { API_BASE_URL } from "@/utils/constants";

/**
 * Instancia Axios centralizada para todas las llamadas al backend.
 *
 * Consumir SIEMPRE desde aqui, no crear instancias paralelas en
 * servicios concretos. Esto garantiza:
 *   - Una sola baseURL configurable por entorno.
 *   - Un punto unico para anadir auth headers cuando llegue el modulo.
 *   - Un punto unico para manejo global de errores HTTP.
 *
 * Cuando VITE_USE_MOCK=true, los servicios cortan antes de invocar
 * a esta instancia y devuelven datos de sources2.0. Cuando se ponga
 * en false, la URL real (VITE_API_BASE_URL) toma efecto.
 */
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * Interceptor de requests.
 * Hoy es no-op; cuando se integre auth, aqui se inyecta el token.
 */
api.interceptors.request.use((config) => {
  // TODO: token de autenticacion cuando exista el modulo de auth
  // const token = useUserStore.getState().token;
  // if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * Interceptor de responses.
 * Centraliza el manejo de errores HTTP recurrentes.
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // En produccion conviene mapear codigos a errores tipados o
    // disparar toasts globales aqui. Por ahora dejamos pasar.
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error("[api error]", error?.response?.status, error?.message);
    }
    return Promise.reject(error);
  }
);

export default api;
