import { create } from "zustand";

/**
 * Tipos discriminados de drawer abierto.
 * El payload mantiene la entidad clave (icao, codigo) que cada drawer
 * usa para hacer su propia llamada al servicio.
 */
export type DrawerSelection =
  | null
  | { type: "airport"; icao: string }
  | { type: "flight"; codigo: string }
  | { type: "shipment"; codigo: string };

interface DrawerState {
  selection: DrawerSelection;
  openAirport: (icao: string) => void;
  openFlight: (codigo: string) => void;
  openShipment: (codigo: string) => void;
  close: () => void;
}

/**
 * Store unico de drawer activo.
 *
 * El sistema solo permite UN drawer abierto a la vez (consistente con
 * los mockups 04, 05 y 06 que muestran un solo panel lateral).
 * Si el usuario abre uno con otro abierto, se reemplaza el contenido
 * sin animacion de cierre intermedia.
 */
export const useDrawerStore = create<DrawerState>((set) => ({
  selection: null,
  openAirport: (icao) => set({ selection: { type: "airport", icao } }),
  openFlight: (codigo) => set({ selection: { type: "flight", codigo } }),
  openShipment: (codigo) => set({ selection: { type: "shipment", codigo } }),
  close: () => set({ selection: null }),
}));
