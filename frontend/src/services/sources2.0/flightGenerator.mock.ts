/**
 * Generador de vuelos demo con sesgo realista hacia hubs.
 *
 * Reemplaza el array hardcoded de la entrega B. Permite generar la
 * cantidad de vuelos que la pantalla necesite, con duraciones
 * coherentes (intercontinentales mas largos que intracontinentales)
 * y un patron visual mas natural que asignacion 100% aleatoria.
 *
 * NOTA: estos datos son solo para validacion visual. Cuando el
 * backend entregue endpoints reales de vuelos programados, el
 * componente flightService consume desde alli y este generador
 * deja de invocarse (controlado por VITE_USE_MOCK).
 */

import type { AnimatedFlight } from "@/types/simulation.types";
import { AIRPORTS_MOCK } from "@/services/sources2.0/airports.mock";

/**
 * Aeropuertos que actuan como hub. Tienen mayor probabilidad de
 * aparecer como origen o destino de un vuelo.
 *
 * Seleccion basada en los aeropuertos mas mencionados en los mockups:
 * EDDI, EHAM, OMDB, VIDP en hubs continentales europeos/asiaticos;
 * SPIM, SBBR como hubs sudamericanos.
 */
const HUB_ICAOS = new Set(["EDDI", "EHAM", "OMDB", "VIDP", "SPIM", "SBBR"]);

/**
 * Peso relativo de cada aeropuerto al sortear. Los hubs pesan 3x mas
 * que el resto, asi que un dataset uniforme genera vuelos sesgados
 * hacia esos hubs en proporcion 3:1.
 */
const HUB_WEIGHT = 3;
const NORMAL_WEIGHT = 1;

/**
 * Continentes inferidos a partir de la longitud, para distinguir
 * vuelos intra de inter sin necesidad de un campo adicional en el mock.
 *
 * Es una heuristica suficiente para el nivel de fidelidad demo: los
 * 30 aeropuertos del mock estan en America (lng < -30), Europa
 * (-30 <= lng < 40) o Asia/Medio Oriente (lng >= 40).
 */
type Region = "americas" | "europe" | "asia";

const inferRegion = (lng: number): Region => {
  if (lng < -30) return "americas";
  if (lng < 40) return "europe";
  return "asia";
};

/**
 * Duracion en segundos de tiempo simulado para un vuelo entre dos
 * regiones. Valores escogidos para que a velocidad 1x el usuario
 * vea un ciclo completo de vuelo en 30-90 segundos reales.
 *
 * El multiplicador de velocidad del store reduce estos numeros
 * proporcionalmente en runtime.
 */
const FLIGHT_DURATION_SECONDS: Record<"intra" | "inter", number> = {
  intra: 30,
  inter: 60,
};

/**
 * Pool de ICAOs ponderado segun HUB_WEIGHT / NORMAL_WEIGHT.
 * Se construye una sola vez al cargar el modulo.
 */
const WEIGHTED_ICAO_POOL: string[] = (() => {
  const pool: string[] = [];
  for (const a of AIRPORTS_MOCK) {
    const weight = HUB_ICAOS.has(a.icao) ? HUB_WEIGHT : NORMAL_WEIGHT;
    for (let i = 0; i < weight; i++) pool.push(a.icao);
  }
  return pool;
})();

/**
 * Lookup de region por ICAO. Calculado una vez del mock estatico.
 */
const REGION_BY_ICAO: Map<string, Region> = (() => {
  const m = new Map<string, Region>();
  for (const a of AIRPORTS_MOCK) {
    // Se hace dms->lng aqui sin importar geoUtils para no introducir
    // dependencia circular (geoUtils -> mocks ya existe en helpers).
    // Lo simplificamos parseando el grado de longitud directamente.
    const match = a.lngDMS.match(/^(\d+)°.+([EW])\s*$/i);
    if (!match) {
      m.set(a.icao, "europe");
      continue;
    }
    const grados = Number(match[1]);
    const dir = match[2].toUpperCase();
    const lng = dir === "W" ? -grados : grados;
    m.set(a.icao, inferRegion(lng));
  }
  return m;
})();

/**
 * Toma un elemento aleatorio del pool ponderado.
 */
const pickWeighted = (): string =>
  WEIGHTED_ICAO_POOL[Math.floor(Math.random() * WEIGHTED_ICAO_POOL.length)];

/**
 * Devuelve un par origen/destino distintos.
 * Para evitar bias hacia bucles cortos, asegura que origen != destino.
 */
const pickFromTo = (): { from: string; to: string } => {
  const from = pickWeighted();
  let to = pickWeighted();
  while (to === from) to = pickWeighted();
  return { from, to };
};

/**
 * Determina la duracion del vuelo segun si cruza regiones.
 */
const durationFor = (fromIcao: string, toIcao: string): number => {
  const fromRegion = REGION_BY_ICAO.get(fromIcao);
  const toRegion = REGION_BY_ICAO.get(toIcao);
  const isInter = fromRegion !== toRegion;
  return FLIGHT_DURATION_SECONDS[isInter ? "inter" : "intra"];
};

/**
 * Genera un vuelo nuevo con valores aleatorios.
 *
 * @param id            Identificador a asignar.
 * @param initialProgress  Avance inicial (0 a 1). Para staggered start
 *                         se le pasa un valor random; para respawn,
 *                         siempre 0.
 */
export const generateFlight = (
  id: string,
  initialProgress = 0
): AnimatedFlight => {
  const { from, to } = pickFromTo();
  return {
    id,
    fromIcao: from,
    toIcao: to,
    progress: initialProgress,
    durationSeconds: durationFor(from, to),
  };
};

/**
 * Genera N vuelos con progress inicial escalonado.
 *
 * El staggered start evita que todos los aviones aparezcan despegando
 * al mismo tiempo del centro del mapa: cada uno arranca en una posicion
 * distinta de su trayecto, dando sensacion de operacion en marcha.
 */
export const generateFlightPool = (count: number): AnimatedFlight[] => {
  const flights: AnimatedFlight[] = [];
  for (let i = 0; i < count; i++) {
    flights.push(generateFlight(`SIM-${String(i).padStart(3, "0")}`, Math.random()));
  }
  return flights;
};
