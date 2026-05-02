/**
 * Datasets demo de ocupacion de almacenes.
 *
 * Cada escenario refleja un "mood" distinto del sistema:
 * - NORMAL:   operacion saludable; mayoria verde, algunos en ambar.
 * - COLAPSO:  hubs europeos saturados, replicando el mockup 10 del Figma.
 *
 * Estos datasets se usan unicamente para visualizar los estados del
 * mapa antes de que el motor de simulacion alimente datos reales en
 * la entrega C. Se eliminan cuando el store de simulacion este conectado.
 */

/**
 * Escenario normal: dia operativo saludable.
 * Usado por las pantallas de simulacion en ejecucion y operacion dia a dia.
 */
export const OCCUPANCY_NORMAL: Record<string, number> = {
  // Verde (< 60%)
  SKBO: 38,
  SBBR: 45,
  EHAM: 48,
  SEQM: 32,
  SCEL: 41,
  SUAA: 35,
  SLLP: 50,
  SVMI: 42,
  // Ambar (60-85%)
  SPIM: 65,
  EDDI: 72,
  OMDB: 60,
  VIDP: 78,
  LATI: 68,
  EBCI: 70,
  // Rojo (>= 85%)
  OAKB: 89,
  OPKC: 91,
};

/**
 * Escenario de colapso: hubs europeos saturados.
 * Replica los porcentajes del mockup 10 del Figma.
 */
export const OCCUPANCY_COLAPSO: Record<string, number> = {
  EDDI: 98,
  EHAM: 95,
  LOWW: 92,
  EKCH: 91,
  EBCI: 88,
  VIDP: 87,
  OMDB: 86,
  OAKB: 85,
  SKBO: 85,
  SPIM: 78,
  SBBR: 72,
  SCEL: 65,
  LKPR: 80,
  LDZA: 75,
  LBSF: 70,
  UMMS: 68,
};
