import { MOCK_LATENCY_MS } from "@/utils/constants";

/**
 * Envuelve un valor en una promesa que resuelve tras MOCK_LATENCY_MS.
 *
 * Imita la latencia de red para que los hooks y componentes que
 * consuman servicios mock se comporten exactamente igual cuando se
 * cambie a backend real (estados de loading/error reales en UI).
 *
 * Uso tipico desde un servicio:
 *   if (USE_MOCK_DATA) return mockResolve(AIRPORTS_MOCK);
 *
 * @param value Valor a devolver tras la latencia simulada.
 */
export const mockResolve = <T>(value: T): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), MOCK_LATENCY_MS));

/**
 * Variante que rechaza con error simulado, util para testear flujos
 * de error en los hooks.
 */
export const mockReject = <T = never>(message: string): Promise<T> =>
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error(message)), MOCK_LATENCY_MS)
  );
