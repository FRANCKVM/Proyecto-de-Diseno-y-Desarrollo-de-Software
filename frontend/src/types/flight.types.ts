/**
 * Tipos del dominio de vuelos para consumo de drawers.
 *
 * NOTA: distinto de `AnimatedFlight` (de simulation.types) que es solo
 * el shape para animacion visual. Aqui modelamos el vuelo como entidad
 * de negocio con horarios, capacidad, envios asociados, etc.
 */
/** Tipo de vuelo segun cobertura geografica. */
export type TipoVuelo = "intracontinental" | "intercontinental";

/** Estado puntual de un vuelo en el ciclo operativo. */
export type EstadoVuelo =
  | "programado"
  | "abordando"
  | "en_vuelo"
  | "aterrizando"
  | "completado"
  | "cancelado";

/**
 * Resumen de un envio transportado por un vuelo.
 * Vista comprimida, suficiente para listar dentro del FlightDrawer.
 */
export interface EnvioEnVuelo {
  codigo: string;
  origenIcao: string;
  destinoIcao: string;
  /** Maletas que ocupa este envio en el vuelo. */
  maletasOcupadas: number;
  /** Total de maletas del envio (puede haber otras en distinto vuelo). */
  maletasTotales: number;
}

/**
 * Vuelo en formato detallado (para FlightDrawer).
 */
export interface VueloDetalle {
  codigo: string;
  estado: EstadoVuelo;
  tipo: TipoVuelo;
  /** Capacidad maxima del vuelo, en numero de maletas. */
  capacidad: number;
  /** Maletas actualmente ocupadas. */
  ocupacion: number;
  origenIcao: string;
  destinoIcao: string;
  /** ISO 8601 de salida. */
  fechaSalida: string;
  /** ISO 8601 de llegada estimada. */
  fechaLlegadaEstimada: string;
  envios: EnvioEnVuelo[];
}
