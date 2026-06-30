import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

interface InfoRowProps {
  label: string;
  value: ReactNode;
  /** Si el value debe pintarse con color semantico. */
  valueClass?: string;
}

/**
 * Fila clave-valor para drawers.
 * Estandar 61, seccion 4.12: label secundario a la izquierda,
 * valor principal a la derecha.
 */
const InfoRow = ({ label, value, valueClass }: InfoRowProps) => (
  <div className="flex items-center justify-between py-1.5 text-body">
    <span className="text-text-primary">{label}</span>
    <span className={cn("font-medium", valueClass ?? "text-text-primary")}>
      {value}
    </span>
  </div>
);

export default InfoRow;
