import { cn } from "@/utils/cn";

export type StatusDotVariant =
  | "normal"
  | "elevado"
  | "critico"
  | "primary"
  | "inactive";

type StatusDotSize = "sm" | "md";

interface StatusDotProps {
  variant: StatusDotVariant;
  size?: StatusDotSize;
  className?: string;
}

const VARIANT_CLASS: Record<StatusDotVariant, string> = {
  normal: "bg-success",
  elevado: "bg-warning",
  critico: "bg-danger",
  primary: "bg-primary",
  inactive: "bg-text-tertiary",
};

const SIZE_CLASS: Record<StatusDotSize, string> = {
  sm: "w-2 h-2",
  md: "w-2.5 h-2.5",
};

/**
 * Indicador circular de estado.
 * Usado en KpiCards, items de actividad, leyendas, badges de estado.
 */
const StatusDot = ({ variant, size = "md", className }: StatusDotProps) => (
  <span
    className={cn(
      "inline-block rounded-full shrink-0",
      VARIANT_CLASS[variant],
      SIZE_CLASS[size],
      className
    )}
    aria-hidden
  />
);

export default StatusDot;
