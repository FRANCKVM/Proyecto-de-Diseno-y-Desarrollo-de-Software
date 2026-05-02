import { useEffect, useState } from "react";
import DrawerBase from "@/components/drawers/DrawerBase";
import InfoRow from "@/components/molecules/InfoRow";
import Tag from "@/components/atoms/Tag";
import { getShipmentByCode } from "@/services/shipmentService";
import { useDrawerStore } from "@/store/drawerStore";
import type { EnvioDetalle } from "@/types/shipment.types";

interface ShipmentDrawerProps {
  codigo: string;
}

/**
 * Formatea ISO 8601 a "DD/MM HH:mm".
 */
const formatFechaCorta = (iso: string): string => {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm} ${hh}:${mi}`;
};

/**
 * Drawer de detalle de envio.
 * Estandar 61 + mockup 06 del Figma.
 *
 * Muestra info del envio, ruta asignada con timeline de hitos,
 * lista de paquetes (en bloques) y tiempo restante para entrega.
 */
const ShipmentDrawer = ({ codigo }: ShipmentDrawerProps) => {
  const close = useDrawerStore((s) => s.close);

  const [shipment, setShipment] = useState<EnvioDetalle | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    getShipmentByCode(codigo)
      .then((data) => {
        if (cancelled) return;
        setShipment(data);
        setIsLoading(false);
      })
      .catch(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [codigo]);

  if (isLoading || !shipment) {
    return (
      <DrawerBase eyebrow="Envio" title={codigo} onClose={close}>
        <p className="text-body text-text-tertiary">Cargando informacion...</p>
      </DrawerBase>
    );
  }

  const estadoLabel =
    shipment.estado === "en_transito"
      ? "En transito"
      : shipment.estado === "entregado"
      ? "Entregado"
      : shipment.estado === "planificado"
      ? "Planificado"
      : shipment.estado;

  return (
    <DrawerBase eyebrow="Envio" title={shipment.codigo} onClose={close}>
      <div className="mb-5">
        <Tag variant={shipment.estado === "entregado" ? "normal" : "primary"}>
          {estadoLabel}
        </Tag>
      </div>

      {/* Informacion del envio */}
      <section className="mb-6">
        <h3 className="text-section-title mb-2">Informacion del envio</h3>
        <InfoRow label="Codigo" value={shipment.codigo} />
        <InfoRow label="Aerolinea" value={shipment.aerolinea} />
        <InfoRow label="Origen" value={shipment.origenIcao} />
        <InfoRow label="Destino" value={shipment.destinoIcao} />
        <InfoRow
          label="Tipo"
          value={
            shipment.tipo === "intercontinental"
              ? "Intercontinental"
              : "Intracontinental"
          }
        />
        <InfoRow
          label="Plazo maximo"
          value={`${shipment.plazoMaximoDias} dias`}
        />
        <InfoRow
          label="Fecha registro"
          value={formatFechaCorta(shipment.fechaRegistro)}
        />
        <InfoRow
          label="Cantidad maletas"
          value={shipment.cantidadMaletas}
        />
      </section>

      {/* Ruta asignada */}
      <section className="mb-6">
        <h3 className="text-section-title mb-3">Ruta asignada</h3>
        <div className="space-y-1">
          {shipment.ruta.map((hito, idx) => (
            <RouteStep
              key={`${hito.aeropuertoIcao}-${idx}`}
              hito={hito}
              isLast={idx === shipment.ruta.length - 1}
            />
          ))}
        </div>
      </section>

      {/* Paquetes */}
      <section className="mb-6">
        <h3 className="text-section-title mb-3">
          Paquetes ({shipment.cantidadMaletas} maletas)
        </h3>
        <ul className="space-y-2">
          {shipment.paquetes.map((bloque) => (
            <li
              key={bloque.codigoInicial}
              className="bg-field rounded-input px-3 py-2"
            >
              <p className="text-button text-text-primary">
                {bloque.codigoInicial} a {bloque.codigoFinal}
              </p>
              <p className="text-secondary text-text-secondary">
                {bloque.cantidad} maletas — {bloque.estado}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* Tiempo restante */}
      <section className="bg-field rounded-card p-4">
        <div className="flex items-center justify-between">
          <span className="text-body text-text-secondary">
            Tiempo restante para entrega:
          </span>
          <span
            className={`text-button ${
              shipment.dentroDePlazo ? "text-success" : "text-danger"
            }`}
          >
            {shipment.tiempoRestante}
          </span>
        </div>
        <p
          className={`text-secondary mt-1 ${
            shipment.dentroDePlazo ? "text-success" : "text-danger"
          }`}
        >
          {shipment.dentroDePlazo
            ? "Dentro del plazo comprometido"
            : "Fuera del plazo comprometido"}
        </p>
      </section>
    </DrawerBase>
  );
};

// ============================================================================
// SUB-COMPONENTE RouteStep
// ============================================================================

interface RouteStepProps {
  hito: EnvioDetalle["ruta"][number];
  isLast: boolean;
}

const STATUS_COLOR: Record<string, string> = {
  completado: "text-success",
  activo: "text-primary",
  pendiente: "text-text-tertiary",
};

const STATUS_LABEL: Record<string, string> = {
  completado: "Completado",
  activo: "Activo",
  pendiente: "Pendiente",
};

const DOT_COLOR_BY_STATUS: Record<string, string> = {
  completado: "bg-success",
  activo: "bg-primary",
  pendiente: "bg-text-tertiary",
};

const RouteStep = ({ hito, isLast }: RouteStepProps) => {
  const status = hito.estado as string;
  const dotClass = DOT_COLOR_BY_STATUS[status] ?? "bg-text-tertiary";
  const statusColor = STATUS_COLOR[status] ?? "text-text-tertiary";
  const statusText = STATUS_LABEL[status] ?? status;

  return (
    <div className="flex gap-3 relative pb-3">
      <div className="flex flex-col items-center pt-1">
        <div className={`w-3 h-3 rounded-full ${dotClass} relative z-10`} />
        {!isLast && <div className="w-px flex-1 bg-border mt-1" />}
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <span className="text-button text-text-primary">
            {hito.aeropuertoIcao}
          </span>
          <span className={`text-secondary ${statusColor}`}>{statusText}</span>
        </div>
        <p className="text-secondary text-text-secondary">
          {formatFechaCorta(hito.fecha)} —{" "}
          {hito.tipo === "salida"
            ? "Salida"
            : hito.tipo === "vuelo"
            ? "En vuelo"
            : hito.tipo === "escala"
            ? "Escala"
            : "Entrega"}
        </p>
        {hito.vueloCodigo && hito.tipo !== "vuelo" && (
          <p className="text-secondary text-primary">{hito.vueloCodigo}</p>
        )}
      </div>
    </div>
  );
};

export default ShipmentDrawer;
