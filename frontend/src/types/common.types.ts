/**
 * Tipos compartidos del dominio Tasf.B2B.
 * Convencion PascalCase para tipos e interfaces (estandar 62).
 */

/** Estado del semaforo de ocupacion de almacenes. */
export type EstadoSemaforo = "normal" | "elevado" | "critico";

/** Tipo de envio segun cobertura geografica. */
export type TipoEnvio = "intracontinental" | "intercontinental";

/** Continente operativo del sistema (estandar 61). */
export type Continente = "America" | "Europa" | "Asia";

/** Tipo de simulacion soportado por el sistema. */
export type TipoSimulacion =
  | "semanal"
  | "diario_5"
  | "diario_3"
  | "colapso"
  | "dia_a_dia";

/** Estado generico de operacion. */
export type Estado =
  | "planificado"
  | "en_ejecucion"
  | "en_vuelo"
  | "en_transito"
  | "completado"
  | "cancelado"
  | "pendiente";

/** Severidad de mensajes del sistema (banners, toasts). */
export type Severidad = "exito" | "advertencia" | "error" | "informacion";

/** Coordenadas geograficas (lat/lng) para Leaflet. */
export interface Coordenadas {
  lat: number;
  lng: number;
}

/** Rango de umbrales del sistema de semaforo (porcentajes 0-100). */
export interface RangoSemaforo {
  verde: number;
  ambar: number;
}
