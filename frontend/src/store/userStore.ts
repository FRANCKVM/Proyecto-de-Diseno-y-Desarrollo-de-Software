import { create } from "zustand";

/**
 * Estado del usuario logueado.
 * Por ahora con datos mock (Luis Iman, Operador) hasta que se integre auth real.
 */
interface UserState {
  nombre: string;
  rol: string;
  setUsuario: (nombre: string, rol: string) => void;
}

export const useUserStore = create<UserState>((set) => ({
  nombre: "Luis Iman",
  rol: "Operador",
  setUsuario: (nombre, rol) => set({ nombre, rol }),
}));
