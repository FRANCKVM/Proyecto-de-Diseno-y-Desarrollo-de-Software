import { Outlet } from "react-router-dom";
import Sidebar from "@/components/organisms/Sidebar";

/**
 * Layout para pantallas de simulacion y operacion.
 * Sidebar colapsada 56px + columna vertical donde cada pagina
 * compone su propio TopBar + area central + LegendBar.
 *
 * Usamos h-screen (no min-h-screen) porque el mapa de Leaflet necesita
 * un contenedor con altura determinada para que `flex-1 + h-full` se
 * resuelva correctamente. Las pantallas de simulacion son single-view,
 * no scrollean.
 *
 * Esta decision (que cada pagina renderice su TopBar) se tomo porque
 * las tres variantes de TopBar son lo suficientemente distintas como
 * para no merecer un unico componente con Context. Mantiene el flujo
 * de datos explicito y evita acoplar el layout con el dominio.
 */
const SimulationLayout = () => (
  <div className="flex h-screen bg-page overflow-hidden">
    <Sidebar collapsed={true} />
    <div className="flex-1 flex flex-col min-w-0">
      <Outlet />
    </div>
  </div>
);

export default SimulationLayout;
