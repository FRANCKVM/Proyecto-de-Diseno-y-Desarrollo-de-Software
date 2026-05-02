import { useEffect, useState } from "react";
import DrawerBase from "@/components/drawers/DrawerBase";
import InfoRow from "@/components/molecules/InfoRow";
import Tag from "@/components/atoms/Tag";
import { getFlightByCode } from "@/services/flightService";
import { useDrawerStore } from "@/store/drawerStore";
import type { VueloDetalle } from "@/types/flight.types";

interface FlightDrawerProps {
  codigo: string;
}

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

/**
 * Drawer de detalle de vuelo.
 * Estandar 61 + mockup 05 del Figma.
 *
 * Muestra info del vuelo, trayecto con timeline visual y lista de
 * envios transportados. Los envios son clickeables y abren el
 * ShipmentDrawer correspondiente.
 */
const FlightDrawer = ({ codigo }: FlightDrawerProps) => {
  const close = useDrawerStore((s) => s.close);
  const openShipment = useDrawerStore((s) => s.openShipment);

  const [flight, setFlight] = useState<VueloDetalle | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    getFlightByCode(codigo)
      .then((data) => {
        if (cancelled) return;
        setFlight(data);
        setIsLoading(false);
      })
      .catch(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [codigo]);

  if (isLoading || !flight) {
    return (
      <DrawerBase eyebrow="Vuelo" title={codigo} onClose={close}>
        <p className="text-body text-text-tertiary">Cargando informacion...</p>
      </DrawerBase>
    );
  }

  const ocupacionPct = Math.round((flight.ocupacion / flight.capacidad) * 100);
  const estadoLabel =
    flight.estado === "en_vuelo"
      ? "En vuelo"
      : flight.estado === "programado"
      ? "Programado"
      : flight.estado === "completado"
      ? "Completado"
      : flight.estado;

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
        <InfoRow label="Capacidad" value={`${flight.capacidad} maletas`} />
        <InfoRow
          label="Ocupacion"
          value={`${flight.ocupacion} / ${flight.capacidad} (${ocupacionPct}%)`}
        />
        <InfoRow label="Fecha salida" value={formatFecha(flight.fechaSalida)} />
        <InfoRow
          label="Fecha llegada est."
          value={formatFecha(flight.fechaLlegadaEstimada)}
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
                    onClick={() => openShipment(e.codigo)}
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
