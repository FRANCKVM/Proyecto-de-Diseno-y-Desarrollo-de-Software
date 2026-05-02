import { cn } from "@/utils/cn";
import type { ReactNode } from "react";
import type { Severidad } from "@/types/common.types";

interface AlertBannerProps {
  severity: Severidad;
  /** Titulo en negrita (ej: "ALERTA CRITICA - COLAPSO DETECTADO"). */
  titulo?: string;
  /** Mensaje descriptivo. */
  mensaje: string;
  /** Acciones opcionales a la derecha (ej: botones Detener/Continuar). */
  acciones?: ReactNode;
  className?: string;
}

const VARIANT_CLASS: Record<Severidad, string> = {
  exito: "bg-success-soft border-success text-success",
  advertencia: "bg-warning-soft border-warning text-warning",
  error: "bg-danger-soft border-danger text-danger shadow-alert-critical",
  informacion: "bg-primary-soft border-primary text-primary",
};

/**
 * Banner de mensaje del sistema con severidad.
 * Estandar 61, seccion 4.10: fondo soft + borde solido del color semantico.
 *
 * Las alertas criticas en escenario de colapso incluyen botones de accion
 * (Detener/Continuar) embebidos a la derecha del banner.
 */
const AlertBanner = ({
  severity,
  titulo,
  mensaje,
  acciones,
  className,
}: AlertBannerProps) => (
  <div
    role={severity === "error" ? "alert" : "status"}
    className={cn(
      "rounded-banner-lg border px-5 py-3 flex items-center gap-4",
      VARIANT_CLASS[severity],
      className
    )}
  >
    <span
      className="w-2 h-2 rounded-full bg-current shrink-0"
      aria-hidden
    />
    <div className="flex-1 min-w-0">
      {titulo && <p className="text-button leading-tight">{titulo}</p>}
      <p className={cn("text-body", titulo && "text-text-secondary mt-0.5")}>
        {mensaje}
      </p>
    </div>
    {acciones && <div className="flex items-center gap-2">{acciones}</div>}
  </div>
);

export default AlertBanner;
