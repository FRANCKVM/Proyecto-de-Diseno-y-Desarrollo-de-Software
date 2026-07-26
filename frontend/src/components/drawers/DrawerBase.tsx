import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/utils/cn";

interface DrawerBaseProps {
  title: ReactNode;
  eyebrow?: string;
  children: ReactNode;
  footer?: ReactNode;
  hideHeader?: boolean;
  widthClassName?: string;
  onClose: () => void;
}

const DrawerBase = ({
  title,
  eyebrow,
  children,
  footer,
  hideHeader = false,
  widthClassName = "w-drawer",
  onClose,
}: DrawerBaseProps) => (
  <aside
    className={cn(
      "fixed right-0 top-11 h-[calc(100vh-2.75rem)] rounded-none bg-card border border-r-0 border-border shadow-drawer z-[950] flex flex-col",
      widthClassName,
      "drawer-enter drawer-enter-active"
    )}
    role="dialog"
    aria-modal="false"
    aria-label={typeof title === "string" ? title : undefined}
  >
    {!hideHeader && (
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
    )}

    <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

    {footer && (
      <footer className="border-t border-border-subtle px-5 py-3">
        {footer}
      </footer>
    )}
  </aside>
);

export default DrawerBase;
