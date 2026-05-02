/**
 * Mocks de datos del Home.
 * Replican el mockup 01 del Figma.
 */

import type { ActividadReciente } from "@/types/activity.types";

export interface HomeKpis {
  aeropuertos: { total: number; sublabel: string };
  vuelosActivos: { total: number; sublabel: string };
  enviosEnCurso: { total: number; sublabel: string };
  cumplimiento: { porcentaje: number; sublabel: string };
}

export const HOME_KPIS_MOCK: HomeKpis = {
  aeropuertos: { total: 12, sublabel: "3 continentes" },
  vuelosActivos: { total: 28, sublabel: "6 rutas inter" },
  enviosEnCurso: { total: 156, sublabel: "4,230 maletas" },
  cumplimiento: { porcentaje: 100, sublabel: "sin retrasos" },
};

export const ACTIVIDAD_RECIENTE_MOCK: ActividadReciente[] = [
  {
    id: "act-01",
    cuando: "Hoy 09:15",
    mensaje: "Simulacion semanal completada — 100% cumplimiento",
    severidad: "exito",
  },
  {
    id: "act-02",
    cuando: "Ayer 14:30",
    mensaje: "Carga de datos actualizada — 156 envios registrados",
    severidad: "informacion",
  },
  {
    id: "act-03",
    cuando: "02/04",
    mensaje: "2 vuelos cancelados — replanificacion exitosa",
    severidad: "advertencia",
  },
  {
    id: "act-04",
    cuando: "01/04",
    mensaje: "Nuevo aeropuerto agregado: DXB (Dubai)",
    severidad: "informacion",
  },
  {
    id: "act-05",
    cuando: "31/03",
    mensaje: "Simulacion de colapso ejecutada — limite en dia 12",
    severidad: "error",
  },
];
