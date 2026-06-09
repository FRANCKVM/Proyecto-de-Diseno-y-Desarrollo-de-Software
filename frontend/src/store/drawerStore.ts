import { create } from "zustand";
import type { EstadoSemaforo } from "@/types/common.types";
import type { ShipmentRouteSegment } from "@/utils/shipmentFocus";

export type ActiveFlightSemaphoreFilter = "todos" | "vacios" | EstadoSemaforo;

/**
 * Tipos discriminados de drawer abierto.
 * El payload mantiene la entidad clave (icao, codigo) que cada drawer
 * usa para hacer su propia llamada al servicio.
 */
export type DrawerSelection =
  | null
  | { type: "warehouse-list" }
  | { type: "warehouse-airport"; icao: string }
  | { type: "shipments-panel" }
  | { type: "active-flights-panel" }
  | { type: "airport"; icao: string }
  | { type: "flight"; codigo: string; idSimulacion?: number | null }
  | { type: "shipment"; codigo: string }
  | { type: "shipment-form" };

interface DrawerState {
  selection: DrawerSelection;
  focusedAirportIcao: string | null;
  focusedFlightId: string | null;
  warehouseRegionFilter: string;
  activeFlightRegionFilter: string;
  activeFlightSemaphoreFilter: ActiveFlightSemaphoreFilter;
  activeFlightOnlyId: string | null;
  shipmentRouteSegments: ShipmentRouteSegment[];
  setWarehouseRegionFilter: (region: string) => void;
  setActiveFlightRegionFilter: (region: string) => void;
  setActiveFlightSemaphoreFilter: (filter: ActiveFlightSemaphoreFilter) => void;
  openWarehouseList: () => void;
  openWarehouseAirport: (icao: string) => void;
  openShipmentsPanel: () => void;
  openActiveFlightsPanel: () => void;
  openAirport: (icao: string) => void;
  openFlight: (
    codigo: string,
    options?: { idSimulacion?: number | null; showOnlyOnMap?: boolean }
  ) => void;
  openShipment: (
    codigo: string,
    options?: {
      focusedAirportIcao?: string | null;
      focusedFlightId?: string | null;
      shipmentRouteSegments?: ShipmentRouteSegment[];
    }
  ) => void;
  openShipmentForm: () => void;
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
  focusedAirportIcao: null,
  focusedFlightId: null,
  warehouseRegionFilter: "todos",
  activeFlightRegionFilter: "todos",
  activeFlightSemaphoreFilter: "todos",
  activeFlightOnlyId: null,
  shipmentRouteSegments: [],
  setWarehouseRegionFilter: (region) => set({ warehouseRegionFilter: region }),
  setActiveFlightRegionFilter: (region) =>
    set({ activeFlightRegionFilter: region, activeFlightOnlyId: null }),
  setActiveFlightSemaphoreFilter: (filter) =>
    set({ activeFlightSemaphoreFilter: filter, activeFlightOnlyId: null }),
  openWarehouseList: () =>
    set({
      selection: { type: "warehouse-list" },
      warehouseRegionFilter: "todos",
      activeFlightRegionFilter: "todos",
      activeFlightSemaphoreFilter: "todos",
      activeFlightOnlyId: null,
      shipmentRouteSegments: [],
    }),
  openWarehouseAirport: (icao) =>
    set({
      selection: { type: "warehouse-airport", icao },
      focusedAirportIcao: icao,
      focusedFlightId: null,
      activeFlightRegionFilter: "todos",
      activeFlightSemaphoreFilter: "todos",
      activeFlightOnlyId: null,
      shipmentRouteSegments: [],
    }),
  openShipmentsPanel: () =>
    set({
      selection: { type: "shipments-panel" },
      focusedAirportIcao: null,
      focusedFlightId: null,
      warehouseRegionFilter: "todos",
      activeFlightRegionFilter: "todos",
      activeFlightSemaphoreFilter: "todos",
      activeFlightOnlyId: null,
      shipmentRouteSegments: [],
    }),
  openActiveFlightsPanel: () =>
    set({
      selection: { type: "active-flights-panel" },
      focusedAirportIcao: null,
      focusedFlightId: null,
      warehouseRegionFilter: "todos",
      activeFlightRegionFilter: "todos",
      activeFlightSemaphoreFilter: "todos",
      activeFlightOnlyId: null,
      shipmentRouteSegments: [],
    }),
  openAirport: (icao) =>
    set({
      selection: { type: "airport", icao },
      focusedAirportIcao: icao,
      focusedFlightId: null,
      warehouseRegionFilter: "todos",
      activeFlightRegionFilter: "todos",
      activeFlightSemaphoreFilter: "todos",
      activeFlightOnlyId: null,
      shipmentRouteSegments: [],
    }),
  openFlight: (codigo, options) =>
    set({
      selection: {
        type: "flight",
        codigo,
        idSimulacion: options?.idSimulacion ?? null,
      },
      focusedAirportIcao: null,
      focusedFlightId: codigo,
      warehouseRegionFilter: "todos",
      activeFlightOnlyId: options?.showOnlyOnMap ? codigo : null,
      shipmentRouteSegments: [],
    }),
  openShipment: (codigo, options) =>
    set({
      selection: { type: "shipment", codigo },
      focusedAirportIcao: options?.focusedAirportIcao ?? null,
      focusedFlightId: options?.focusedFlightId ?? null,
      activeFlightRegionFilter: "todos",
      activeFlightSemaphoreFilter: "todos",
      activeFlightOnlyId: null,
      shipmentRouteSegments: options?.shipmentRouteSegments ?? [],
    }),
  openShipmentForm: () =>
    set({
      selection: { type: "shipment-form" },
      focusedAirportIcao: null,
      focusedFlightId: null,
      warehouseRegionFilter: "todos",
      activeFlightRegionFilter: "todos",
      activeFlightSemaphoreFilter: "todos",
      activeFlightOnlyId: null,
      shipmentRouteSegments: [],
    }),
  close: () =>
    set({
      selection: null,
      focusedAirportIcao: null,
      focusedFlightId: null,
      warehouseRegionFilter: "todos",
      activeFlightRegionFilter: "todos",
      activeFlightSemaphoreFilter: "todos",
      activeFlightOnlyId: null,
      shipmentRouteSegments: [],
    }),
}));
