export interface BackendAeropuerto {
  codigo: string;
  ciudad: string;
  region: string;
  pais: string;
  alias: string | null;
  desplazamientoGMT: number;
  capacidad: number;
  latitud: number | null;
  longitud: number | null;
}

export interface BackendVuelo {
  idVuelo: number;
  desde: BackendAeropuerto;
  hasta: BackendAeropuerto;
  tiempoViajarDias: number;
  capacidad: number;
  salidaUtcMin: number;
  llegadaUtcMin: number;
}

export interface BackendVueloOcurrencia {
  idOcurrencia: number;
  vuelo: BackendVuelo;
  fechaHoraSalida: string;
  fechaHoraLlegada: string;
  capacidad: number;
  capacidadUsada: number;
  estado: "PROGRAMADO" | "EN_VUELO" | "COMPLETADO" | "CANCELADO";
}

export interface BackendRuta {
  idRuta: number | null;
  ocurrencias: BackendVueloOcurrencia[];
  tiempoTotal: number;
  costo: number;
  factible: boolean;
}

export interface BackendAsignacionEnvio {
  idAsignacion: number | null;
  ruta: BackendRuta | null;
  cantidadBolsas: number;
  estado: "INGRESADO" | "PARCIAL" | "EN_PROCESO" | "COMPLETADO";
}

export interface BackendSolicitudEnvio {
  idEnvio: number | null;
  fecha: string;
  hora: string;
  idCliente: number;
  ruta: BackendRuta | null;
  idRuta?: number | null;
  idSimulacion?: number | null;
  origen: BackendAeropuerto;
  destino: BackendAeropuerto;
  contarBolsas: number;
  diasTiempoMaximo: number;
  estado: "INGRESADO" | "PARCIAL" | "EN_PROCESO" | "COMPLETADO";
  asignaciones?: BackendAsignacionEnvio[];
}

export interface BackendEstadoSimulacion {
  idSimulacion: number | null;
  activa: boolean;
  procesandoBloque: boolean;
  fechaHoraInicioReal: string | null;
  fechaHoraInicioSimulacion: string | null;
  k: number | null;
  saMinutos: number | null;
  scMinutos: number | null;
  intervaloRealMs: number | null;
  punteroConsumoMinutos: number | null;
  ultimoMinutoSimulacion: number | null;
  indiceSiguienteSolicitud: number;
  totalSolicitudesCargadas: number;
  bloquesProcesados: number;
  totalSolicitudes: number;
  resueltas: number;
  noResueltas: number;
  noResueltasPorAlmacenOrigen: number;
  noResueltasPorRutaVueloPlazo: number;
  rutasDirectas: number;
  rutasConParada: number;
  totalVuelosUsados: number;
  totalEscalas: number;
  promedioVuelos: number;
  promedioEscalas: number;
  porcentajeDirectas: number;
  porcentajeConParada: number;
  costoPromedioRutas: number;
  porcentajeResueltas: number;
  tiempoPlanificacionTotalSeg: number;
  tiempoPromedioPorSolicitudMs: number;
  fitnessGlobal: number;
}

export interface BackendMapaVuelo {
  id: string;
  code?: string | null;
  fromIcao: string;
  toIcao: string;
  progress: number;
  occupancyPct?: number | null;
  departureMinute?: number | null;
  arrivalMinute?: number | null;
  durationMinutes?: number | null;
}

export interface BackendMapaCancelacionVuelo {
  id: string;
  airportIcao: string;
  flightCode: string;
}

export interface BackendMapaSimulacionEstado {
  idSimulacion: number;
  ocupacionPorAeropuerto: Record<string, number>;
  vuelos: BackendMapaVuelo[];
  cancelacionesRecientes?: BackendMapaCancelacionVuelo[];
}

export interface BackendEstadoOperacion {
  fechaActual: string;
  enviosHoy: number;
  enTransito: number;
  entregadas: number;
  cumplimiento: number;
}

export interface CreateOperationShipmentRequest {
  origenIcao: string;
  destinoIcao: string;
  contarBolsas: number;
}
