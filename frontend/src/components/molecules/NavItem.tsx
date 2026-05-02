import { NavLink } from "react-router-dom";
import { cn } from "@/utils/cn";

interface NavItemProps {
  /** Letra que se muestra dentro del icono (H, E, S, D). */
  letra: string;
  /** Label visible cuando la sidebar esta expandida. */
  label: string;
  /** Ruta de navegacion. */
  to: string;
  /** Estado expandido/colapsado de la sidebar. */
  collapsed: boolean;
  /**
   * Funcion personalizada para determinar si el item esta activo.
   * Necesaria cuando la ruta tiene subrutas (ej: /simulacion/* deben
   * activar el mismo item).
   */
  esActivo: boolean;
}

/**
 * Item de navegacion de la sidebar.
 * Estandar 61, seccion 4.2:
 * - Item activo: barra azul lateral de 3px + fondo destacado.
 * - Icono cuadrado redondeado de 22x22px con letra blanca centrada.
 * - Label oculto cuando la sidebar esta colapsada.
 */
const NavItem = ({ letra, label, to, collapsed, esActivo }: NavItemProps) => (
  <NavLink
    to={to}
    className={cn(
      "relative flex items-center gap-3 px-3 py-2 transition-colors",
      collapsed && "justify-center",
      esActivo ? "bg-sidebar-hover" : "hover:bg-sidebar-hover"
    )}
  >
    {esActivo && (
      <span
        className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary"
        aria-hidden
      />
    )}
    <span
      className={cn(
        "w-icon-nav h-icon-nav rounded-icon-nav flex items-center justify-center text-button text-text-inverse shrink-0",
        esActivo ? "bg-primary" : "bg-sidebar-icon"
      )}
      aria-hidden
    >
      {letra}
    </span>
    {!collapsed && (
      <span
        className={cn(
          esActivo
            ? "text-nav-active text-text-inverse"
            : "text-nav text-text-tertiary"
        )}
      >
        {label}
      </span>
    )}
  </NavLink>
);

export default NavItem;
