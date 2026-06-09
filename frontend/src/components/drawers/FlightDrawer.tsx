import { useEffect, useState } from "react";
import DrawerBase from "@/components/drawers/DrawerBase";
import InfoRow from "@/components/molecules/InfoRow";
import Tag from "@/components/atoms/Tag";
import { getFlightByCode } from "@/services/flightService";
import { useDrawerStore } from "@/store/drawerStore";
import {
  buildShipmentRouteSegments,
  resolveShipmentFocusTarget,
} from "@/utils/shipmentFocus";
import type { BackendSolicitudEnvio } from "@/types/backendSimulation.types";
import type { VueloDetalle } from "@/types/flight.types";

interface FlightDrawerProps {
  codigo: string;
  idSimulacion?: number | null;
  shipments?: BackendSolicitudEnvio[];
  referenceMinute?: number | null;
}

const ISO_WITH_TIME_ZONE = /(?:Z|[+-]\d{2}:?\d{2})$/i;

/**
 * Formatea ISO 8601 a "DD/MM/YYYY HH:mm" en horario local.
 */
const formatFecha = (iso: string): string => {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
};

const parseFlightDateMs = (iso: string): number => {
  const normalized = ISO_WITH_TIME_ZONE.test(iso) ? iso : `${iso}Z`;
  return new Date(normalized).getTime();
};

const parseShipmentCodeId = (codigo: string): number | null => {
  const match = codigo.match(/\d+/);
  return match ? Number(match[0]) : null;
};

const formatTiempoRestante = (arrivalIso: string, nowMs: number): string => {
  const arrivalMs = parseFlightDateMs(arrivalIso);

  if (Number.isNaN(arrivalMs)) {
    return "No disponible";
  }

  const diffMinutes = Math.max(
    0,
    Math.ceil((arrivalMs - nowMs) / 60_000)
  );

  if (diffMinutes === 0) {
    return "Llegando o completado";
  }

  const days = Math.floor(diffMinutes / (24 * 60));
  const hours = Math.floor((diffMinutes % (24 * 60)) / 60);
  const minutes = diffMinutes % 60;
  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days} dia${days === 1 ? "" : "s"}`);
  }

  if (hours > 0) {
    parts.push(`${hours} h`);
  }

  if (minutes > 0 || parts.length === 0) {
    parts.push(`${minutes} min`);
  }

  return parts.join(" ");
};

const formatPercent = (value: number): string =>
  `${value.toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;

/**
 * Drawer de detalle de vuelo.
 * Estandar 61 + mockup 05 del Figma.
 *
 * Muestra info del vuelo, trayecto con timeline visual y lista de
 * envios transportados. Los envios son clickeables y abren el
 * ShipmentDrawer correspondiente.
 */
const FlightDrawer = ({
  codigo,
  idSimulacion,
  shipments = [],
  referenceMinute,
}: FlightDrawerProps) => {
  const close = useDrawerStore((s) => s.close);
  const openShipment = useDrawerStore((s) => s.openShipment);

  const [flight, setFlight] = useState<VueloDetalle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setNotFound(false);

    getFlightByCode(codigo, idSimulacion)
      .then((data) => {
        if (cancelled) return;
        setFlight(data);
        setNotFound(!data);
        setIsLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setNotFound(true);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [codigo, idSimulacion]);

  if (isLoading) {
    return (
      <DrawerBase eyebrow="Vuelo" title={codigo} onClose={close}>
        <p className="text-body text-text-tertiary">Cargando informacion...</p>
      </DrawerBase>
    );
  }

  if (notFound || !flight) {
    return (
      <DrawerBase eyebrow="Vuelo" title={codigo} onClose={close}>
        <p className="text-body text-text-tertiary">
          No se encontro informacion para este vuelo.
        </p>
      </DrawerBase>
    );
  }

  const ocupacionPct =
    flight.capacidad > 0 ? (flight.ocupacion / flight.capacidad) * 100 : 0;
  const estadoLabel =
    flight.estado === "en_vuelo"
      ? "En vuelo"
      : flight.estado === "programado"
      ? "Programado"
      : flight.estado === "completado"
      ? "Completado"
      : flight.estado === "cancelado"
      ? "Cancelado"
      : flight.estado;
  const openShipmentFromFlight = (shipmentCode: string) => {
    const shipmentId = parseShipmentCodeId(shipmentCode);
    const shipment = shipments.find(
      (candidate) => candidate.idEnvio === shipmentId
    );

    if (!shipment) {
      openShipment(shipmentCode);
      return;
    }

    openShipment(shipmentCode, {
      ...resolveShipmentFocusTarget(shipment, referenceMinute),
      shipmentRouteSegments: buildShipmentRouteSegments(shipment),
    });
  };

  return (
    <DrawerBase eyebrow="Vuelo" title={flight.codigo} onClose={close}>
      <div className="mb-5">
        <Tag variant={flight.estado === "en_vuelo" ? "primary" : "neutral"}>
          {estadoLabel}
        </Tag>
      </div>

      {/* Informacion del vuelo */}
      <section className="mb-6">
        <h3 className="text-section-title mb-2">Informacion del vuelo</h3>
        <InfoRow label="Codigo" value={flight.codigo} />
        <InfoRow label="Estado" value={estadoLabel} />
        <InfoRow
          label="Tipo"
          value={
            flight.tipo === "intercontinental"
              ? "Intercontinental"
              : "Intracontinental"
          }
        />
        <InfoRow
          label="Ocupacion"
          value={`${flight.ocupacion} / ${flight.capacidad} (${formatPercent(ocupacionPct)})`}
        />
        <InfoRow label="Fecha salida" value={formatFecha(flight.fechaSalida)} />
        <InfoRow
          label="Fecha llegada est."
          value={formatFecha(flight.fechaLlegadaEstimada)}
        />
        <InfoRow
          label="Tiempo restante"
          value={formatTiempoRestante(flight.fechaLlegadaEstimada, nowMs)}
        />
      </section>

      {/* Trayecto */}
      <section className="mb-6">
        <h3 className="text-section-title mb-3">Trayecto del vuelo</h3>
        <div className="space-y-3">
          <TimelineStep
            color="success"
            label={`Origen (${flight.origenIcao})`}
            sublabel={`${formatFecha(flight.fechaSalida)} — Salida`}
            status="Completado"
            statusColor="text-success"
          />
          <TimelineStep
            color="primary"
            label="En vuelo"
            sublabel="Posicion actual"
            status="En transito"
            statusColor="text-primary"
            isMiddle
          />
          <TimelineStep
            color="neutral"
            label={`Destino (${flight.destinoIcao})`}
            sublabel={`${formatFecha(flight.fechaLlegadaEstimada)} — Llegada est.`}
            status="Pendiente"
            statusColor="text-text-tertiary"
            isLast
          />
        </div>
      </section>

      {/* Envios transportados */}
      <section>
        <h3 className="text-section-title mb-3">
          Envios transportados
          {flight.envios.length > 0 && ` (${flight.envios.length})`}
        </h3>
        {flight.envios.length === 0 ? (
          <p className="text-body text-text-tertiary">
            Sin envios asignados todavia.
          </p>
        ) : (
          <ul className="space-y-2">
            {flight.envios.map((e) => (
              <li
                key={e.codigo}
                className="bg-field rounded-input px-3 py-2 flex items-center justify-between"
              >
                <div>
                  <button
                    type="button"
                    className="text-button text-primary hover:underline block"
                    onClick={() => openShipmentFromFlight(e.codigo)}
                  >
                    {e.codigo}
                  </button>
                  <span className="text-secondary text-text-secondary">
                    {e.origenIcao} &gt; {e.destinoIcao}
                  </span>
                </div>
                <span className="text-secondary text-text-secondary">
                  {e.maletasOcupadas} / {e.maletasTotales} mal.
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </DrawerBase>
  );
};

// ============================================================================
// SUB-COMPONENTE TimelineStep
// ============================================================================

interface TimelineStepProps {
  color: "success" | "primary" | "neutral";
  label: string;
  sublabel?: string;
  status: string;
  statusColor: string;
  isMiddle?: boolean;
  isLast?: boolean;
}

const DOT_CLASS: Record<TimelineStepProps["color"], string> = {
  success: "bg-success",
  primary: "bg-primary",
  neutral: "bg-text-tertiary",
};

const TimelineStep = ({
  color,
  label,
  sublabel,
  status,
  statusColor,
  isMiddle = false,
  isLast = false,
}: TimelineStepProps) => (
  <div className="flex gap-3 relative">
    <div className="flex flex-col items-center pt-1">
      <div
        className={`w-3 h-3 rounded-full ${DOT_CLASS[color]} relative z-10`}
      />
      {!isLast && <div className="w-px flex-1 bg-border mt-1" />}
    </div>
    <div className="flex-1 pb-4">
      <div className="flex items-center justify-between">
        <span className="text-button text-text-primary">{label}</span>
        <span className={`text-secondary ${statusColor}`}>{status}</span>
      </div>
      {sublabel && (
        <p className="text-secondary text-text-secondary">{sublabel}</p>
      )}
      {isMiddle && (
        <p className="text-secondary text-primary mt-0.5">En transito</p>
      )}
    </div>
  </div>
);

export default FlightDrawer;
