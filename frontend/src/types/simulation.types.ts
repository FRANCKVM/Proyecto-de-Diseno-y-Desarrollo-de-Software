/**
 * Tipos del dominio de simulacion en tiempo real.
 * Cubre la animacion visual de vuelos y el panel de control flotante.
 */

/**
 * Vuelo activo en el motor de animacion.
 * Extiende `MapFlight` con metadata necesaria para el respawn:
 * el progress avanza en cada frame y, al llegar a 1, el vuelo se
 * regenera con nuevo origen/destino aleatorio.
 */
export interface AnimatedFlight {
  /** Identificador unico del vuelo en la corrida actual. */
  id: string;
  /** Codigo de negocio del vuelo para drawers y tracking. */
  code?: string;
  /** ICAO del aeropuerto origen. */
  fromIcao: string;
  /** ICAO del aeropuerto destino. */
  toIcao: string;
  /** Porcentaje de ocupacion del vuelo para semaforo visual. */
  occupancyPct?: number;
  /** Minuto absoluto de salida dentro de la linea de tiempo usada por el mapa. */
  departureMinute?: number;
  /** Minuto absoluto de llegada dentro de la linea de tiempo usada por el mapa. */
  arrivalMinute?: number;
  /**
   * Avance entre 0 (acaba de despegar) y 1 (esta aterrizando).
   * Cuando alcanza 1, el motor lo respawnea con nuevos extremos.
   */
  progress: number;
  /**
   * Duracion total del vuelo en segundos de tiempo simulado.
   * Vuelos intercontinentales duran mas que intracontinentales.
   * El multiplicador de velocidad del store afecta la conversion
   * a tiempo real.
   */
  durationSeconds: number;
  /**
   * Velocidad visual del avance en unidades de progress por segundo real.
   * Permite que Leaflet interpole entre snapshots sin forzar renders React
   * en cada frame del navegador.
   */
  progressVelocityPerSecond?: number;
  /** Timestamp performance.now() en que se calculo `progress`. */
  progressUpdatedAtMs?: number;
}

/**
 * Velocidades disponibles del reloj de simulacion.
 * Multiplican la velocidad real de avance del progress.
 */
export type SimulationSpeed = 0.5 | 1 | 2 | 4;

/**
 * Configuracion de la animacion para una pantalla concreta.
 * Cada pantalla la pasa al hook `useFlightSimulation` segun su mood.
 */
export interface FlightSimulationConfig {
  /**
   * Numero base de vuelos simultaneos en pantalla.
   * El factor de demanda del store puede aumentar este valor en runtime.
   */
  baseFlightCount: number;
  /**
   * Si es `true`, el numero de vuelos activos se escala con el factor
   * de demanda del simulationControlStore. Solo aplica a pantallas de
   * simulacion (ejecucion, colapso); en dia a dia se ignora.
   */
  scaleByDemand?: boolean;
}
