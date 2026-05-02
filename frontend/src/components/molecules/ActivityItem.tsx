import StatusDot, { type StatusDotVariant } from "@/components/atoms/StatusDot";
import type { Severidad } from "@/types/common.types";

interface ActivityItemProps {
  cuando: string;
  mensaje: string;
  severidad: Severidad;
}

/**
 * Mapea la severidad del evento al color del dot indicador.
 */
const SEVERIDAD_TO_DOT: Record<Severidad, StatusDotVariant> = {
  exito: "normal",
  informacion: "primary",
  advertencia: "elevado",
  error: "critico",
};

/**
 * Item del feed de actividad reciente del Home.
 *
 * Estandar 61 + mockup 01:
 *   - Dot de severidad a la izquierda.
 *   - Marca temporal en gris secundario.
 *   - Mensaje en texto principal.
 */
const ActivityItem = ({ cuando, mensaje, severidad }: ActivityItemProps) => (
  <div className="flex gap-3 py-2.5">
    <StatusDot variant={SEVERIDAD_TO_DOT[severidad]} size="md" className="mt-1.5" />
    <div className="flex-1 min-w-0">
      <p className="text-secondary text-text-secondary">{cuando}</p>
      <p className="text-body text-text-primary">{mensaje}</p>
    </div>
  </div>
);

export default ActivityItem;
