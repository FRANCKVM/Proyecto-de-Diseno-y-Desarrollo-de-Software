import { cn } from "@/utils/cn";

export type KpiValueVariant =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "primary";

type KpiValueSize = "lg" | "md";

interface KpiValueProps {
  value: string | number;
  variant?: KpiValueVariant;
  size?: KpiValueSize;
  className?: string;
}

const VARIANT_CLASS: Record<KpiValueVariant, string> = {
  default: "text-text-primary",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  primary: "text-primary",
};

const SIZE_CLASS: Record<KpiValueSize, string> = {
  lg: "text-kpi-large",
  md: "text-kpi-medium",
};

/**
 * Valor numerico grande de un KPI.
 * Estandar 61, seccion 4.4: KPI Bold 22-26px en color semantico.
 */
const KpiValue = ({
  value,
  variant = "default",
  size = "lg",
  className,
}: KpiValueProps) => (
  <span className={cn("block", SIZE_CLASS[size], VARIANT_CLASS[variant], className)}>
    {value}
  </span>
);

export default KpiValue;
