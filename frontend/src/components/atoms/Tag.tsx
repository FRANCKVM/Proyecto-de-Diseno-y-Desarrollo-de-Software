import { cn } from "@/utils/cn";
import type { ReactNode } from "react";

export type TagVariant =
  | "normal"
  | "elevado"
  | "critico"
  | "primary"
  | "neutral";

interface TagProps {
  variant: TagVariant;
  children: ReactNode;
  className?: string;
}

const VARIANT_CLASS: Record<TagVariant, string> = {
  normal: "bg-success-soft text-success",
  elevado: "bg-warning-soft text-warning",
  critico: "bg-danger-soft text-danger",
  primary: "bg-primary-soft text-primary",
  neutral: "bg-field text-text-secondary",
};

/**
 * Badge de estado.
 * Usado en tablas de resultados (Normal/Elevado/Critico),
 * estados de vuelo (En vuelo, Programado), etc.
 *
 * Estandar 61, seccion 4.9: fondo del color semantico al 12%,
 * texto solido. Los tokens *-soft del tema cumplen ese contraste.
 */
const Tag = ({ variant, children, className }: TagProps) => (
  <span
    className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-badge text-secondary font-medium",
      VARIANT_CLASS[variant],
      className
    )}
  >
    {children}
  </span>
);

export default Tag;
