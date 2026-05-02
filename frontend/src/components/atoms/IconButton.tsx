import { cn } from "@/utils/cn";
import type { ReactNode, ButtonHTMLAttributes } from "react";

export type IconButtonVariant = "default" | "active-primary" | "active-danger";
export type IconButtonSize = "sm" | "md";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  children: ReactNode;
}

const VARIANT_CLASS: Record<IconButtonVariant, string> = {
  default:
    "bg-card border border-border text-text-primary hover:bg-field",
  "active-primary":
    "bg-primary border border-primary text-text-inverse hover:bg-primary/90",
  "active-danger":
    "bg-danger border border-danger text-text-inverse hover:bg-danger/90",
};

const SIZE_CLASS: Record<IconButtonSize, string> = {
  sm: "h-8 px-2 text-secondary min-w-[32px]",
  md: "h-9 px-3 text-button min-w-[36px]",
};

/**
 * Boton compacto para controles de simulacion (velocidad, dia, demanda).
 *
 * Variantes:
 * - default:        boton inactivo (tono neutro).
 * - active-primary: opcion seleccionada del grupo (azul, ej: 1x).
 * - active-danger:  opcion seleccionada en escenario de colapso
 *                   (rojo, ej: x3.2 cuando hay alerta critica).
 *
 * Para el panel SimulationControlPanel siempre se usa size="sm".
 */
const IconButton = ({
  variant = "default",
  size = "sm",
  className,
  children,
  ...rest
}: IconButtonProps) => (
  <button
    type="button"
    className={cn(
      "inline-flex items-center justify-center rounded-input font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
      VARIANT_CLASS[variant],
      SIZE_CLASS[size],
      className
    )}
    {...rest}
  >
    {children}
  </button>
);

export default IconButton;
