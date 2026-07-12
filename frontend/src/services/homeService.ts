import type { ActividadReciente } from "@/types/activity.types";
import type { AirportWithCoords } from "@/types/airport.types";
import type {
  BackendSolicitudEnvio,
  BackendVuelo,
} from "@/types/backendSimulation.types";
import { getAssignedBags, getShipmentRouteGroups } from "@/utils/shipmentAssignments";

export interface HomeKpis {
  aeropuertos: { total: number; sublabel: string };
  vuelosActivos: { total: number; sublabel: string };
  enviosEnCurso: { total: number; sublabel: string };
  cumplimiento: { porcentaje: number; sublabel: string };
}

interface BuildHomeSnapshotParams {
  airports: AirportWithCoords[];
  envios: BackendSolicitudEnvio[];
}

const numberFormatter = new Intl.NumberFormat("es-PE");

const parseShipmentDateTime = (
  envio: BackendSolicitudEnvio
): Date | null => {
  if (!envio.fecha) {
    return null;
  }

  const horaNormalizada =
    envio.hora && envio.hora.trim() !== "" ? envio.hora : "00:00:00";
  const parsed = new Date(`${envio.fecha}T${horaNormalizada}`);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isIntercontinentalFlight = (vuelo: BackendVuelo) =>
  vuelo.desde.region.trim().toLowerCase() !==
  vuelo.hasta.region.trim().toLowerCase();

const isShipmentInCourse = (envio: BackendSolicitudEnvio) => {
  const ocurrencias = getShipmentRouteGroups(envio).flatMap(
    (group) => group.ruta?.ocurrencias ?? []
  );

  if (ocurrencias.length === 0) {
    return false;
  }

  return ocurrencias.some((ocurrencia) =>
    ocurrencia.estado === "PROGRAMADO" || ocurrencia.estado === "EN_VUELO"
  );
};

const isShipmentCompliant = (envio: BackendSolicitudEnvio) => {
  const routeGroups = getShipmentRouteGroups(envio);
  const tiempoTotal =
    routeGroups.length > 0
      ? Math.max(...routeGroups.map((group) => group.ruta?.tiempoTotal ?? 0))
      : envio.ruta?.tiempoTotal;
  const diasTiempoMaximo = envio.diasTiempoMaximo;

  if (tiempoTotal == null || diasTiempoMaximo == null) {
    return false;
  }

  return tiempoTotal <= diasTiempoMaximo;
};

const formatActivityTimestamp = (date: Date | null) => {
  if (!date) {
    return "Sin fecha";
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round(
    (today.getTime() - targetDay.getTime()) / (1000 * 60 * 60 * 24)
  );
  const hora = date.toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  if (diffDays === 0) {
    return `Hoy ${hora}`;
  }

  if (diffDays === 1) {
    return `Ayer ${hora}`;
  }

  return date.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "2-digit",
  });
};

const buildActivityMessage = (
  envio: BackendSolicitudEnvio
) => {
  const idLabel = envio.idEnvio ?? "s/n";
  const routeGroups = getShipmentRouteGroups(envio);
  const tramos = routeGroups.reduce(
    (total, group) => total + (group.ruta?.ocurrencias?.length ?? 0),
    0
  );
  const origen = envio.origen.codigo;
  const destino = envio.destino.codigo;
  const maletasAsignadas = getAssignedBags(envio);
  const maletas = numberFormatter.format(
    maletasAsignadas > 0 ? maletasAsignadas : (envio.contarBolsas ?? 0)
  );

  if (routeGroups.length === 0 || tramos === 0) {
    return `Envio ${idLabel} registrado sin ruta: ${origen} -> ${destino}.`;
  }

  if (isShipmentInCourse(envio)) {
    return `Envio ${idLabel} en curso: ${origen} -> ${destino} con ${tramos} tramo(s) y ${maletas} maletas.`;
  }

  if (tramos > 1) {
    return `Envio ${idLabel} planificado con escala: ${origen} -> ${destino}.`;
  }

  return `Envio ${idLabel} planificado directo: ${origen} -> ${destino}.`;
};

const buildActivitySeverity = (
  envio: BackendSolicitudEnvio
): ActividadReciente["severidad"] => {
  const routeGroups = getShipmentRouteGroups(envio);
  const tramos = routeGroups.reduce(
    (total, group) => total + (group.ruta?.ocurrencias?.length ?? 0),
    0
  );

  if (routeGroups.length === 0 || tramos === 0) {
    return "error";
  }

  if (isShipmentInCourse(envio)) {
    return "informacion";
  }

  if (tramos > 1) {
    return "advertencia";
  }

  return "exito";
};

export const buildHomeKpis = ({
  airports,
  envios,
}: BuildHomeSnapshotParams): HomeKpis => {
  const regiones = new Set(
    airports
      .map((airport) => airport.region?.trim())
      .filter((region): region is string => Boolean(region))
  );
  const vuelosActivosIds = new Set<number>();
  const vuelosIntercontinentalesIds = new Set<number>();
  const enviosEnCurso = envios.filter((envio) =>
    isShipmentInCourse(envio)
  );

  for (const envio of envios) {
    for (const group of getShipmentRouteGroups(envio)) {
      for (const ocurrencia of group.ruta?.ocurrencias ?? []) {
      if (ocurrencia.estado !== "EN_VUELO") {
        continue;
      }

      const vuelo = ocurrencia.vuelo;
      vuelosActivosIds.add(ocurrencia.idOcurrencia);
      if (isIntercontinentalFlight(vuelo)) {
        vuelosIntercontinentalesIds.add(ocurrencia.idOcurrencia);
      }
      }
    }
  }

  const maletasEnCurso = enviosEnCurso.reduce(
    (total, envio) => {
      const asignadas = getAssignedBags(envio);
      return total + (asignadas > 0 ? asignadas : (envio.contarBolsas ?? 0));
    },
    0
  );
  const enviosCumplen = envios.filter(isShipmentCompliant).length;
  const porcentajeCumplimiento =
    envios.length === 0
      ? 100
      : Math.round((enviosCumplen * 100) / envios.length);

  return {
    aeropuertos: {
      total: airports.length,
      sublabel: `${regiones.size} continentes`,
    },
    vuelosActivos: {
      total: vuelosActivosIds.size,
      sublabel: `${vuelosIntercontinentalesIds.size} rutas inter`,
    },
    enviosEnCurso: {
      total: enviosEnCurso.length,
      sublabel: `${numberFormatter.format(maletasEnCurso)} maletas`,
    },
    cumplimiento: {
      porcentaje: porcentajeCumplimiento,
      sublabel:
        envios.length === 0
          ? "sin envios registrados"
          : `${enviosCumplen} de ${envios.length} dentro de plazo`,
    },
  };
};

export const buildRecentActivity = (
  envios: BackendSolicitudEnvio[]
): ActividadReciente[] => {
  if (envios.length === 0) {
    return [
      {
        id: "actividad-vacia",
        cuando: "Ahora",
        mensaje: "Aun no hay solicitudes operativas registradas.",
        severidad: "informacion",
      },
    ];
  }

  return [...envios]
    .sort((a, b) => {
      const dateA = parseShipmentDateTime(a)?.getTime() ?? 0;
      const dateB = parseShipmentDateTime(b)?.getTime() ?? 0;
      return dateB - dateA;
    })
    .slice(0, 5)
    .map((envio, index) => {
      const fecha = parseShipmentDateTime(envio);

      return {
        id: `actividad-${envio.idEnvio ?? index}`,
        cuando: formatActivityTimestamp(fecha),
        mensaje: buildActivityMessage(envio),
        severidad: buildActivitySeverity(envio),
      };
    });
};
