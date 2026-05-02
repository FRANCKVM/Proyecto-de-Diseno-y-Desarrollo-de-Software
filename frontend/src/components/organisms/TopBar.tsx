import { Search, Plus, Pause, ChevronDown } from "lucide-react";
import { cn } from "@/utils/cn";
import StatusDot from "@/components/atoms/StatusDot";

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
    <span className={cn("text-button text-text-primary leading-tight mt-0.5", valueClass)}>
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

/**
 * Buscador minimalista de la topbar.
 */
const SearchInput = ({ placeholder }: { placeholder: string }) => (
  <div className="relative">
    <Search
      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary"
      size={14}
      aria-hidden
    />
    <input
      type="search"
      placeholder={placeholder}
      className="bg-card border border-border rounded-input pl-8 pr-3 py-1.5 text-body w-64 placeholder:text-text-tertiary focus:outline-none focus:border-primary"
    />
  </div>
);

// ============================================================================
// VARIANTES
// ============================================================================

interface TopBarEjecucionProps {
  variant: "ejecucion";
  fechaSimulada: string;
  dia: { actual: number; total: number };
  tiempoReal: { transcurrido: string; estimado: string };
  kpis: {
    entregas: string;
    enTransito: number;
    entregadas: number;
    cancelados: number;
  };
  onPausar?: () => void;
}

interface TopBarDiaADiaProps {
  variant: "dia-a-dia";
  fechaActual: string;
  kpis: {
    enviosHoy: number;
    enTransito: number;
    entregadas: number;
    cumplimiento: string;
  };
  onRegistrarEnvio?: () => void;
}

interface TopBarColapsoProps {
  variant: "colapso";
  diaSimulado: number;
  demanda: string;
  enviosTotales: number;
  cumplimiento: string;
  estado: string;
  onAbrirEscenarios?: () => void;
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
 * - "ejecucion":  simulacion de periodo en curso (badge verde "En ejecucion").
 * - "dia-a-dia":  operacion en tiempo real (badge azul "Tiempo real").
 * - "colapso":    simulacion de estres (badge rojo "Escenario de estres").
 */
const TopBar = (props: TopBarProps) => {
  const baseClass =
    "h-topbar bg-card border-b border-border flex items-center px-5 gap-6 shrink-0";

  switch (props.variant) {
    case "ejecucion":
      return (
        <header className={baseClass}>
          <ModoBadge variant="ejecucion" texto="En ejecucion" />
          <KpiInline label="Fecha simulada:" value={props.fechaSimulada} />
          <span className="text-button text-primary">
            Dia {props.dia.actual} de {props.dia.total}
          </span>
          <KpiInline
            label="Tiempo real:"
            value={`${props.tiempoReal.transcurrido} / ${props.tiempoReal.estimado}`}
          />
          <div className="flex items-center gap-5 ml-auto mr-4">
            <KpiInline
              label="Entregas:"
              value={props.kpis.entregas}
              valueClass="text-success"
            />
            <KpiInline label="En transito:" value={props.kpis.enTransito} />
            <KpiInline
              label="Entregadas:"
              value={props.kpis.entregadas.toLocaleString("es-PE")}
              valueClass="text-success"
            />
            <KpiInline label="Cancelados:" value={props.kpis.cancelados} />
          </div>
          <SearchInput placeholder="Buscar almacen, vuelo, envio..." />
          <button
            type="button"
            onClick={props.onPausar}
            className="w-9 h-9 rounded-input border border-border bg-card hover:bg-field flex items-center justify-center text-text-secondary"
            aria-label="Pausar simulacion"
          >
            <Pause size={16} />
          </button>
        </header>
      );

    case "dia-a-dia":
      return (
        <header className={baseClass}>
          <ModoBadge variant="dia-a-dia" texto="Tiempo real" />
          <KpiInline label="Fecha actual:" value={props.fechaActual} />
          <div className="flex items-center gap-5 ml-auto mr-4">
            <KpiInline label="Envios hoy:" value={props.kpis.enviosHoy} />
            <KpiInline
              label="En transito:"
              value={props.kpis.enTransito}
              valueClass="text-primary"
            />
            <KpiInline
              label="Entregadas:"
              value={props.kpis.entregadas}
              valueClass="text-success"
            />
            <KpiInline
              label="Cumplimiento:"
              value={props.kpis.cumplimiento}
              valueClass="text-success"
            />
          </div>
          <SearchInput placeholder="Buscar..." />
          <button
            type="button"
            onClick={props.onRegistrarEnvio}
            className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-text-inverse text-button px-3 py-2 rounded-input transition-colors"
          >
            <Plus size={14} />
            Registrar nuevo envio
          </button>
        </header>
      );

    case "colapso":
      return (
        <header className={baseClass}>
          <ModoBadge variant="colapso" texto="Escenario de estres" />
          <KpiInline label="Dia simulado:" value={props.diaSimulado} />
          <KpiInline
            label="Demanda:"
            value={props.demanda}
            valueClass="text-danger"
          />
          <KpiInline
            label="Envios totales:"
            value={props.enviosTotales.toLocaleString("es-PE")}
          />
          <KpiInline
            label="Cumplimiento:"
            value={props.cumplimiento}
            valueClass="text-warning"
          />
          <KpiInline
            label="Estado:"
            value={props.estado}
            valueClass="text-danger"
          />
          <button
            type="button"
            onClick={props.onAbrirEscenarios}
            className="ml-auto inline-flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-text-inverse text-button px-3 py-2 rounded-input transition-colors"
          >
            Escenarios
            <ChevronDown size={14} />
          </button>
        </header>
      );
  }
};

export default TopBar;
