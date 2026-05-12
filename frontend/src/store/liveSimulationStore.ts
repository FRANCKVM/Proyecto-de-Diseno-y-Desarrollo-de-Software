import { create } from "zustand";
import type {
  BackendEstadoSimulacion,
  BackendMapaSimulacionEstado,
  BackendSolicitudEnvio,
} from "@/types/backendSimulation.types";
import type { TipoSimulacion } from "@/types/common.types";

interface LiveSimulationState {
  idSimulacion: number | null;
  tipoSimulacion: TipoSimulacion | null;
  estado: BackendEstadoSimulacion | null;
  mapa: BackendMapaSimulacionEstado | null;
  envios: BackendSolicitudEnvio[];
  isRunning: boolean;
  setIdSimulacion: (id: number | null) => void;
  setTipoSimulacion: (tipo: TipoSimulacion | null) => void;
  setEstado: (estado: BackendEstadoSimulacion | null) => void;
  setMapa: (mapa: BackendMapaSimulacionEstado | null) => void;
  setEnvios: (envios: BackendSolicitudEnvio[]) => void;
  setIsRunning: (isRunning: boolean) => void;
  reset: () => void;
}

const INITIAL_STATE = {
  idSimulacion: null,
  tipoSimulacion: null,
  estado: null,
  mapa: null,
  envios: [] as BackendSolicitudEnvio[],
  isRunning: false,
};

export const useLiveSimulationStore = create<LiveSimulationState>((set) => ({
  ...INITIAL_STATE,
  setIdSimulacion: (idSimulacion) => set({ idSimulacion }),
  setTipoSimulacion: (tipoSimulacion) => set({ tipoSimulacion }),
  setEstado: (estado) => set({ estado }),
  setMapa: (mapa) => set({ mapa }),
  setEnvios: (envios) => set({ envios }),
  setIsRunning: (isRunning) => set({ isRunning }),
  reset: () => set(INITIAL_STATE),
}));
