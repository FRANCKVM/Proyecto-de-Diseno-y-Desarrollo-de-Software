/**
 * Tipos del dominio de envios.
 * Un envio es la unidad logistica del sistema: agrupa N maletas que
 * viajan desde un aeropuerto origen a uno destino, posiblemente con
 * escalas (vuelos en cadena).
 */

import type { TipoVuelo, EstadoVuelo } from "@/types/flight.types";

/** Estado puntual de un envio en su ciclo de vida. */
export type EstadoEnvio =
  | "planificado"
  | "en_transito"
  | "en_escala"
  | "entregado"
  | "cancelado";

/**
 * Hito en la ruta de un envio.
 * Representa un paso del trayecto: salida, escala o entrega final.
 */
export interface HitoRuta {
  /** Tipo de hito (afecta el estilo visual del timeline). */
  tipo: "salida" | "vuelo" | "escala" | "entrega";
  aeropuertoIcao: string;
  /** ISO 8601 del momento del hito. */
  fecha: string;
  /** Codigo del vuelo asociado al hito, si aplica. */
  vueloCodigo?: string;
  /** Estado del hito en el momento de consulta. */
  estado: EstadoVuelo | "completado" | "pendiente" | "activo";
}

/**
 * Bloque de paquetes (rango contiguo de codigos PKG).
 * Se modela asi para no tener que listar individualmente cada paquete
 * cuando son muchos (ej: 45 maletas como en el mockup 06).
 */
export interface BloquePaquetes {
  codigoInicial: string;
  codigoFinal: string;
  cantidad: number;
  estado: string;
}

/**
 * Envio en formato detallado (para ShipmentDrawer).
 */
export interface EnvioDetalle {
  codigo: string;
  estado: EstadoEnvio;
  aerolinea: string;
  origenIcao: string;
  destinoIcao: string;
  tipo: TipoVuelo;
  /** Plazo maximo de entrega en dias. */
  plazoMaximoDias: number;
  /** ISO 8601 de registro. */
  fechaRegistro: string;
  cantidadMaletas: number;
  ruta: HitoRuta[];
  paquetes: BloquePaquetes[];
  /** Tiempo restante para entrega, en formato legible (ej: "1 dia 6 horas"). */
  tiempoRestante: string;
  /** Si esta dentro o fuera del plazo. */
  dentroDePlazo: boolean;
}
