/**
 * Mocks detallados de vuelos para el FlightDrawer.
 *
 * Tres vuelos representativos, suficientes para validar el render
 * del drawer en distintos estados (en_vuelo, programado).
 * El backend reemplaza este dataset con datos reales sin tocar UI.
 */

import type { VueloDetalle } from "@/types/flight.types";

export const VUELOS_DETALLE_MOCK: VueloDetalle[] = [
  {
    codigo: "TB-301",
    estado: "en_vuelo",
    tipo: "intercontinental",
    capacidad: 400,
    ocupacion: 350,
    origenIcao: "EDDI",
    destinoIcao: "VIDP",
    fechaSalida: "2026-04-09T10:00:00Z",
    fechaLlegadaEstimada: "2026-04-10T10:00:00Z",
    envios: [
      {
        codigo: "ENV-042",
        origenIcao: "EDDI",
        destinoIcao: "VIDP",
        maletasOcupadas: 45,
        maletasTotales: 300,
      },
      {
        codigo: "ENV-051",
        origenIcao: "SPIM",
        destinoIcao: "VIDP",
        maletasOcupadas: 80,
        maletasTotales: 500,
      },
      {
        codigo: "ENV-063",
        origenIcao: "SBBR",
        destinoIcao: "OMDB",
        maletasOcupadas: 120,
        maletasTotales: 200,
      },
      {
        codigo: "ENV-078",
        origenIcao: "SKBO",
        destinoIcao: "OPKC",
        maletasOcupadas: 55,
        maletasTotales: 360,
      },
    ],
  },
  {
    codigo: "TB-501",
    estado: "programado",
    tipo: "intercontinental",
    capacidad: 400,
    ocupacion: 0,
    origenIcao: "VIDP",
    destinoIcao: "OPKC",
    fechaSalida: "2026-04-09T18:00:00Z",
    fechaLlegadaEstimada: "2026-04-09T22:00:00Z",
    envios: [],
  },
  {
    codigo: "TB-502",
    estado: "programado",
    tipo: "intercontinental",
    capacidad: 400,
    ocupacion: 0,
    origenIcao: "VIDP",
    destinoIcao: "OAKB",
    fechaSalida: "2026-04-09T20:00:00Z",
    fechaLlegadaEstimada: "2026-04-10T00:30:00Z",
    envios: [],
  },
];
