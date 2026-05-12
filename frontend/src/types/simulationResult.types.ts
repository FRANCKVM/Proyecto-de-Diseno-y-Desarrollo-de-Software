/**
 * Tipos del dominio de resultados de simulacion.
 * Cubre tanto la simulacion de periodo como la simulacion al colapso.
 */

import type { EstadoSemaforo, TipoSimulacion } from "@/types/common.types";

/**
 * Fila de la tabla "Desempeno por aeropuerto" en resultados de periodo.
 */
export interface DesempenoAeropuerto {
  icao: string;
  nombre: string;
  /** Maletas recibidas durante el periodo. */
  recibidas: number;
  /** Maletas enviadas durante el periodo. */
  enviadas: number;
  /** Ocupacion promedio del almacen (porcentaje). */
  ocupacionPromedio: number;
  /** Ocupacion maxima del almacen alcanzada (porcentaje). */
  ocupacionMaxima: number;
  estado: EstadoSemaforo;
}

/**
 * Resumen operativo del periodo simulado.
 */
export interface ResumenOperativo {
  maletasIntra: number;
  maletasInter: number;
  /** Tiempo promedio de entrega intracontinental (en dias). */
  tiempoPromedioIntra: number;
  /** Tiempo promedio de entrega intercontinental (en dias). */
  tiempoPromedioInter: number;
  /** Numero de aeropuertos que terminaron en estado critico. */
  aeropuertosEnRojo: number;
  /** ICAOs de los aeropuertos en rojo. */
  icaosEnRojo: string[];
  /** Duracion real de la simulacion en minutos. */
  duracionMinutos: number;
}

/**
 * Resultado de una simulacion de periodo.
 * Mockup 07 del Figma.
 */
export interface ResultadoPeriodo {
  id: string;
  tipo: TipoSimulacion;
  /** Rango de fechas en formato legible (ej: "Semanal 07-13/04/2026"). */
  rango: string;
  totalMaletas: number;
  /** Porcentaje de cumplimiento de plazos (0-100). */
  cumplimiento: number;
  vuelosEjecutados: number;
  cancelaciones: number;
  replanificaciones: number;
  desempenoPorAeropuerto: DesempenoAeropuerto[];
  resumen: ResumenOperativo;
  conclusion: string;
  /** Mensaje de atencion si lo hay (ej: aeropuerto saturado). */
  atencion?: string;
}

/**
 * Aeropuerto critico al detectarse el colapso (mockup 10).
 */
export interface AeropuertoCritico {
  icao: string;
  nombre: string;
  ocupacionMaxima: number;
}

/**
 * Resultado de una simulacion al colapso.
 * Mockup 10 del Figma.
 */
export interface ResultadoColapso {
  id: string;
  rango: string;
  /** Dia en que se detecto el colapso. */
  diasHastaColapso: number;
  maletasProcesadas: number;
  /** Porcentaje de plazos incumplidos al colapsar (0-100). */
  plazosIncumplidos: number;
  /** Numero y porcentaje de almacenes saturados. */
  almacenesSaturados: { cantidad: number; porcentaje: number };
  /** Factor de demanda maximo alcanzado. */
  factorDemandaMax: number;
  analisis: string[];
  aeropuertosCriticos: AeropuertoCritico[];
  sugerencia: string;
}
