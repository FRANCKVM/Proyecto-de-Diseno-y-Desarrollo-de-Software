import { useEffect, useMemo, useState } from "react";
import { Eye, Search } from "lucide-react";
import DrawerBase from "@/components/drawers/DrawerBase";
import Tag from "@/components/atoms/Tag";
import { useDrawerStore } from "@/store/drawerStore";
import {
  buildShipmentRouteSegments,
} from "@/utils/shipmentFocus";
import {
  formatShipmentDisplayCode,
  getShipmentApiIdentifier,
} from "@/utils/shipmentCode";
import { USE_MOCK_DATA } from "@/utils/constants";
import {
  DELIVERY_RELEASE_DELAY_MINUTES,
  EMPTY_SHIPMENT_STATUS_COUNTS,
  SHIPMENT_STATUS_BADGE_LABEL,
  SHIPMENT_STATUS_LABEL,
  SHIPMENT_STATUS_OPTIONS,
  getShipmentStatusTagVariant,
  getShipmentTimelineMinutes,
  resolveShipmentListStatus,
  type ShipmentViewMode,
} from "@/utils/shipmentStatus";
import { listOperationShipmentsPage } from "@/services/operationService";
import { listLiveSimulationShipmentsPage } from "@/services/simulationService";
import {
  formatUtcDateTime,
  formatUtcSimulationMinute,
  parseUtcDateTimeMs,
} from "@/utils/utcDateTime";
import type {
  BackendPagedResponse,
  BackendPageQuery,
  BackendSolicitudEnvio,
} from "@/types/backendSimulation.types";

interface ShipmentOverviewDrawerProps {
  shipments: BackendSolicitudEnvio[];
  idSimulacion?: number | null;
  referenceMinute?: number | null;
  simulationStart?: string | null;
  refreshKey?: number;
  airportOptions?: string[];
}

const SHIPMENT_LIST_PAGE_SIZE = 80;

const getCurrentUtcMinute = (): number => {
  const now = new Date();
  return now.getUTCHours() * 60 + now.getUTCMinutes();
};

const getUtcMinutesSinceShipmentDay = (
  shipment: BackendSolicitudEnvio
): number => {
  const shipmentDayMs = parseUtcDateTimeMs(`${shipment.fecha}T00:00:00`);

  if (shipmentDayMs === null) {
    return getCurrentUtcMinute();
  }

  return Math.floor((Date.now() - shipmentDayMs) / 60_000);
};

const getElapsedMinutes = (
  eventMinute: number | null,
  referenceMinute: number
): number | null => {
  if (eventMinute === null) {
    return null;
  }

  if (referenceMinute < eventMinute) {
    return null;
  }

  return referenceMinute - eventMinute;
};

const formatShipmentDateTime = (fecha: string, hora: string): string => {
  return formatUtcDateTime(
    `${fecha}T${hora}${hora.length === 5 ? ":00" : ""}`,
    `${fecha} ${hora}`
  );
};

const getShipmentCodeLabel = (shipment: BackendSolicitudEnvio): string =>
  shipment.idEnvio !== null
    ? formatShipmentDisplayCode(shipment.idEnvio)
    : `Envío ${shipment.origen.codigo}-${shipment.destino.codigo}`;

const getShipmentKey = (shipment: BackendSolicitudEnvio): string =>
  shipment.idEnvio !== null
    ? `envio-${shipment.idEnvio}`
    : `${shipment.fecha}-${shipment.hora}-${shipment.origen.codigo}-${shipment.destino.codigo}-${shipment.contarBolsas}`;

const getFirstDepartureMinute = (
  shipment: BackendSolicitudEnvio,
  simulationStart?: string | null
): number | null => {
  return getShipmentTimelineMinutes(shipment, simulationStart).firstDeparture;
};

const getLastArrivalMinute = (
  shipment: BackendSolicitudEnvio,
  simulationStart?: string | null
): number | null => {
  return getShipmentTimelineMinutes(shipment, simulationStart).lastArrival;
};

const getDeliveredMinute = (
  shipment: BackendSolicitudEnvio,
  simulationStart?: string | null
): number | null => {
  const lastArrival = getLastArrivalMinute(shipment, simulationStart);
  return lastArrival !== null
    ? lastArrival + DELIVERY_RELEASE_DELAY_MINUTES
    : null;
};

const ShipmentOverviewDrawer = ({
  shipments,
  idSimulacion,
  referenceMinute,
  simulationStart,
  refreshKey = 0,
  airportOptions: airportOptionsProp = [],
}: ShipmentOverviewDrawerProps) => {
  const close = useDrawerStore((s) => s.close);
  const openShipment = useDrawerStore((s) => s.openShipment);
  const focusShipmentRouteSegments = useDrawerStore(
    (s) => s.focusShipmentRouteSegments
  );
  const [mode, setMode] = useState<ShipmentViewMode>("todos");
  const [deliveredHours, setDeliveredHours] = useState(6);
  const [airportFilter, setAirportFilter] = useState("todos");
  const [shipmentSearch, setShipmentSearch] = useState("");
  const [visibleShipmentLimit, setVisibleShipmentLimit] = useState(
    SHIPMENT_LIST_PAGE_SIZE
  );
  const [pagedShipments, setPagedShipments] =
    useState<BackendPagedResponse<BackendSolicitudEnvio> | null>(null);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const usesBackendPaging = !USE_MOCK_DATA;
  const getReferenceMinuteForShipment = (shipment: BackendSolicitudEnvio) =>
    referenceMinute ?? getUtcMinutesSinceShipmentDay(shipment);

  const airportOptions = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...airportOptionsProp,
            ...shipments.map((shipment) => shipment.origen.codigo),
          ]
        )
      ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" })),
    [airportOptionsProp, shipments]
  );

  const shipmentStatus = (shipment: BackendSolicitudEnvio) =>
    resolveShipmentListStatus(
      shipment,
      getReferenceMinuteForShipment(shipment),
      simulationStart
    );
  const registeredShipments = usesBackendPaging
    ? []
    : shipments.filter((shipment) => shipmentStatus(shipment) === "registrados");
  const inTransitShipments = usesBackendPaging
    ? []
    : shipments.filter((shipment) => shipmentStatus(shipment) === "en-transito");
  const plannedShipments = usesBackendPaging
    ? []
    : shipments.filter((shipment) => shipmentStatus(shipment) === "planificados");
  const completedShipments = usesBackendPaging
    ? []
    : shipments.filter((shipment) => shipmentStatus(shipment) === "completados");
  const deliveredShipments = usesBackendPaging
    ? []
    : shipments.filter((shipment) => {
        if (shipmentStatus(shipment) !== "entregados") {
          return false;
        }

        const elapsed = getElapsedMinutes(
          getDeliveredMinute(shipment, simulationStart),
          getReferenceMinuteForShipment(shipment)
        );

        return elapsed !== null && elapsed < deliveredHours * 60;
      });
  const visibleShipmentsByMode =
    mode === "todos"
      ? shipments
      : mode === "registrados"
        ? registeredShipments
      : mode === "planificados"
        ? plannedShipments
        : mode === "en-transito"
        ? inTransitShipments
        : mode === "completados"
        ? completedShipments
        : deliveredShipments;
  const normalizedShipmentSearch = shipmentSearch.trim().toLowerCase();
  const visibleShipments = usesBackendPaging
    ? []
    : visibleShipmentsByMode.filter((shipment) => {
    const matchesAirport =
      airportFilter === "todos" || shipment.origen.codigo === airportFilter;
    const matchesSearch =
      normalizedShipmentSearch.length === 0 ||
      getShipmentCodeLabel(shipment).toLowerCase().includes(normalizedShipmentSearch);

    return matchesAirport && matchesSearch;
  });
  const localPagedShipments = visibleShipments.slice(0, visibleShipmentLimit);
  const visiblePagedShipments = pagedShipments?.items ?? localPagedShipments;
  const totalVisibleShipments = pagedShipments?.totalItems ?? visibleShipments.length;
  const hiddenShipmentCount = Math.max(
    0,
    totalVisibleShipments - visiblePagedShipments.length
  );
  const statusCounts = pagedShipments?.countsByStatus;
  const getStatusCount = (key: ShipmentViewMode, fallback: number) =>
    statusCounts?.[key] ?? fallback;
  const countShipmentsByStatus = (status: Exclude<ShipmentViewMode, "todos">) => {
    switch (status) {
      case "registrados":
        return registeredShipments.length;
      case "planificados":
        return plannedShipments.length;
      case "en-transito":
        return inTransitShipments.length;
      case "completados":
        return completedShipments.length;
      case "entregados":
        return deliveredShipments.length;
    }
  };
  const getShipmentTimeLabel = (
    shipment: BackendSolicitudEnvio,
    status: Exclude<ShipmentViewMode, "todos">
  ) => {
    if (status === "registrados") {
      return "Sin ruta asignada";
    }

    if (status === "planificados") {
      return `Salida: ${formatUtcSimulationMinute(
        getFirstDepartureMinute(shipment, simulationStart),
        simulationStart
      )}`;
    }

    if (status === "en-transito") {
      return `Llegada estimada: ${formatUtcSimulationMinute(
        getLastArrivalMinute(shipment, simulationStart),
        simulationStart
      )}`;
    }

    if (status === "completados") {
      return `Completado: ${formatUtcSimulationMinute(
        getLastArrivalMinute(shipment, simulationStart),
        simulationStart
      )}`;
    }

    return `Entregado: ${formatUtcSimulationMinute(
      getDeliveredMinute(shipment, simulationStart),
      simulationStart
    )}`;
  };

  useEffect(() => {
    setVisibleShipmentLimit(SHIPMENT_LIST_PAGE_SIZE);
  }, [airportFilter, deliveredHours, mode, shipmentSearch]);

  useEffect(() => {
    if (!usesBackendPaging) {
      setPagedShipments(null);
      return;
    }

    let isCancelled = false;
    const params: BackendPageQuery = {
      page: 0,
      size: visibleShipmentLimit,
      codigo: shipmentSearch.trim() || undefined,
      estado: mode,
      aeropuerto: airportFilter,
      direccion: airportFilter === "todos" ? undefined : "salientes",
      horasEntregados: deliveredHours,
    };

    setIsPageLoading(true);
    const request =
      idSimulacion != null
        ? listLiveSimulationShipmentsPage(idSimulacion, params)
        : listOperationShipmentsPage(params);

    request
      .then((response) => {
        if (!isCancelled) {
          setPagedShipments(response);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setPagedShipments({
            items: [],
            page: 0,
            size: visibleShipmentLimit,
            totalItems: 0,
            totalPages: 0,
            hasMore: false,
            countsByStatus: {
              ...EMPTY_SHIPMENT_STATUS_COUNTS,
            },
          });
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsPageLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [
    airportFilter,
    deliveredHours,
    idSimulacion,
    mode,
    refreshKey,
    shipmentSearch,
    usesBackendPaging,
    visibleShipmentLimit,
  ]);

  const handleHoursChange = (value: string) => {
    const nextValue = Number(value);
    if (!Number.isFinite(nextValue)) {
      return;
    }

    setDeliveredHours(Math.min(23, Math.max(1, Math.floor(nextValue))));
  };

  const handleOpenShipment = (
    shipmentCode: string,
    shipment: BackendSolicitudEnvio
  ) => {
    openShipment(
      shipmentCode,
      {
        idSimulacion,
        displayCodigo: getShipmentCodeLabel(shipment),
      }
    );
  };

  const handleFocusShipmentRoute = (shipment: BackendSolicitudEnvio) => {
    focusShipmentRouteSegments(buildShipmentRouteSegments(shipment));
  };

  return (
    <DrawerBase
      title="Panel de envíos"
      hideHeader
      onClose={close}
      footer={
        <div className="flex items-center justify-between text-secondary text-text-primary">
          <span>Envíos mostrados</span>
          <span className="text-button text-text-primary">
            {visiblePagedShipments.length}/{totalVisibleShipments}
          </span>
        </div>
      }
    >
      <div className="mb-5">
        <label
          htmlFor="shipment-status-filter"
          className="block text-label-sm text-text-primary mb-1"
        >
          Filtrar por estado
        </label>
        <select
          id="shipment-status-filter"
          value={mode}
          onChange={(event) => setMode(event.target.value as ShipmentViewMode)}
          className="w-full bg-field border border-border rounded-input px-3 py-2 text-button text-text-primary focus:outline-none focus:border-primary"
        >
          <option value="todos">
            Todos ({getStatusCount("todos", shipments.length)})
          </option>
          {SHIPMENT_STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {SHIPMENT_STATUS_LABEL[status]} ({getStatusCount(status, countShipmentsByStatus(status))})
            </option>
          ))}
        </select>
      </div>

      <div className="mb-5">
        <label
          htmlFor="shipment-search"
          className="block text-label-sm text-text-primary mb-1"
        >
          Buscar envío
        </label>
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
            aria-hidden
          />
          <input
            id="shipment-search"
            type="search"
            value={shipmentSearch}
            onChange={(event) => setShipmentSearch(event.target.value)}
            placeholder="Código de envío"
            className="tasf-input-placeholder w-full bg-field border border-border rounded-input pl-9 pr-3 py-2 text-button text-text-primary focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {mode === "entregados" && (
        <div className="mb-5">
          <label
            htmlFor="delivered-hours"
            className="block text-label-sm text-text-primary mb-1"
          >
            Últimas horas
          </label>
          <input
            id="delivered-hours"
            type="number"
            min={1}
            max={23}
            value={deliveredHours}
            onChange={(event) => handleHoursChange(event.target.value)}
            className="w-full bg-field border border-border rounded-input px-3 py-2 text-button text-text-primary focus:outline-none focus:border-primary"
          />
        </div>
      )}

      <div className="mb-5">
        <label
          htmlFor="shipment-airport-filter"
          className="block text-label-sm text-text-primary mb-1"
        >
          Filtrar por aeropuerto de origen
        </label>
        <select
          id="shipment-airport-filter"
          value={airportFilter}
          onChange={(event) => setAirportFilter(event.target.value)}
          className="w-full bg-field border border-border rounded-input px-3 py-2 text-button text-text-primary focus:outline-none focus:border-primary"
        >
          <option value="todos">Todos</option>
          {airportOptions.map((icao) => (
            <option key={icao} value={icao}>
              {icao}
            </option>
          ))}
        </select>
      </div>

      {isPageLoading && visiblePagedShipments.length === 0 ? (
        <p className="text-body text-text-primary">
          Cargando envíos...
        </p>
      ) : visiblePagedShipments.length === 0 ? (
        <p className="text-body text-text-primary">
          No hay envíos para esta vista.
        </p>
      ) : (
        <ul className="space-y-2">
          {visiblePagedShipments.map((shipment) => {
            const shipmentCode =
              shipment.idEnvio !== null
                ? getShipmentApiIdentifier(shipment.idEnvio)
                : null;
            const derivedStatus = shipmentStatus(shipment);
            const timeLabel = getShipmentTimeLabel(shipment, derivedStatus);

            return (
              <li
                key={getShipmentKey(shipment)}
                className="bg-field rounded-input px-3 py-2 flex items-center justify-between"
              >
                <div>
                  {shipmentCode ? (
                    <button
                      type="button"
                      className="text-button text-primary hover:underline block"
                      onClick={() => handleOpenShipment(shipmentCode, shipment)}
                    >
                      {getShipmentCodeLabel(shipment)}
                    </button>
                  ) : (
                    <p className="text-button text-text-primary">
                      {getShipmentCodeLabel(shipment)}
                    </p>
                  )}
                  <span className="text-secondary text-text-primary">
                    {shipment.origen.codigo} &gt; {shipment.destino.codigo}
                  </span>
                  <span className="text-secondary text-text-primary block">
                    Registro: {formatShipmentDateTime(shipment.fecha, shipment.hora)}
                  </span>
                  <span className="text-secondary text-text-primary block">
                    {timeLabel}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <button
                    type="button"
                    onClick={() => handleFocusShipmentRoute(shipment)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-primary bg-card text-primary transition-colors hover:bg-primary/10"
                    aria-label={`Enfocar ruta de ${getShipmentCodeLabel(shipment)} en el mapa`}
                    title="Ver ruta en el mapa"
                  >
                    <Eye size={16} strokeWidth={2.2} aria-hidden />
                  </button>
                  <Tag
                    variant={getShipmentStatusTagVariant(derivedStatus)}
                  >
                    {SHIPMENT_STATUS_BADGE_LABEL[derivedStatus]}
                  </Tag>
                  <span className="text-secondary text-text-primary">
                    {shipment.contarBolsas} maletas
                  </span>
                </div>
              </li>
            );
          })}
          {hiddenShipmentCount > 0 && (
            <li>
              <button
                type="button"
                onClick={() =>
                  setVisibleShipmentLimit((currentLimit) =>
                    currentLimit + SHIPMENT_LIST_PAGE_SIZE
                  )
                }
                className="mt-2 w-full rounded-input border border-border bg-field px-3 py-2 text-button text-primary hover:border-primary hover:bg-primary-soft transition-colors"
              >
                Mostrar más ({hiddenShipmentCount})
              </button>
            </li>
          )}
        </ul>
      )}
    </DrawerBase>
  );
};

export default ShipmentOverviewDrawer;
