import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/utils/cn";

interface DrawerBaseProps {
  /** Titulo principal del drawer (ej: "NRT — Tokio Narita"). */
  title: ReactNode;
  /** Etiqueta corta sobre el titulo (ej: "Aeropuerto", "Vuelo", "Envio"). */
  eyebrow?: string;
  /** Contenido principal scrollable. */
  children: ReactNode;
  /**
   * Region opcional al pie del drawer, fuera del scroll.
   * Para inputs sticky como buscadores o KPIs de cierre.
   */
  footer?: ReactNode;
  onClose: () => void;
}

/**
 * Contenedor base para los drawers del sistema.
 *
 * Estandar 61, seccion 4.12 y 8:
 *   - Ancho fijo segun token w-drawer.
 *   - Posicionado fixed pegado a la derecha debajo de la botonera del mapa.
 *   - Slide-in de 200ms desde la derecha.
 *   - Sombra suave hacia la izquierda.
 *   - Header con eyebrow + titulo + boton X para cerrar.
 *
 * No maneja la condicion de visibilidad: el DrawerHost decide cuando
 * montar/desmontar este componente. El `key` que se le pase determina
 * si la animacion se reinicia entre cambios (al saltar de un drawer
 * a otro tipo).
 */
const DrawerBase = ({
  title,
  eyebrow,
  children,
  footer,
  onClose,
}: DrawerBaseProps) => (
  <aside
    className={cn(
      "fixed right-0 top-11 h-[calc(100vh-2.75rem)] w-drawer rounded-none bg-card border border-r-0 border-border shadow-drawer z-[950] flex flex-col",
      "drawer-enter drawer-enter-active"
    )}
    role="dialog"
    aria-modal="false"
  >
    {/* Header */}
    <header className="px-5 pt-5 pb-4 border-b border-border-subtle flex items-start gap-3">
      <div className="flex-1 min-w-0">
        {eyebrow && (
          <p className="text-secondary text-text-primary mb-1">{eyebrow}</p>
        )}
        <h2 className="text-drawer-title-lg text-text-primary truncate">
          {title}
        </h2>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="text-text-primary hover:text-primary transition-colors flex items-center gap-1 text-secondary"
        aria-label="Cerrar"
      >
        <X size={14} />
        Cerrar
      </button>
    </header>

    {/* Contenido scrollable */}
    <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

    {/* Footer opcional (sticky al fondo) */}
    {footer && (
      <footer className="border-t border-border-subtle px-5 py-3">
        {footer}
      </footer>
    )}
  </aside>
);

export default DrawerBase;
