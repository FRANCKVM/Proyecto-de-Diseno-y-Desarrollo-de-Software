/**
 * Mocks detallados de envios para el ShipmentDrawer.
 * Un envio con timeline completo, suficiente para validar el render
 * del drawer. Backend lo reemplaza sin tocar UI.
 */

import type { EnvioDetalle } from "@/types/shipment.types";

export const ENVIOS_DETALLE_MOCK: EnvioDetalle[] = [
  {
    codigo: "ENV-042",
    estado: "en_transito",
    aerolinea: "LATAM Airlines",
    origenIcao: "EDDI",
    destinoIcao: "VIDP",
    tipo: "intercontinental",
    plazoMaximoDias: 2,
    fechaRegistro: "2026-04-07T08:15:00Z",
    cantidadMaletas: 45,
    ruta: [
      {
        tipo: "salida",
        aeropuertoIcao: "EDDI",
        fecha: "2026-04-07T10:00:00Z",
        vueloCodigo: "TB-301",
        estado: "completado",
      },
      {
        tipo: "vuelo",
        aeropuertoIcao: "TB-301",
        fecha: "2026-04-07T10:00:00Z",
        vueloCodigo: "TB-301",
        estado: "activo",
      },
      {
        tipo: "escala",
        aeropuertoIcao: "VIDP",
        fecha: "2026-04-08T10:00:00Z",
        estado: "pendiente",
      },
      {
        tipo: "entrega",
        aeropuertoIcao: "VIDP",
        fecha: "2026-04-08T12:00:00Z",
        estado: "pendiente",
      },
    ],
    paquetes: [
      {
        codigoInicial: "PKG-042-001",
        codigoFinal: "PKG-042-020",
        cantidad: 20,
        estado: "En vuelo TB-301",
      },
      {
        codigoInicial: "PKG-042-021",
        codigoFinal: "PKG-042-035",
        cantidad: 15,
        estado: "En vuelo TB-301",
      },
      {
        codigoInicial: "PKG-042-036",
        codigoFinal: "PKG-042-045",
        cantidad: 10,
        estado: "En vuelo TB-301",
      },
    ],
    tiempoRestante: "1 dia 6 horas",
    dentroDePlazo: true,
  },
];
