/**
 * Datos mock de aeropuertos del sistema Tasf.B2B.
 *
 * Sustituyen las llamadas al backend mientras este no este disponible.
 * Cuando se active el endpoint real (VITE_USE_MOCK=false), los servicios
 * dejan de leer de aqui y consumen la API directamente.
 *
 * Las coordenadas se mantienen en formato DMS por fidelidad al schema
 * del backend; se convierten a decimal en tiempo de consumo via
 * `parseAirportCoords` de geoUtils.ts.
 */

export interface Airport {
  /** Identificador interno del aeropuerto. */
  id: string;
  /** Codigo ICAO (4 letras). */
  icao: string;
  /** Nombre de la ciudad. */
  name: string;
  /** Pais. */
  country: string;
  /** Codigo corto de ciudad usado por el sistema (4 letras). */
  cityCode: string;
  /** Offset GMT (sin minutos fraccionarios). */
  gmt: number;
  /** Capacidad maxima del almacen, en numero de maletas. */
  capacity: number;
  /** Latitud en formato DMS (ej: "04° 42' 05\" N"). */
  latDMS: string;
  /** Longitud en formato DMS (ej: "74° 08' 49\" W"). */
  lngDMS: string;
}

export const AIRPORTS_MOCK: Airport[] = [
  { id: "01", icao: "SKBO", name: "Bogota", country: "Colombia", cityCode: "bogo", gmt: -5, capacity: 430, latDMS: "04° 42' 05\" N", lngDMS: "74° 08' 49\" W" },
  { id: "02", icao: "SEQM", name: "Quito", country: "Ecuador", cityCode: "quit", gmt: -5, capacity: 410, latDMS: "00° 06' 48\" N", lngDMS: "78° 21' 31\" W" },
  { id: "03", icao: "SVMI", name: "Caracas", country: "Venezuela", cityCode: "cara", gmt: -4, capacity: 400, latDMS: "10° 36' 11\" N", lngDMS: "66° 59' 26\" W" },
  { id: "04", icao: "SBBR", name: "Brasilia", country: "Brasil", cityCode: "bras", gmt: -3, capacity: 480, latDMS: "15° 51' 53\" S", lngDMS: "47° 55' 05\" W" },
  { id: "05", icao: "SPIM", name: "Lima", country: "Perú", cityCode: "lima", gmt: -5, capacity: 440, latDMS: "12° 01' 19\" S", lngDMS: "77° 06' 52\" W" },
  { id: "06", icao: "SLLP", name: "La Paz", country: "Bolivia", cityCode: "lapa", gmt: -4, capacity: 420, latDMS: "16° 30' 47\" S", lngDMS: "68° 11' 32\" W" },
  { id: "07", icao: "SCEL", name: "Santiago", country: "Chile", cityCode: "sant", gmt: -3, capacity: 460, latDMS: "33° 23' 47\" S", lngDMS: "70° 47' 41\" W" },
  { id: "08", icao: "SABE", name: "Buenos Aires", country: "Argentina", cityCode: "buen", gmt: -3, capacity: 460, latDMS: "34° 33' 33\" S", lngDMS: "58° 24' 56\" W" },
  { id: "09", icao: "SGAS", name: "Asunción", country: "Paraguay", cityCode: "asun", gmt: -4, capacity: 400, latDMS: "25° 14' 24\" S", lngDMS: "57° 31' 12\" W" },
  { id: "10", icao: "SUAA", name: "Montevideo", country: "Uruguay", cityCode: "mont", gmt: -3, capacity: 400, latDMS: "34° 47' 21\" S", lngDMS: "56° 15' 53\" W" },
  { id: "11", icao: "LATI", name: "Tirana", country: "Albania", cityCode: "tira", gmt: 2, capacity: 410, latDMS: "41° 24' 53\" N", lngDMS: "19° 43' 14\" E" },
  { id: "12", icao: "EDDI", name: "Berlin", country: "Alemania", cityCode: "berl", gmt: 2, capacity: 480, latDMS: "52° 28' 25\" N", lngDMS: "13° 24' 06\" E" },
  { id: "13", icao: "LOWW", name: "Viena", country: "Austria", cityCode: "vien", gmt: 2, capacity: 430, latDMS: "48° 06' 39\" N", lngDMS: "16° 34' 15\" E" },
  { id: "14", icao: "EBCI", name: "Bruselas", country: "Belgica", cityCode: "brus", gmt: 2, capacity: 440, latDMS: "50° 27' 33\" N", lngDMS: "04° 27' 13\" E" },
  { id: "15", icao: "UMMS", name: "Minsk", country: "Bielorrusia", cityCode: "mins", gmt: 3, capacity: 400, latDMS: "53° 52' 57\" N", lngDMS: "28° 01' 57\" E" },
  { id: "16", icao: "LBSF", name: "Sofia", country: "Bulgaria", cityCode: "sofi", gmt: 3, capacity: 400, latDMS: "42° 41' 25\" N", lngDMS: "23° 24' 17\" E" },
  { id: "17", icao: "LKPR", name: "Praga", country: "Checa", cityCode: "prag", gmt: 2, capacity: 400, latDMS: "50° 06' 05\" N", lngDMS: "14° 15' 56\" E" },
  { id: "18", icao: "LDZA", name: "Zagreb", country: "Croacia", cityCode: "zagr", gmt: 2, capacity: 420, latDMS: "45° 44' 34\" N", lngDMS: "16° 04' 07\" E" },
  { id: "19", icao: "EKCH", name: "Copenhague", country: "Dinamarca", cityCode: "cope", gmt: 2, capacity: 480, latDMS: "55° 37' 05\" N", lngDMS: "12° 39' 22\" E" },
  { id: "20", icao: "EHAM", name: "Amsterdam", country: "Holanda", cityCode: "amst", gmt: 2, capacity: 480, latDMS: "52° 18' 00\" N", lngDMS: "04° 45' 54\" E" },
  { id: "21", icao: "VIDP", name: "Delhi", country: "India", cityCode: "delh", gmt: 5, capacity: 480, latDMS: "28° 33' 59\" N", lngDMS: "77° 06' 11\" E" },
  { id: "22", icao: "OSDI", name: "Damasco", country: "Siria", cityCode: "dama", gmt: 3, capacity: 400, latDMS: "33° 24' 41\" N", lngDMS: "36° 30' 56\" E" },
  { id: "23", icao: "OERK", name: "Riad", country: "Arabia Saudita", cityCode: "riad", gmt: 3, capacity: 420, latDMS: "24° 57' 28\" N", lngDMS: "46° 41' 56\" E" },
  { id: "24", icao: "OMDB", name: "Dubai", country: "Emiratos A.U", cityCode: "emir", gmt: 4, capacity: 420, latDMS: "25° 15' 10\" N", lngDMS: "55° 21' 52\" E" },
  { id: "25", icao: "OAKB", name: "Kabul", country: "Afganistan", cityCode: "kabu", gmt: 4, capacity: 480, latDMS: "34° 33' 56\" N", lngDMS: "69° 12' 39\" E" },
  { id: "26", icao: "OOMS", name: "Mascate", country: "Oman", cityCode: "masc", gmt: 4, capacity: 460, latDMS: "23° 35' 22\" N", lngDMS: "58° 17' 03\" E" },
  { id: "27", icao: "OYSN", name: "Sana", country: "Yemen", cityCode: "sana", gmt: 3, capacity: 420, latDMS: "15° 28' 34\" N", lngDMS: "44° 13' 11\" E" },
  { id: "28", icao: "OPKC", name: "Karachi", country: "Pakistan", cityCode: "kara", gmt: 5, capacity: 410, latDMS: "24° 54' 00\" N", lngDMS: "67° 09' 00\" E" },
  { id: "29", icao: "UBBB", name: "Baku", country: "Azerbaiyan", cityCode: "baku", gmt: 2, capacity: 400, latDMS: "40° 28' 02\" N", lngDMS: "50° 02' 48\" E" },
  { id: "30", icao: "OJAI", name: "Aman", country: "Jordania", cityCode: "aman", gmt: 3, capacity: 400, latDMS: "31° 43' 21\" N", lngDMS: "35° 59' 36\" E" },
];
