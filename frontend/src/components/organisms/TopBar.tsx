import { useState, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/utils/cn";
import StatusDot from "@/components/atoms/StatusDot";
import { useDrawerStore } from "@/store/drawerStore";
import type { OccupancyMetric } from "@/utils/capacityMetrics";
import type { EstadoSemaforo } from "@/types/common.types";

// ============================================================================
// SUB-COMPONENTES INTERNOS
// ============================================================================

/**
 * KPI inline en la TopBar (label arriba, valor abajo).
 */
interface KpiInlineProps {
  label: string;
  value: string | number;
  valueClass?: string;
}

const KpiInline = ({ label, value, valueClass }: KpiInlineProps) => (
  <div className="flex flex-col">
    <span className="text-label-sm text-text-tertiary leading-tight">
      {label}
    </span>
    <span
      className={cn(
        "text-button leading-tight mt-0.5",
        valueClass ?? "text-text-primary"
      )}
    >
      {value}
    </span>
  </div>
);

/**
 * Badge de modo/escenario (con dot opcional).
 */
interface ModoBadgeProps {
  variant: "ejecucion" | "dia-a-dia" | "colapso";
  texto: string;
}

const ModoBadge = ({ variant, texto }: ModoBadgeProps) => {
  const config = {
    ejecucion: { wrap: "bg-success-soft text-success", dot: "normal" as const },
    "dia-a-dia": { wrap: "bg-primary-soft text-primary", dot: "primary" as const },
    colapso: { wrap: "bg-danger-soft text-danger", dot: "critico" as const },
  }[variant];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-banner text-button",
        config.wrap
      )}
    >
      <StatusDot variant={config.dot} size="sm" />
      {texto}
    </span>
  );
};

const CAPACITY_TEXT_CLASS: Record<EstadoSemaforo, string> = {
  normal: "text-success",
  elevado: "text-warning",
  critico: "text-danger",
};

interface TopBarToggleProps {
  expanded: boolean;
  onClick: () => void;
}

const TopBarToggle = ({ expanded, onClick }: TopBarToggleProps) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={expanded ? "Ocultar detalles" : "Mostrar detalles"}
    title={expanded ? "Ocultar detalles" : "Mostrar detalles"}
    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-input text-text-tertiary transition-colors hover:bg-field hover:text-text-primary"
  >
    {expanded ? <ChevronUp size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}
  </button>
);

interface TopBarFrameProps {
  expanded: boolean;
  onToggle: () => void;
  drawerAwareStyle?: React.CSSProperties;
  top: ReactNode;
  bottom: ReactNode;
}

const TopBarFrame = ({
  expanded,
  onToggle,
  drawerAwareStyle,
  top,
  bottom,
}: TopBarFrameProps) => {
  const hasBottom = Boolean(bottom);

  return (
    <header
      className="absolute left-0 top-0 z-[800] w-fit max-w-full overflow-hidden rounded-br-input border-b border-r border-border bg-card shadow-card transition-[padding,height] duration-200"
      style={drawerAwareStyle}
    >
      <div className="flex h-topbar items-center gap-3 px-5">
        <div className="flex min-w-0 items-center gap-5 overflow-x-auto">
          {top}
        </div>
        {hasBottom ? (
          <TopBarToggle expanded={expanded} onClick={onToggle} />
        ) : null}
      </div>
      {hasBottom ? (
        <div
          className={cn(
            "border-t border-border-subtle px-5 transition-[max-height,opacity,padding] duration-200",
            expanded ? "max-h-topbar-sm py-1.5 opacity-100" : "max-h-0 py-0 opacity-0"
          )}
          aria-hidden={!expanded}
        >
          <div className="flex min-h-8 items-center gap-3 overflow-x-auto">
            {bottom}
          </div>
        </div>
      ) : null}
    </header>
  );
};

// ============================================================================
// VARIANTES
// ============================================================================

interface TopBarEjecucionProps {
  variant: "ejecucion";
  reloj: {
    inicioSimulacion: string;
    fechaHoraActual: string;
    fechaSimulacionActual: string;
    horaActual: string;
    horaSimulacion: string;
    tiempoRealTranscurrido: string;
    tiempoSimulacionTranscurrido: string;
  };
  dia: { actual: number; total: number };
  kpis: {
    ocupacionAviones: OccupancyMetric;
    ocupacionAlmacenes: OccupancyMetric;
  };
}

interface TopBarDiaADiaProps {
  variant: "dia-a-dia";
  fechaActual: string;
  kpis: {
    enviosHoy: number;
    ocupacionAviones: OccupancyMetric;
    ocupacionAlmacenes: OccupancyMetric;
  };
}

interface TopBarColapsoProps {
  variant: "colapso";
  reloj: {
    inicioSimulacion: string;
    fechaHoraActual: string;
    fechaSimulacionActual: string;
    horaActual: string;
    horaSimulacion: string;
    tiempoRealTranscurrido: string;
    tiempoSimulacionTranscurrido: string;
  };
  diaSimulado: number;
  demanda: string;
  estado: string;
  kpis: {
    ocupacionAviones: OccupancyMetric;
    ocupacionAlmacenes: OccupancyMetric;
  };
}

export type TopBarProps =
  | TopBarEjecucionProps
  | TopBarDiaADiaProps
  | TopBarColapsoProps;

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

/**
 * Barra superior de las pantallas de simulacion y operacion.
 *
 * Tres variantes (estandar 61, secciones 4.11 y 5):
 * - "ejecucion":  simulacion de periodo en curso.
 * - "dia-a-dia":  operacion en tiempo real.
 * - "colapso":    simulacion de estres (badge rojo "Escenario de estres").
 */
const TopBar = (props: TopBarProps) => {
  const [expanded, setExpanded] = useState(true);
  const hasOpenDrawer = useDrawerStore((s) => s.selection !== null);
  const drawerAwareStyle = hasOpenDrawer
    ? { maxWidth: "calc(100% - 21.375rem)" }
    : undefined;
  const toggleExpanded = () => setExpanded((current) => !current);

  switch (props.variant) {
    case "ejecucion":
      return (
        <TopBarFrame
          expanded={expanded}
          onToggle={toggleExpanded}
          drawerAwareStyle={drawerAwareStyle}
          top={
            <>
              <KpiInline
                label="Inicio sim.:"
                value={props.reloj.inicioSimulacion}
              />
              <KpiInline
                label="Fecha/hora actual:"
                value={props.reloj.fechaHoraActual}
              />
              <KpiInline
                label="Transcurrido real:"
                value={props.reloj.tiempoRealTranscurrido}
              />
              <span className="text-button text-primary whitespace-nowrap">
                Dia {props.dia.actual} de {props.dia.total}
              </span>
            </>
          }
          bottom={
            <>
              <KpiInline
                label="Fecha sim.:"
                value={props.reloj.fechaSimulacionActual}
              />
              <KpiInline
                label="Hora simulacion:"
                value={props.reloj.horaSimulacion}
              />
              <KpiInline
                label="Transcurrido sim.:"
                value={props.reloj.tiempoSimulacionTranscurrido}
              />
              <KpiInline
                label="Ocupacion aviones:"
                value={props.kpis.ocupacionAviones.value}
                valueClass={CAPACITY_TEXT_CLASS[props.kpis.ocupacionAviones.estado]}
              />
              <KpiInline
                label="Ocupacion almacenes:"
                value={props.kpis.ocupacionAlmacenes.value}
                valueClass={CAPACITY_TEXT_CLASS[props.kpis.ocupacionAlmacenes.estado]}
              />
            </>
          }
        />
      );

    case "dia-a-dia":
      return (
        <TopBarFrame
          expanded={expanded}
          onToggle={toggleExpanded}
          drawerAwareStyle={drawerAwareStyle}
          top={
            <>
              <KpiInline
                label="Fecha/hora actual:"
                value={props.fechaActual}
              />
              <KpiInline label="Envios hoy:" value={props.kpis.enviosHoy} />
              <KpiInline
                label="Ocupacion aviones:"
                value={props.kpis.ocupacionAviones.value}
                valueClass={CAPACITY_TEXT_CLASS[props.kpis.ocupacionAviones.estado]}
              />
              <KpiInline
                label="Ocupacion almacenes:"
                value={props.kpis.ocupacionAlmacenes.value}
                valueClass={CAPACITY_TEXT_CLASS[props.kpis.ocupacionAlmacenes.estado]}
              />
            </>
          }
          bottom={null}
        />
      );

    case "colapso":
      return (
        <TopBarFrame
          expanded={expanded}
          onToggle={toggleExpanded}
          drawerAwareStyle={drawerAwareStyle}
          top={
            <>
              <ModoBadge variant="colapso" texto="Escenario de estres" />
              <KpiInline
                label="Inicio sim.:"
                value={props.reloj.inicioSimulacion}
              />
              <KpiInline
                label="Fecha/hora actual:"
                value={props.reloj.fechaHoraActual}
              />
              <KpiInline
                label="Transcurrido real:"
                value={props.reloj.tiempoRealTranscurrido}
              />
              <KpiInline label="Dia simulado:" value={props.diaSimulado} />
              <KpiInline
                label="Demanda:"
                value={props.demanda}
                valueClass="text-danger"
              />
              <KpiInline
                label="Estado:"
                value={props.estado}
                valueClass="text-danger"
              />
            </>
          }
          bottom={
            <>
              <KpiInline
                label="Fecha sim.:"
                value={props.reloj.fechaSimulacionActual}
              />
              <KpiInline
                label="Hora simulacion:"
                value={props.reloj.horaSimulacion}
              />
              <KpiInline
                label="Transcurrido sim.:"
                value={props.reloj.tiempoSimulacionTranscurrido}
              />
              <KpiInline
                label="Ocupacion aviones:"
                value={props.kpis.ocupacionAviones.value}
                valueClass={CAPACITY_TEXT_CLASS[props.kpis.ocupacionAviones.estado]}
              />
              <KpiInline
                label="Ocupacion almacenes:"
                value={props.kpis.ocupacionAlmacenes.value}
                valueClass={CAPACITY_TEXT_CLASS[props.kpis.ocupacionAlmacenes.estado]}
              />
            </>
          }
        />
      );
  }
};

export default TopBar;
