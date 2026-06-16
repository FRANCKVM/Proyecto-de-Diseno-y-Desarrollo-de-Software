import { useState, type ReactNode } from "react";
import {
  Building2,
  ChevronDown,
  ChevronUp,
  Package,
  Plane,
  Plus,
  Search,
} from "lucide-react";
import { cn } from "@/utils/cn";
import StatusDot from "@/components/atoms/StatusDot";
import { useDrawerStore } from "@/store/drawerStore";

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

const OperationDate = ({ value }: { value: string }) => {
  const [datePart, timePart] = value.split(" | ");

  return (
    <div className="flex items-center gap-2 rounded-input border border-primary/20 bg-primary-soft/60 px-3 py-1.5">
      <span className="text-label-sm text-primary leading-none">
        Fecha actual
      </span>
      <span className="h-4 w-px bg-primary/25" aria-hidden />
      <span className="text-button text-text-primary leading-none">
        {datePart}
      </span>
      {timePart ? (
        <span className="rounded-full bg-card px-2 py-0.5 text-label-sm text-primary leading-none">
          {timePart}
        </span>
      ) : null}
    </div>
  );
};

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
interface SearchInputProps {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading?: boolean;
  error?: string | null;
}

const SearchInput = ({
  placeholder,
  value,
  onChange,
  onSubmit,
  isLoading = false,
  error,
}: SearchInputProps) => (
  <form
    className="relative"
    onSubmit={(event) => {
      event.preventDefault();
      onSubmit();
    }}
  >
    <button
      type="submit"
      className="absolute left-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary transition-colors"
      aria-label="Buscar vuelo"
      disabled={isLoading}
    >
      <Search size={14} aria-hidden />
    </button>
    <input
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-invalid={Boolean(error)}
      className={cn(
        "bg-card border rounded-input pl-8 pr-3 py-1.5 text-body w-64 placeholder:text-text-tertiary focus:outline-none",
        error ? "border-danger focus:border-danger" : "border-border focus:border-primary"
      )}
    />
    {error ? (
      <p className="absolute top-full mt-1 left-0 text-secondary text-danger whitespace-nowrap">
        {error}
      </p>
    ) : null}
  </form>
);

interface TopBarActionButtonProps {
  icon?: ReactNode;
  label: string;
  onClick?: () => void;
  variant?: "primary" | "secondary";
  collapseLabel?: boolean;
}

const TopBarActionButton = ({
  icon,
  label,
  onClick,
  variant = "secondary",
  collapseLabel = false,
}: TopBarActionButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={collapseLabel ? label : undefined}
    title={collapseLabel ? label : undefined}
    className={cn(
      "inline-flex items-center gap-1.5 text-button py-2 rounded-input transition-colors",
      collapseLabel ? "px-2 xl:px-3" : "px-3",
      variant === "primary"
        ? "bg-primary hover:bg-primary/90 text-text-inverse"
        : "bg-card border border-border text-text-primary hover:bg-field"
    )}
  >
    {icon}
    <span className={collapseLabel ? "hidden xl:inline" : undefined}>
      {label}
    </span>
  </button>
);

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
}: TopBarFrameProps) => (
  <header
    className="absolute left-0 top-0 z-[800] w-fit max-w-full overflow-hidden rounded-br-input border-b border-r border-border bg-card shadow-card transition-[padding,height] duration-200"
    style={drawerAwareStyle}
  >
    <div className="flex h-topbar items-center gap-3 px-5">
      <div className="flex min-w-0 items-center gap-5 overflow-x-auto">
        {top}
      </div>
      <TopBarToggle expanded={expanded} onClick={onToggle} />
    </div>
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
  </header>
);

// ============================================================================
// VARIANTES
// ============================================================================

interface TopBarEjecucionProps {
  variant: "ejecucion";
  reloj: {
    inicioSimulacion: string;
    horaActual: string;
    horaSimulacion: string;
    tiempoRealTranscurrido: string;
    tiempoSimulacionTranscurrido: string;
  };
  dia: { actual: number; total: number };
  kpis: {
    entregas: string;
    enTransito: number;
    entregadas: number;
    cancelados: number;
  };
  onOpenWarehouses?: () => void;
  onOpenShipments?: () => void;
  onOpenActiveFlights?: () => void;
}

interface TopBarDiaADiaProps {
  variant: "dia-a-dia";
  fechaActual: string;
  buscador: {
    valor: string;
    error?: string | null;
    isLoading?: boolean;
    onChange: (value: string) => void;
    onSubmit: () => void;
  };
  kpis: {
    enviosHoy: number;
    enTransito: number;
    entregadas: number;
    cumplimiento: string;
  };
  onOpenWarehouses?: () => void;
  onOpenShipments?: () => void;
  onOpenActiveFlights?: () => void;
  onRegistrarEnvio?: () => void;
}

interface TopBarColapsoProps {
  variant: "colapso";
  reloj: {
    inicioSimulacion: string;
    horaActual: string;
    horaSimulacion: string;
    tiempoRealTranscurrido: string;
    tiempoSimulacionTranscurrido: string;
  };
  diaSimulado: number;
  demanda: string;
  enviosTotales: number;
  cumplimiento: string;
  estado: string;
  onOpenWarehouses?: () => void;
  onOpenShipments?: () => void;
  onOpenActiveFlights?: () => void;
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
  const [expanded, setExpanded] = useState(true);
  const hasOpenDrawer = useDrawerStore((s) => s.selection !== null);
  const drawerAwareStyle = hasOpenDrawer
    ? { maxWidth: "calc(100% - 24.75rem)" }
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
              <ModoBadge variant="ejecucion" texto="En ejecucion" />
              <KpiInline
                label="Inicio sim.:"
                value={props.reloj.inicioSimulacion}
              />
              <KpiInline
                label="Hora simulacion:"
                value={props.reloj.horaSimulacion}
              />
              <span className="text-button text-primary whitespace-nowrap">
                Dia {props.dia.actual} de {props.dia.total}
              </span>
              <div className="flex items-center gap-5">
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
            </>
          }
          bottom={
            <>
              <KpiInline label="Hora actual:" value={props.reloj.horaActual} />
              <KpiInline
                label="Transcurrido real:"
                value={props.reloj.tiempoRealTranscurrido}
              />
              <KpiInline
                label="Transcurrido sim.:"
                value={props.reloj.tiempoSimulacionTranscurrido}
              />
              <div className="flex items-center gap-2">
                <TopBarActionButton
                  icon={<Plane size={14} />}
                  label="En vuelo"
                  onClick={props.onOpenActiveFlights}
                  collapseLabel
                />
                <TopBarActionButton
                  icon={<Building2 size={14} />}
                  label="Almacenes"
                  onClick={props.onOpenWarehouses}
                />
                <TopBarActionButton
                  icon={<Package size={14} />}
                  label="Envios"
                  onClick={props.onOpenShipments}
                />
              </div>
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
              <ModoBadge variant="dia-a-dia" texto="Tiempo real" />
              <OperationDate value={props.fechaActual} />
              <div className="flex items-center gap-5">
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
            </>
          }
          bottom={
            <>
              <SearchInput
                placeholder="Buscar vuelo por ID..."
                value={props.buscador.valor}
                error={props.buscador.error}
                isLoading={props.buscador.isLoading}
                onChange={props.buscador.onChange}
                onSubmit={props.buscador.onSubmit}
              />
              <TopBarActionButton
                icon={<Plane size={14} />}
                label="En vuelo"
                onClick={props.onOpenActiveFlights}
                collapseLabel
              />
              <TopBarActionButton
                icon={<Building2 size={14} />}
                label="Almacenes"
                onClick={props.onOpenWarehouses}
              />
              <TopBarActionButton
                icon={<Package size={14} />}
                label="Envios"
                onClick={props.onOpenShipments}
              />
              <TopBarActionButton
                icon={<Plus size={14} />}
                label="Registrar nuevo envio"
                onClick={props.onRegistrarEnvio}
                variant="primary"
              />
            </>
          }
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
                label="Hora simulacion:"
                value={props.reloj.horaSimulacion}
              />
              <KpiInline label="Dia simulado:" value={props.diaSimulado} />
              <KpiInline
                label="Demanda:"
                value={props.demanda}
                valueClass="text-danger"
              />
              <div className="flex items-center gap-5">
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
              </div>
            </>
          }
          bottom={
            <>
              <KpiInline label="Hora actual:" value={props.reloj.horaActual} />
              <KpiInline
                label="Transcurrido real:"
                value={props.reloj.tiempoRealTranscurrido}
              />
              <KpiInline
                label="Transcurrido sim.:"
                value={props.reloj.tiempoSimulacionTranscurrido}
              />
              <div className="flex items-center gap-2">
                <TopBarActionButton
                  icon={<Plane size={14} />}
                  label="En vuelo"
                  onClick={props.onOpenActiveFlights}
                  collapseLabel
                />
                <TopBarActionButton
                  icon={<Building2 size={14} />}
                  label="Almacenes"
                  onClick={props.onOpenWarehouses}
                />
                <TopBarActionButton
                  icon={<Package size={14} />}
                  label="Envios"
                  onClick={props.onOpenShipments}
                />
              </div>
            </>
          }
        />
      );
  }
};

export default TopBar;
