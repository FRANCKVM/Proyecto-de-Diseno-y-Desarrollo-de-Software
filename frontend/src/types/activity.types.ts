/**
 * Tipos del feed de actividad reciente del Home.
 */

import type { Severidad } from "@/types/common.types";

/**
 * Item del feed de actividad reciente.
 * Cada item tiene un dot con severidad, una marca temporal corta y un mensaje.
 */
export interface ActividadReciente {
  id: string;
  /** Texto temporal corto (ej: "Hoy 09:15", "Ayer 14:30", "02/04"). */
  cuando: string;
  /** Mensaje descriptivo del evento. */
  mensaje: string;
  severidad: Severidad;
}
