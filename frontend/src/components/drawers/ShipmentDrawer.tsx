import { useEffect, useMemo, useState } from "react";
import DrawerBase from "@/components/drawers/DrawerBase";
import InfoRow from "@/components/molecules/InfoRow";
import Tag from "@/components/atoms/Tag";
import { getShipmentByCode } from "@/services/shipmentService";
import { useDrawerStore } from "@/store/drawerStore";
import type { ShipmentRouteSegment } from "@/utils/shipmentFocus";
import type { BloquePaquetes, EnvioDetalle } from "@/types/shipment.types";

interface ShipmentDrawerProps {
  codigo: string;
  idSimulacion?: number | null;
}

const PANEL_REFRESH_MS_SIMULATION = 1500;
const PANEL_REFRESH_MS_OPERATION = 5000;

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

const getPackageStatusVariant = (
  estado: string
): "normal" | "elevado" | "critico" | "neutral" => {
  const normalized = estado.toLowerCase();

  if (normalized.includes("pendiente")) {
    return "elevado";
  }

  if (normalized.includes("atras") || normalized.includes("fuera")) {
    return "critico";
  }

  if (
    normalized.includes("entregado") ||
    normalized.includes("completado") ||
    normalized.includes("destino")
  ) {
    return "normal";
  }

  return "neutral";
};

interface PackageListItem {
  codigo: string;
  displayCodigo: string;
  estado: string;
  sequence: number;
}

const parseSequentialCode = (
  code: string
): { prefix: string; value: number; padding: number } | null => {
  const match = code.match(/^(.*?)(\d+)$/);
  if (!match) {
    return null;
  }

  return {
    prefix: match[1],
    value: Number(match[2]),
    padding: match[2].length,
  };
};

const buildPackageCodeAt = (
  block: BloquePaquetes,
  offset: number
): string => {
  const start = parseSequentialCode(block.codigoInicial);
  const end = parseSequentialCode(block.codigoFinal);

  if (start && end && start.prefix === end.prefix) {
    return `${start.prefix}${String(start.value + offset).padStart(
      start.padding,
      "0"
    )}`;
  }

  if (block.cantidad === 1 || offset === 0) {
    return block.codigoInicial;
  }

  if (offset === block.cantidad - 1) {
    return block.codigoFinal;
  }

  return `${block.codigoInicial} #${offset + 1}`;
};

const formatBagDisplayCode = (shipmentCode: string, sequence: number): string =>
  `${shipmentCode}-BAG-${String(sequence).padStart(3, "0")}`;

const buildPackageItems = (
  blocks: BloquePaquetes[],
  shipmentCode: string
): PackageListItem[] => {
  let sequence = 1;

  return blocks.flatMap((block) =>
    Array.from({ length: Math.max(0, block.cantidad) }, (_, offset) => {
      const packageSequence = sequence++;

      return {
        codigo: buildPackageCodeAt(block, offset),
        displayCodigo: formatBagDisplayCode(shipmentCode, packageSequence),
        estado: block.estado,
        sequence: packageSequence,
      };
    })
  );
};

const buildShipmentRouteLabel = (shipment: EnvioDetalle): string => {
  const airports = shipment.ruta
    .filter((hito) => hito.tipo !== "vuelo")
    .map((hito) => hito.aeropuertoIcao);
  const uniqueAirports = airports.filter(
    (airport, index) => index === 0 || airport !== airports[index - 1]
  );

  if (uniqueAirports.length >= 2) {
    return uniqueAirports.join(" > ");
  }

  return `${shipment.origenIcao} > ${shipment.destinoIcao}`;
};

const buildShipmentRouteSegmentsFromDetail = (
  shipment: EnvioDetalle
): ShipmentRouteSegment[] => {
  const routeAirports = shipment.ruta
    .filter((hito) => hito.tipo !== "vuelo")
    .map((hito) => hito.aeropuertoIcao)
    .filter(Boolean);
  const uniqueAirports = routeAirports.filter(
    (airport, index) => index === 0 || airport !== routeAirports[index - 1]
  );
  const airports =
    uniqueAirports.length >= 2
      ? uniqueAirports
      : [shipment.origenIcao, shipment.destinoIcao];

  return airports.slice(0, -1).map((airport, index) => ({
    fromIcao: airport,
    toIcao: airports[index + 1],
  }));
};

/**
 * Drawer de detalle de envio.
 * Estandar 61 + mockup 06 del Figma.
 *
 * Muestra info del envio, ruta asignada con timeline de hitos,
 * lista de paquetes (en bloques) y tiempo restante para entrega.
 */
const ShipmentDrawer = ({ codigo, idSimulacion }: ShipmentDrawerProps) => {
  const close = useDrawerStore((s) => s.close);
  const focusShipmentRouteSegments = useDrawerStore(
    (s) => s.focusShipmentRouteSegments
  );

  const [shipment, setShipment] = useState<EnvioDetalle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const packageItems = useMemo(
    () => (shipment ? buildPackageItems(shipment.paquetes, shipment.codigo) : []),
    [shipment]
  );
  const packageRouteLabel = useMemo(
    () => (shipment ? buildShipmentRouteLabel(shipment) : ""),
    [shipment]
  );
  const packageRouteSegments = useMemo(
    () => (shipment ? buildShipmentRouteSegmentsFromDetail(shipment) : []),
    [shipment]
  );

  useEffect(() => {
    let cancelled = false;

    const refreshMs =
      idSimulacion != null
        ? PANEL_REFRESH_MS_SIMULATION
        : PANEL_REFRESH_MS_OPERATION;

    const loadShipment = async (showLoading: boolean) => {
      if (showLoading) {
        setIsLoading(true);
      }

      try {
        const data = await getShipmentByCode(codigo, idSimulacion);
        if (cancelled) return;
        setShipment(data);
      } finally {
        if (!cancelled && showLoading) {
          setIsLoading(false);
        }
      }
    };

    void loadShipment(true);
    const intervalId = window.setInterval(() => {
      void loadShipment(false);
    }, refreshMs);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [codigo, idSimulacion]);

  if (isLoading || !shipment) {
    return (
      <DrawerBase eyebrow="Envio" title={codigo} onClose={close}>
        <p className="text-body text-text-primary">Cargando informacion...</p>
      </DrawerBase>
    );
  }

  const estadoLabel =
    shipment.estado === "en_transito"
      ? "En transito"
      : shipment.estado === "en_escala"
      ? "En escala"
      : shipment.estado === "entregado"
      ? "Entregado"
      : shipment.estado === "planificado"
      ? "Planificado"
      : shipment.estado;

  const handleFocusPackageRoute = () => {
    if (packageRouteSegments.length === 0) {
      focusShipmentRouteSegments([
        {
          fromIcao: shipment.origenIcao,
          toIcao: shipment.destinoIcao,
        },
      ]);
      return;
    }

    focusShipmentRouteSegments(packageRouteSegments);
  };

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

      {/* Maletas */}
      <section className="mb-6">
        <h3 className="text-section-title mb-3">
          Maletas ({shipment.cantidadMaletas})
        </h3>
        <ul className="space-y-2">
          {packageItems.map((maleta) => (
            <li
              key={`${maleta.codigo}-${maleta.sequence}`}
              className="rounded-input border border-border bg-card transition-colors hover:border-primary hover:bg-field"
            >
              <button
                type="button"
                className="flex w-full items-start justify-between gap-3 px-3 py-3 text-left"
                onClick={handleFocusPackageRoute}
                aria-label={`Resaltar ruta de la maleta ${maleta.displayCodigo}`}
              >
                <div className="min-w-0">
                  <p className="text-button text-primary hover:underline">
                    {maleta.displayCodigo}
                  </p>
                  <p className="mt-1 text-secondary text-text-primary">
                    {packageRouteLabel}
                  </p>
                  <p className="mt-1 text-secondary text-text-primary">
                    Maleta individual del envio
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Tag variant={getPackageStatusVariant(maleta.estado)}>
                    {maleta.estado}
                  </Tag>
                  <span className="text-secondary text-text-primary">
                    #{maleta.sequence.toLocaleString("es-PE")}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Tiempo restante */}
      <section className="bg-field rounded-card p-4">
        <div className="flex items-center justify-between">
          <span className="text-body text-text-primary">
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
  pendiente: "text-text-primary",
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
  const statusColor = STATUS_COLOR[status] ?? "text-text-primary";
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
        <p className="text-secondary text-text-primary">
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
