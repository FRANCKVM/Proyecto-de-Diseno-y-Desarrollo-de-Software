/**
 * Utilidades geograficas para el sistema Tasf.B2B.
 * Conversion de coordenadas y calculos sobre la esfera terrestre.
 */

/**
 * Convierte una coordenada DMS (Grados, Minutos, Segundos) a decimal.
 *
 * Acepta formatos como:
 * - "04° 42' 05\" N"
 * - "74° 08' 49\" W"
 * - "33° 23' 47\" S"
 *
 * Devuelve negativo para hemisferios S y W, positivo para N y E.
 *
 * @throws Error si el formato no es valido.
 */
export const dmsToDecimal = (dms: string): number => {
  const match = dms.match(/^\s*(\d+)°\s*(\d+)'\s*([\d.]+)"\s*([NSEW])\s*$/i);
  if (!match) {
    throw new Error(`Formato DMS invalido: "${dms}"`);
  }
  const [, gradosStr, minutosStr, segundosStr, hemisferio] = match;
  const grados = Number(gradosStr);
  const minutos = Number(minutosStr);
  const segundos = Number(segundosStr);

  const decimal = grados + minutos / 60 + segundos / 3600;
  const dir = hemisferio.toUpperCase();
  return dir === "S" || dir === "W" ? -decimal : decimal;
};

/**
 * Calcula el bearing (rumbo) inicial desde un punto a otro sobre la esfera.
 *
 * Resultado en grados [0, 360):
 * - 0   = norte
 * - 90  = este
 * - 180 = sur
 * - 270 = oeste
 *
 * Coincide con la convencion de Leaflet y CSS rotate, asi que el valor
 * se puede pasar directamente a `transform: rotate(${bearing}deg)`.
 *
 * Formula: bearing inicial de gran circulo (forward azimuth).
 */
export const calculateBearing = (
  from: [number, number],
  to: [number, number]
): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const lat1 = toRad(from[0]);
  const lat2 = toRad(to[0]);
  const dLng = toRad(to[1] - from[1]);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  const bearing = toDeg(Math.atan2(y, x));
  return (bearing + 360) % 360;
};

/**
 * Interpola linealmente entre dos coordenadas en espacio lat/lng.
 *
 * @param progress Avance entre 0 (inicio) y 1 (final).
 *
 * Nota: no es great-circle, asi que para vuelos largos cerca de los
 * polos la curva visual no sera precisa. Suficiente para demo y para
 * vuelos intracontinentales. Se mejora cuando llegue el motor de
 * simulacion real.
 */
export const interpolatePosition = (
  from: [number, number],
  to: [number, number],
  progress: number
): [number, number] => {
  const p = Math.max(0, Math.min(1, progress));
  return [from[0] + (to[0] - from[0]) * p, from[1] + (to[1] - from[1]) * p];
};
