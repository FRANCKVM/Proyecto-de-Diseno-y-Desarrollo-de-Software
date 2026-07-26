import { create } from "zustand";
import type { EstadoSemaforo } from "@/types/common.types";
import type { ShipmentRouteSegment } from "@/utils/shipmentFocus";

export type SemaphoreFilterValue = "vacios" | EstadoSemaforo;
export type ActiveFlightSemaphoreFilter = SemaphoreFilterValue[];
export type ActiveFlightStatusFilter =
  | "todos"
  | "programado"
  | "en_vuelo"
  | "completado"
  | "cancelado";
export type WarehouseSemaphoreFilter = SemaphoreFilterValue[];

const createDefaultWarehouseSemaphoreFilter = (): WarehouseSemaphoreFilter => [];
const createDefaultActiveFlightSemaphoreFilter =
  (): ActiveFlightSemaphoreFilter => [];
const DEFAULT_ACTIVE_FLIGHT_STATUS_FILTER: ActiveFlightStatusFilter = "todos";
const DEFAULT_ACTIVE_FLIGHT_AIRPORT_FILTER = "todos";
const DEFAULT_ACTIVE_FLIGHT_SEARCH_FILTER = "";

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
  | { type: "baggage-panel" }
  | { type: "active-flights-panel" }
  | { type: "airport"; icao: string }
  | { type: "flight"; codigo: string; idSimulacion?: number | null }
  | {
      type: "shipment";
      codigo: string;
      idSimulacion?: number | null;
      displayCodigo?: string;
    }
  | { type: "shipment-form" };

interface DrawerState {
  selection: DrawerSelection;
  focusedAirportIcao: string | null;
  focusedFlightId: string | null;
  warehouseRegionFilter: string;
  warehouseSemaphoreFilter: WarehouseSemaphoreFilter;
  activeFlightRegionFilter: string;
  activeFlightSemaphoreFilter: ActiveFlightSemaphoreFilter;
  activeFlightAirportFilter: string;
  activeFlightStatusFilter: ActiveFlightStatusFilter;
  activeFlightSearchFilter: string;
  activeFlightOnlyId: string | null;
  shipmentRouteSegments: ShipmentRouteSegment[];
  setWarehouseRegionFilter: (region: string) => void;
  setWarehouseSemaphoreFilter: (filter: WarehouseSemaphoreFilter) => void;
  setActiveFlightRegionFilter: (region: string) => void;
  setActiveFlightSemaphoreFilter: (filter: ActiveFlightSemaphoreFilter) => void;
  setActiveFlightAirportFilter: (airport: string) => void;
  setActiveFlightStatusFilter: (filter: ActiveFlightStatusFilter) => void;
  setActiveFlightSearchFilter: (filter: string) => void;
  focusShipmentRouteSegments: (segments: ShipmentRouteSegment[]) => void;
  focusFlightOnMap: (codigo: string) => void;
  focusWarehouseOnMap: (icao: string) => void;
  openWarehouseList: () => void;
  openWarehouseAirport: (
    icao: string,
    options?: {
      focusOnMap?: boolean;
    }
  ) => void;
  openShipmentsPanel: () => void;
  openBaggagePanel: () => void;
  openActiveFlightsPanel: () => void;
  openAirport: (icao: string) => void;
  openFlight: (
    codigo: string,
    options?: {
      idSimulacion?: number | null;
      showOnlyOnMap?: boolean;
      focusOnMap?: boolean;
    }
  ) => void;
  openShipment: (
    codigo: string,
    options?: {
      idSimulacion?: number | null;
      displayCodigo?: string;
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
  warehouseSemaphoreFilter: createDefaultWarehouseSemaphoreFilter(),
  activeFlightRegionFilter: "todos",
  activeFlightSemaphoreFilter: createDefaultActiveFlightSemaphoreFilter(),
  activeFlightAirportFilter: DEFAULT_ACTIVE_FLIGHT_AIRPORT_FILTER,
  activeFlightStatusFilter: DEFAULT_ACTIVE_FLIGHT_STATUS_FILTER,
  activeFlightSearchFilter: DEFAULT_ACTIVE_FLIGHT_SEARCH_FILTER,
  activeFlightOnlyId: null,
  shipmentRouteSegments: [],
  setWarehouseRegionFilter: (region) => set({ warehouseRegionFilter: region }),
  setWarehouseSemaphoreFilter: (filter) =>
    set({ warehouseSemaphoreFilter: filter }),
  setActiveFlightRegionFilter: (region) =>
    set({ activeFlightRegionFilter: region, activeFlightOnlyId: null }),
  setActiveFlightSemaphoreFilter: (filter) =>
    set({ activeFlightSemaphoreFilter: filter, activeFlightOnlyId: null }),
  setActiveFlightAirportFilter: (airport) =>
    set({ activeFlightAirportFilter: airport, activeFlightOnlyId: null }),
  setActiveFlightStatusFilter: (filter) =>
    set({ activeFlightStatusFilter: filter, activeFlightOnlyId: null }),
  setActiveFlightSearchFilter: (filter) =>
    set({ activeFlightSearchFilter: filter, activeFlightOnlyId: null }),
  focusShipmentRouteSegments: (segments) =>
    set({
      focusedAirportIcao: null,
      focusedFlightId: null,
      warehouseRegionFilter: "todos",
      warehouseSemaphoreFilter: createDefaultWarehouseSemaphoreFilter(),
      activeFlightRegionFilter: "todos",
      activeFlightSemaphoreFilter: createDefaultActiveFlightSemaphoreFilter(),
      activeFlightAirportFilter: DEFAULT_ACTIVE_FLIGHT_AIRPORT_FILTER,
      activeFlightStatusFilter: DEFAULT_ACTIVE_FLIGHT_STATUS_FILTER,
      activeFlightSearchFilter: DEFAULT_ACTIVE_FLIGHT_SEARCH_FILTER,
      activeFlightOnlyId: null,
      shipmentRouteSegments: segments,
    }),
  focusFlightOnMap: (codigo) =>
    set({
      focusedAirportIcao: null,
      focusedFlightId: codigo,
      activeFlightOnlyId: codigo,
      shipmentRouteSegments: [],
    }),
  focusWarehouseOnMap: (icao) =>
    set({
      focusedAirportIcao: icao,
      focusedFlightId: null,
      activeFlightOnlyId: null,
      shipmentRouteSegments: [],
    }),
  openWarehouseList: () =>
    set({
      selection: { type: "warehouse-list" },
      warehouseRegionFilter: "todos",
      warehouseSemaphoreFilter: createDefaultWarehouseSemaphoreFilter(),
      activeFlightRegionFilter: "todos",
      activeFlightSemaphoreFilter: createDefaultActiveFlightSemaphoreFilter(),
      activeFlightAirportFilter: DEFAULT_ACTIVE_FLIGHT_AIRPORT_FILTER,
      activeFlightStatusFilter: DEFAULT_ACTIVE_FLIGHT_STATUS_FILTER,
      activeFlightSearchFilter: DEFAULT_ACTIVE_FLIGHT_SEARCH_FILTER,
      activeFlightOnlyId: null,
      shipmentRouteSegments: [],
    }),
  openWarehouseAirport: (icao, options) =>
    set({
      selection: { type: "warehouse-airport", icao },
      focusedAirportIcao: options?.focusOnMap === true ? icao : null,
      focusedFlightId: null,
      warehouseSemaphoreFilter: createDefaultWarehouseSemaphoreFilter(),
      activeFlightRegionFilter: "todos",
      activeFlightSemaphoreFilter: createDefaultActiveFlightSemaphoreFilter(),
      activeFlightAirportFilter: DEFAULT_ACTIVE_FLIGHT_AIRPORT_FILTER,
      activeFlightStatusFilter: DEFAULT_ACTIVE_FLIGHT_STATUS_FILTER,
      activeFlightSearchFilter: DEFAULT_ACTIVE_FLIGHT_SEARCH_FILTER,
      activeFlightOnlyId: null,
      shipmentRouteSegments: [],
    }),
  openShipmentsPanel: () =>
    set({
      selection: { type: "shipments-panel" },
      focusedAirportIcao: null,
      focusedFlightId: null,
      warehouseRegionFilter: "todos",
      warehouseSemaphoreFilter: createDefaultWarehouseSemaphoreFilter(),
      activeFlightRegionFilter: "todos",
      activeFlightSemaphoreFilter: createDefaultActiveFlightSemaphoreFilter(),
      activeFlightAirportFilter: DEFAULT_ACTIVE_FLIGHT_AIRPORT_FILTER,
      activeFlightStatusFilter: DEFAULT_ACTIVE_FLIGHT_STATUS_FILTER,
      activeFlightSearchFilter: DEFAULT_ACTIVE_FLIGHT_SEARCH_FILTER,
      activeFlightOnlyId: null,
      shipmentRouteSegments: [],
    }),
  openBaggagePanel: () =>
    set({
      selection: { type: "baggage-panel" },
      focusedAirportIcao: null,
      focusedFlightId: null,
      warehouseRegionFilter: "todos",
      warehouseSemaphoreFilter: createDefaultWarehouseSemaphoreFilter(),
      activeFlightRegionFilter: "todos",
      activeFlightSemaphoreFilter: createDefaultActiveFlightSemaphoreFilter(),
      activeFlightAirportFilter: DEFAULT_ACTIVE_FLIGHT_AIRPORT_FILTER,
      activeFlightStatusFilter: DEFAULT_ACTIVE_FLIGHT_STATUS_FILTER,
      activeFlightSearchFilter: DEFAULT_ACTIVE_FLIGHT_SEARCH_FILTER,
      activeFlightOnlyId: null,
      shipmentRouteSegments: [],
    }),
  openActiveFlightsPanel: () =>
    set({
      selection: { type: "active-flights-panel" },
      focusedAirportIcao: null,
      focusedFlightId: null,
      warehouseRegionFilter: "todos",
      warehouseSemaphoreFilter: createDefaultWarehouseSemaphoreFilter(),
      activeFlightRegionFilter: "todos",
      activeFlightSemaphoreFilter: createDefaultActiveFlightSemaphoreFilter(),
      activeFlightAirportFilter: DEFAULT_ACTIVE_FLIGHT_AIRPORT_FILTER,
      activeFlightStatusFilter: DEFAULT_ACTIVE_FLIGHT_STATUS_FILTER,
      activeFlightSearchFilter: DEFAULT_ACTIVE_FLIGHT_SEARCH_FILTER,
      activeFlightOnlyId: null,
      shipmentRouteSegments: [],
    }),
  openAirport: (icao) =>
    set({
      selection: { type: "airport", icao },
      focusedAirportIcao: icao,
      focusedFlightId: null,
      warehouseRegionFilter: "todos",
      warehouseSemaphoreFilter: createDefaultWarehouseSemaphoreFilter(),
      activeFlightRegionFilter: "todos",
      activeFlightSemaphoreFilter: createDefaultActiveFlightSemaphoreFilter(),
      activeFlightAirportFilter: DEFAULT_ACTIVE_FLIGHT_AIRPORT_FILTER,
      activeFlightStatusFilter: DEFAULT_ACTIVE_FLIGHT_STATUS_FILTER,
      activeFlightSearchFilter: DEFAULT_ACTIVE_FLIGHT_SEARCH_FILTER,
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
      focusedFlightId: options?.focusOnMap === false ? null : codigo,
      warehouseRegionFilter: "todos",
      warehouseSemaphoreFilter: createDefaultWarehouseSemaphoreFilter(),
      activeFlightAirportFilter: DEFAULT_ACTIVE_FLIGHT_AIRPORT_FILTER,
      activeFlightStatusFilter: DEFAULT_ACTIVE_FLIGHT_STATUS_FILTER,
      activeFlightSearchFilter: DEFAULT_ACTIVE_FLIGHT_SEARCH_FILTER,
      activeFlightOnlyId: options?.showOnlyOnMap ? codigo : null,
      shipmentRouteSegments: [],
    }),
  openShipment: (codigo, options) =>
    set({
      selection: {
        type: "shipment",
        codigo,
        idSimulacion: options?.idSimulacion ?? null,
        displayCodigo: options?.displayCodigo,
      },
      focusedAirportIcao: options?.focusedAirportIcao ?? null,
      focusedFlightId: options?.focusedFlightId ?? null,
      warehouseSemaphoreFilter: createDefaultWarehouseSemaphoreFilter(),
      activeFlightRegionFilter: "todos",
      activeFlightSemaphoreFilter: createDefaultActiveFlightSemaphoreFilter(),
      activeFlightAirportFilter: DEFAULT_ACTIVE_FLIGHT_AIRPORT_FILTER,
      activeFlightStatusFilter: DEFAULT_ACTIVE_FLIGHT_STATUS_FILTER,
      activeFlightSearchFilter: DEFAULT_ACTIVE_FLIGHT_SEARCH_FILTER,
      activeFlightOnlyId: null,
      shipmentRouteSegments: options?.shipmentRouteSegments ?? [],
    }),
  openShipmentForm: () =>
    set({
      selection: { type: "shipment-form" },
      focusedAirportIcao: null,
      focusedFlightId: null,
      warehouseRegionFilter: "todos",
      warehouseSemaphoreFilter: createDefaultWarehouseSemaphoreFilter(),
      activeFlightRegionFilter: "todos",
      activeFlightSemaphoreFilter: createDefaultActiveFlightSemaphoreFilter(),
      activeFlightAirportFilter: DEFAULT_ACTIVE_FLIGHT_AIRPORT_FILTER,
      activeFlightStatusFilter: DEFAULT_ACTIVE_FLIGHT_STATUS_FILTER,
      activeFlightSearchFilter: DEFAULT_ACTIVE_FLIGHT_SEARCH_FILTER,
      activeFlightOnlyId: null,
      shipmentRouteSegments: [],
    }),
  close: () =>
    set({
      selection: null,
      focusedAirportIcao: null,
      focusedFlightId: null,
      warehouseRegionFilter: "todos",
      warehouseSemaphoreFilter: createDefaultWarehouseSemaphoreFilter(),
      activeFlightRegionFilter: "todos",
      activeFlightSemaphoreFilter: createDefaultActiveFlightSemaphoreFilter(),
      activeFlightAirportFilter: DEFAULT_ACTIVE_FLIGHT_AIRPORT_FILTER,
      activeFlightStatusFilter: DEFAULT_ACTIVE_FLIGHT_STATUS_FILTER,
      activeFlightSearchFilter: DEFAULT_ACTIVE_FLIGHT_SEARCH_FILTER,
      activeFlightOnlyId: null,
      shipmentRouteSegments: [],
    }),
}));
