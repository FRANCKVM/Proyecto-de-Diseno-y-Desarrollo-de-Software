import { cn } from "@/utils/cn";
import StatusDot from "@/components/atoms/StatusDot";

type LegendBarVariant = "simulacion" | "dia-a-dia" | "colapso";

interface LegendBarProps {
  variant: LegendBarVariant;
}

const Separator = () => (
  <span className="w-px h-3 bg-border" aria-hidden />
);

/**
 * Barra inferior con leyendas de colores y modo operativo.
 * Estandar 61, seccion 4.1: altura 40px, solo en pantallas de simulacion.
 *
 * Variantes:
 * - "simulacion":  leyenda completa de semaforo + rutas + maletas en transito.
 * - "dia-a-dia":   indicador de modo operacional en tiempo real.
 * - "colapso":     indicador de modo de estres con criterios de detencion.
 */
const LegendBar = ({ variant }: LegendBarProps) => {
  const baseClass =
    "h-legend bg-card border-t border-border flex items-center px-5 text-secondary shrink-0";

  if (variant === "simulacion") {
    return (
      <footer className={cn(baseClass, "gap-4")}>
        <span className="text-label-sm text-text-tertiary uppercase tracking-wide">
          Leyenda
        </span>

        <div className="flex items-center gap-1.5">
          <StatusDot variant="normal" size="sm" />
          <span className="text-secondary text-text-secondary">
            Normal (&lt;60%)
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <StatusDot variant="elevado" size="sm" />
          <span className="text-secondary text-text-secondary">
            Elevado (60-85%)
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <StatusDot variant="critico" size="sm" />
          <span className="text-secondary text-text-secondary">
            Critico (&gt;85%)
          </span>
        </div>

        <Separator />

        <div className="flex items-center gap-1.5">
          <span className="w-4 border-t border-dashed border-text-tertiary" />
          <span className="text-secondary text-text-secondary">Rutas</span>
        </div>

        <Separator />

        <div className="flex items-center gap-1.5">
          <span className="w-4 h-2 bg-primary rounded-sm" aria-hidden />
          <span className="text-secondary text-text-secondary">
            Maletas en transito
          </span>
        </div>

        <span className="ml-auto text-secondary text-text-tertiary">
          Click en aeropuerto, ruta o envio para ver detalle
        </span>
      </footer>
    );
  }

  if (variant === "dia-a-dia") {
    return (
      <footer className={baseClass}>
        <span className="text-button text-primary">
          MODO: OPERACION DIA A DIA
          <span className="text-text-tertiary font-normal mx-2">—</span>
          <span className="text-text-secondary font-normal">Tiempo real</span>
          <span className="text-text-tertiary font-normal mx-2">—</span>
          <span className="text-text-secondary font-normal">
            Se pueden registrar nuevos envios
          </span>
        </span>
      </footer>
    );
  }

  // variant === "colapso"
  return (
    <footer className={baseClass}>
      <span className="text-button text-danger">
        MODO: SIMULACION AL COLAPSO
        <span className="text-text-tertiary font-normal mx-2">—</span>
        <span className="text-text-secondary font-normal">
          Demanda incremental
        </span>
        <span className="text-text-tertiary font-normal mx-2">—</span>
        <span className="text-text-secondary font-normal">
          Se detiene al cumplir criterios
        </span>
      </span>
    </footer>
  );
};

export default LegendBar;
