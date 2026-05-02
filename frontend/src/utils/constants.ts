/**
 * Constantes globales del sistema Tasf.B2B.
 * Convencion SCREAMING_SNAKE_CASE segun estandar 62.
 */

import { COLORS } from "@/styles/theme";

// ============================================================================
// PLAZOS DE ENTREGA (en dias)
// Definidos en la Lista de Exigencias del proyecto.
// ============================================================================
export const MAX_TIEMPO_ENTREGA_INTRACONTINENTAL = 1;
export const MAX_TIEMPO_ENTREGA_INTERCONTINENTAL = 2;

// ============================================================================
// SISTEMA DE SEMAFORO
// Umbrales por defecto de ocupacion de almacen (porcentaje).
// Configurables por el operador en la pantalla de configuracion.
// ============================================================================
export const UMBRAL_SEMAFORO_VERDE_DEFAULT = 60;
export const UMBRAL_SEMAFORO_AMBAR_DEFAULT = 85;

export const COLOR_SEMAFORO_VERDE = COLORS.success.base;
export const COLOR_SEMAFORO_AMBAR = COLORS.warning.base;
export const COLOR_SEMAFORO_ROJO = COLORS.danger.base;

// ============================================================================
// CONFIGURACION DE API
// El switch USE_MOCK_DATA permite alternar entre mocks (sources2.0)
// y backend real sin tocar componentes.
// ============================================================================
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080/api";

export const USE_MOCK_DATA =
  (import.meta.env.VITE_USE_MOCK ?? "true") === "true";

/** Latencia simulada para mocks asincronos (ms). */
export const MOCK_LATENCY_MS = 250;

// ============================================================================
// LAYOUT
// Resolucion de referencia del prototipo (estandar 61, seccion 4.12).
// ============================================================================
export const RESOLUCION_REFERENCIA = { width: 1440, height: 900 } as const;

// ============================================================================
// SIMULACION
// Limites operativos para los distintos escenarios de simulacion.
// ============================================================================
export const DURACION_SIMULACION_SEMANAL_DIAS = 7;
export const DURACION_SIMULACION_DIARIA_5_DIAS = 5;
export const DURACION_SIMULACION_DIARIA_3_DIAS = 3;

/** Velocidades disponibles del reloj de simulacion. */
export const VELOCIDADES_SIMULACION = [0.5, 1, 2, 4] as const;
