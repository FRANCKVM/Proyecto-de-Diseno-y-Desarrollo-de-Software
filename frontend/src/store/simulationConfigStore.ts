import { create } from "zustand";
import type { TipoSimulacion, RangoSemaforo } from "@/types/common.types";

/**
 * Datos del CSV parseado que se muestran en "Resumen de datos cargados".
 * El backend eventualmente devuelve este shape al subir el archivo.
 */
export interface CsvSummary {
  fileName: string;
  totalRecords: number;
  aeropuertos: number;
  vuelosProgramados: number;
  envios: number;
  maletasTotales: number;
}

/**
 * Estado completo del formulario de configuracion de simulacion.
 */
interface SimulationConfigState {
  /** Tipo de simulacion seleccionado. */
  tipoPeriodo: TipoSimulacion;
  /** Fecha de inicio en formato YYYY-MM-DD. */
  fechaInicio: string;
  /** Hora de inicio en formato HH:mm. */
  horaInicio: string;
  /** Umbrales del semaforo configurados por el operador. */
  rangos: RangoSemaforo;
  /** Resumen del CSV cargado; null si no se ha cargado nada. */
  csvSummary: CsvSummary | null;

  // Setters
  setTipoPeriodo: (tipo: TipoSimulacion) => void;
  setFechaInicio: (fecha: string) => void;
  setHoraInicio: (hora: string) => void;
  setRangos: (rangos: Partial<RangoSemaforo>) => void;
  setCsvSummary: (summary: CsvSummary | null) => void;
  reset: () => void;
}

const INITIAL_STATE: Pick<
  SimulationConfigState,
  "tipoPeriodo" | "fechaInicio" | "horaInicio" | "rangos" | "csvSummary"
> = {
  tipoPeriodo: "semanal",
  fechaInicio: "2026-04-07",
  horaInicio: "06:00",
  rangos: { verde: 60, ambar: 85 },
  csvSummary: null,
};

export const useSimulationConfigStore = create<SimulationConfigState>(
  (set) => ({
    ...INITIAL_STATE,
    setTipoPeriodo: (tipoPeriodo) => set({ tipoPeriodo }),
    setFechaInicio: (fechaInicio) => set({ fechaInicio }),
    setHoraInicio: (horaInicio) => set({ horaInicio }),
    setRangos: (partial) =>
      set((s) => ({ rangos: { ...s.rangos, ...partial } })),
    setCsvSummary: (csvSummary) => set({ csvSummary }),
    reset: () => set(INITIAL_STATE),
  })
);
