/**
 * Mocks de resultados de simulacion.
 * Replican los datos de los mockups 07 y 10 del Figma.
 */

import type {
  ResultadoPeriodo,
  ResultadoColapso,
} from "@/types/simulationResult.types";

export const RESULTADO_PERIODO_MOCK: ResultadoPeriodo = {
  id: "demo-periodo",
  tipo: "semanal",
  rango: "Semanal 07-13/04/2026",
  totalMaletas: 4230,
  cumplimiento: 100,
  vuelosEjecutados: 124,
  cancelaciones: 2,
  replanificaciones: 2,
  desempenoPorAeropuerto: [
    { icao: "SPIM", nombre: "Lima", recibidas: 420, enviadas: 445, ocupacionPromedio: 42, ocupacionMaxima: 58, estado: "normal" },
    { icao: "SKBO", nombre: "Bogota", recibidas: 310, enviadas: 305, ocupacionPromedio: 35, ocupacionMaxima: 52, estado: "normal" },
    { icao: "SBBR", nombre: "Sao Paulo", recibidas: 380, enviadas: 340, ocupacionPromedio: 62, ocupacionMaxima: 78, estado: "elevado" },
    { icao: "EDDI", nombre: "Madrid", recibidas: 650, enviadas: 640, ocupacionPromedio: 50, ocupacionMaxima: 65, estado: "elevado" },
    { icao: "EHAM", nombre: "Frankfurt", recibidas: 520, enviadas: 530, ocupacionPromedio: 38, ocupacionMaxima: 50, estado: "normal" },
    { icao: "VIDP", nombre: "Tokio", recibidas: 480, enviadas: 450, ocupacionPromedio: 70, ocupacionMaxima: 89, estado: "critico" },
    { icao: "OPKC", nombre: "Shanghai", recibidas: 350, enviadas: 340, ocupacionPromedio: 60, ocupacionMaxima: 76, estado: "elevado" },
    { icao: "OMDB", nombre: "Dubai", recibidas: 280, enviadas: 290, ocupacionPromedio: 45, ocupacionMaxima: 58, estado: "normal" },
    { icao: "OAKB", nombre: "Singapur", recibidas: 200, enviadas: 210, ocupacionPromedio: 30, ocupacionMaxima: 40, estado: "normal" },
  ],
  resumen: {
    maletasIntra: 2850,
    maletasInter: 1380,
    tiempoPromedioIntra: 0.4,
    tiempoPromedioInter: 0.9,
    aeropuertosEnRojo: 1,
    icaosEnRojo: ["VIDP"],
    duracionMinutos: 67,
  },
  conclusion:
    "Simulacion de 7 dias completada con 100% de cumplimiento. Se ejecutaron 2 replanificaciones por cancelacion de vuelos. El aeropuerto VIDP alcanzo ocupacion critica (89%) durante el dia 5. Se recomienda evaluar redistribucion de rutas Asia.",
  atencion:
    "VIDP alcanzo 89% de ocupacion maxima el dia 5. Evaluar capacidad de almacenes en Asia para proximas simulaciones.",
};

export const RESULTADO_COLAPSO_MOCK: ResultadoColapso = {
  id: "demo-colapso",
  rango: "Colapso 07-19/04/2026",
  diasHastaColapso: 12,
  maletasProcesadas: 12450,
  plazosIncumplidos: 12,
  almacenesSaturados: { cantidad: 8, porcentaje: 27 },
  factorDemandaMax: 3.2,
  analisis: [
    "La simulacion incremento progresivamente la demanda de envios desde el dia 1. Los primeros signos de saturacion aparecieron en el dia 8, cuando EDDI (Berlin) y EHAM (Amsterdam) alcanzaron ocupacion critica.",
    "El colapso se detecto en el dia 12 al superar el 10% de plazos incumplidos. Los aeropuertos europeos, que actuan como hub entre America del Sur y Asia, fueron los mas afectados.",
    "Se recomienda:",
    "- Evaluar rutas alternativas que no pasen por Europa",
    "- Incrementar capacidad de almacenamiento en EDDI y EHAM",
    "- Considerar vuelos directos America-Asia para reducir carga en hubs europeos",
  ],
  aeropuertosCriticos: [
    { icao: "EDDI", nombre: "Berlin", ocupacionMaxima: 98 },
    { icao: "EHAM", nombre: "Amsterdam", ocupacionMaxima: 95 },
    { icao: "LOWW", nombre: "Viena", ocupacionMaxima: 92 },
    { icao: "EKCH", nombre: "Copenhague", ocupacionMaxima: 91 },
    { icao: "EBCI", nombre: "Bruselas", ocupacionMaxima: 88 },
    { icao: "VIDP", nombre: "Delhi", ocupacionMaxima: 87 },
    { icao: "OMDB", nombre: "Dubai", ocupacionMaxima: 86 },
    { icao: "OAKB", nombre: "Kabul", ocupacionMaxima: 85 },
    { icao: "SKBO", nombre: "Bogota", ocupacionMaxima: 85 },
  ],
  sugerencia:
    "Los hubs europeos son el cuello de botella. Evaluar redistribucion de rutas intercontinentales.",
};
