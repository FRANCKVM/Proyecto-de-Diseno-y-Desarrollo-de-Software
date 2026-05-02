import { Outlet } from "react-router-dom";
import Sidebar from "@/components/organisms/Sidebar";

/**
 * Layout para pantallas de gestion (Home, Configuracion, Resultados).
 * Sidebar expandida 220px + area principal con scroll.
 *
 * Estandar 61, seccion 4.1: pantallas de gestion no llevan barra superior
 * fija ni leyenda inferior; el contenido vive directamente bajo el padding
 * de la pagina.
 */
const ManagementLayout = () => (
  <div className="flex min-h-screen bg-page">
    <Sidebar collapsed={false} />
    <main className="flex-1 overflow-auto">
      <Outlet />
    </main>
  </div>
);

export default ManagementLayout;
