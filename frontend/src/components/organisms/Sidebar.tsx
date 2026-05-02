import { useLocation } from "react-router-dom";
import { cn } from "@/utils/cn";
import { ROUTES } from "@/utils/routes";
import { useUserStore } from "@/store/userStore";
import NavItem from "@/components/molecules/NavItem";
import AvatarInitials from "@/components/atoms/AvatarInitials";

interface SidebarProps {
  collapsed: boolean;
}

/**
 * Configuracion de un item del menu principal de la sidebar.
 * El predicado esActivoFn permite manejar subrutas
 * (ej: /simulacion/* debe activar el item "Simulacion").
 */
interface NavConfig {
  letra: string;
  label: string;
  to: string;
  esActivoFn: (pathname: string) => boolean;
}

const NAV_ITEMS: NavConfig[] = [
  {
    letra: "H",
    label: "Inicio",
    to: ROUTES.HOME,
    esActivoFn: (p) => p === ROUTES.HOME,
  },
  {
    letra: "E",
    label: "Envios",
    to: ROUTES.ENVIOS_OPERACION,
    esActivoFn: (p) => p.startsWith("/envios"),
  },
  {
    letra: "S",
    label: "Simulacion",
    to: ROUTES.SIMULACION_CONFIGURAR,
    esActivoFn: (p) => p.startsWith("/simulacion"),
  },
  {
    letra: "D",
    label: "Dashboard",
    to: ROUTES.DASHBOARD,
    esActivoFn: (p) => p.startsWith("/dashboard"),
  },
];

/**
 * Sidebar de navegacion persistente del sistema Tasf.B2B.
 *
 * Estandar 61, secciones 4.1 y 4.2:
 * - Expandida (220px): se muestra en pantallas de gestion (Home, Config, Resultados).
 * - Colapsada (56px):  se muestra en pantallas de simulacion (mapa protagonista).
 * - Item activo: barra azul lateral 3px + fondo destacado.
 * - Zona inferior: avatar circular con iniciales, nombre y rol.
 */
const Sidebar = ({ collapsed }: SidebarProps) => {
  const { pathname } = useLocation();
  const { nombre, rol } = useUserStore();

  return (
    <aside
      className={cn(
        "flex flex-col bg-sidebar text-text-inverse shrink-0 transition-[width]",
        collapsed ? "w-sidebar-collapsed" : "w-sidebar-expanded"
      )}
    >
      {/* Logo / branding */}
      {collapsed ? (
        <div className="px-3 pt-6 pb-4 text-center">
          <span className="text-button text-text-inverse">TB</span>
        </div>
      ) : (
        <div className="px-5 pt-6 pb-4 border-b border-sidebar-hover">
          <h1 className="text-drawer-title text-text-inverse leading-tight">
            Tasf.B2B
          </h1>
          <p className="text-secondary-xs text-text-tertiary mt-0.5">
            Logistics Platform
          </p>
        </div>
      )}

      {/* Navegacion principal */}
      <nav className="flex-1 py-4 flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.to}
            letra={item.letra}
            label={item.label}
            to={item.to}
            collapsed={collapsed}
            esActivo={item.esActivoFn(pathname)}
          />
        ))}
      </nav>

      {/* Acciones secundarias (solo expandido) */}
      {!collapsed && (
        <div className="px-3 py-3 border-t border-sidebar-hover space-y-1">
          <button
            type="button"
            className="block w-full text-left text-nav text-text-tertiary hover:text-text-inverse px-2 py-1 rounded transition-colors"
          >
            Configuracion
          </button>
          <button
            type="button"
            className="block w-full text-left text-nav text-text-tertiary hover:text-text-inverse px-2 py-1 rounded transition-colors"
          >
            Cerrar sesion
          </button>
        </div>
      )}

      {/* Zona de usuario */}
      <div
        className={cn(
          "p-3 border-t border-sidebar-hover flex items-center gap-3",
          collapsed && "justify-center"
        )}
      >
        <AvatarInitials nombre={nombre} size="sm" />
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-nav-active text-text-inverse truncate">
              {nombre}
            </p>
            <p className="text-secondary-xs text-text-tertiary truncate">
              {rol}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
