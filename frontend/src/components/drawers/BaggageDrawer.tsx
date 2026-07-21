import { useEffect, useMemo, useState } from "react";
import { Eye, Search } from "lucide-react";
import DrawerBase from "@/components/drawers/DrawerBase";
import Tag from "@/components/atoms/Tag";
import { useDrawerStore } from "@/store/drawerStore";
import { getShipmentRouteGroups } from "@/utils/shipmentAssignments";
import {
  buildRouteSegments,
  type ShipmentRouteSegment,
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
import { listOperationBaggagePage } from "@/services/operationService";
import { listLiveSimulationBaggagePage } from "@/services/simulationService";
import { parseUtcDateTimeMs } from "@/utils/utcDateTime";
import type {
  BackendBaggageItem,
  BackendPagedResponse,
  BackendPageQuery,
  BackendSolicitudEnvio,
} from "@/types/backendSimulation.types";

interface BaggageDrawerProps {
  shipments: BackendSolicitudEnvio[];
  idSimulacion?: number | null;
  referenceMinute?: number | null;
  simulationStart?: string | null;
  refreshKey?: number;
  airportOptions?: string[];
}

const BAGGAGE_LIST_PAGE_SIZE = 100;

const getShipmentCodeLabel = (shipment: BackendSolicitudEnvio): string =>
  shipment.idEnvio !== null
    ? formatShipmentDisplayCode(shipment.idEnvio)
    : `Envío ${shipment.origen.codigo}-${shipment.destino.codigo}`;

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
  if (eventMinute === null || referenceMinute < eventMinute) {
    return null;
  }

  return referenceMinute - eventMinute;
};

const getLastArrivalMinute = (
  shipment: BackendSolicitudEnvio,
  simulationStart?: string | null
): number | null => getShipmentTimelineMinutes(shipment, simulationStart).lastArrival;

const getDeliveredMinute = (
  shipment: BackendSolicitudEnvio,
  simulationStart?: string | null
): number | null => {
  const lastArrival = getLastArrivalMinute(shipment, simulationStart);
  return lastArrival !== null
    ? lastArrival + DELIVERY_RELEASE_DELAY_MINUTES
    : null;
};

const countBags = (shipments: BackendSolicitudEnvio[]): number =>
  shipments.reduce((total, shipment) => total + (shipment.contarBolsas ?? 0), 0);

interface VirtualBaggageItem {
  id: string;
  shipment: BackendSolicitudEnvio;
  shipmentCode: string;
  bagIndex: number;
  routeLabel: string;
  routeSegments: ShipmentRouteSegment[];
  assigned: boolean;
  status: Exclude<ShipmentViewMode, "todos">;
}

type DisplayBaggageItem = VirtualBaggageItem | BackendBaggageItem;

interface VirtualBaggageResult {
  items: VirtualBaggageItem[];
  total: number;
}

const isBackendBaggageItem = (
  bag: DisplayBaggageItem
): bag is BackendBaggageItem => "shipmentId" in bag;

const formatBagCode = (shipment: BackendSolicitudEnvio, bagIndex: number): string => {
  const shipmentCode =
    shipment.idEnvio !== null
      ? formatShipmentDisplayCode(shipment.idEnvio)
      : `ENV-${shipment.origen.codigo}-${shipment.destino.codigo}`;

  return `${shipmentCode}-BAG-${String(bagIndex).padStart(3, "0")}`;
};

const buildRouteLabel = (
  segments: ShipmentRouteSegment[],
  shipment: BackendSolicitudEnvio
): string => {
  if (segments.length === 0) {
    return `${shipment.origen.codigo} > ${shipment.destino.codigo}`;
  }

  const points = [segments[0].fromIcao, ...segments.map((segment) => segment.toIcao)];
  return points.join(" > ");
};

const buildVirtualBaggageItems = (
  shipments: BackendSolicitudEnvio[],
  getStatus: (shipment: BackendSolicitudEnvio) => Exclude<ShipmentViewMode, "todos">,
  limit = Number.POSITIVE_INFINITY,
  searchQuery = ""
): VirtualBaggageResult => {
  const items: VirtualBaggageItem[] = [];
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const hasSearch = normalizedSearch.length > 0;
  let total = hasSearch ? 0 : countBags(shipments);

  const addMatchingItem = (
    bagCode: string,
    buildItem: () => VirtualBaggageItem
  ): boolean => {
    if (hasSearch && !bagCode.toLowerCase().includes(normalizedSearch)) {
      return false;
    }

    if (hasSearch) {
      total += 1;
    }

    if (items.length < limit) {
      items.push(buildItem());
    }

    return !hasSearch && items.length >= limit;
  };

  outer:
  for (const shipment of shipments) {
    const shipmentCode = getShipmentCodeLabel(shipment);
    const totalBags = shipment.contarBolsas ?? 0;
    const groups = getShipmentRouteGroups(shipment);
    let status: Exclude<ShipmentViewMode, "todos"> | null = null;
    const resolveStatus = () => {
      status ??= getStatus(shipment);
      return status;
    };
    let nextBagIndex = 1;

    for (const group of groups) {
      const quantity = Math.max(0, group.cantidadBolsas ?? 0);
      const start = nextBagIndex;
      const end = Math.min(totalBags, nextBagIndex + quantity - 1);
      let routeSegments: ShipmentRouteSegment[] | null = null;
      let routeLabel: string | null = null;

      for (let bagIndex = start; bagIndex <= end; bagIndex++) {
        const bagCode = formatBagCode(shipment, bagIndex);
        const shouldStop = addMatchingItem(bagCode, () => {
          routeSegments ??= buildRouteSegments(group.ruta, {
            fromIcao: shipment.origen.codigo,
            toIcao: shipment.destino.codigo,
          });
          routeLabel ??= buildRouteLabel(routeSegments, shipment);

          return {
            id: bagCode,
            shipment,
            shipmentCode,
            bagIndex,
            routeLabel,
            routeSegments,
            assigned: true,
            status: resolveStatus(),
          };
        });

        if (shouldStop) {
          break outer;
        }
      }

      nextBagIndex = end + 1;
    }

    for (let bagIndex = nextBagIndex; bagIndex <= totalBags; bagIndex++) {
      const bagCode = formatBagCode(shipment, bagIndex);
      const shouldStop = addMatchingItem(bagCode, () => ({
          id: bagCode,
          shipment,
          shipmentCode,
          bagIndex,
          routeLabel: `${shipment.origen.codigo} > ${shipment.destino.codigo}`,
          routeSegments: [],
          assigned: false,
          status: resolveStatus(),
      }));

      if (shouldStop) {
        break outer;
      }
    }
  }

  return { items, total };
};

const BaggageDrawer = ({
  shipments,
  idSimulacion,
  referenceMinute,
  simulationStart,
  refreshKey = 0,
  airportOptions: airportOptionsProp = [],
}: BaggageDrawerProps) => {
  const close = useDrawerStore((s) => s.close);
  const openShipment = useDrawerStore((s) => s.openShipment);
  const focusShipmentRouteSegments = useDrawerStore(
    (s) => s.focusShipmentRouteSegments
  );
  const [mode, setMode] = useState<ShipmentViewMode>("todos");
  const [deliveredHours, setDeliveredHours] = useState(6);
  const [airportFilter, setAirportFilter] = useState("todos");
  const [baggageSearch, setBaggageSearch] = useState("");
  const [visibleBaggageLimit, setVisibleBaggageLimit] = useState(
    BAGGAGE_LIST_PAGE_SIZE
  );
  const [pagedBaggage, setPagedBaggage] =
    useState<BackendPagedResponse<BackendBaggageItem> | null>(null);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const usesBackendPaging = !USE_MOCK_DATA;

  const getReferenceMinuteForShipment = (shipment: BackendSolicitudEnvio) =>
    referenceMinute ?? getUtcMinutesSinceShipmentDay(shipment);

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
  const airportOptions = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...airportOptionsProp,
            ...shipments.flatMap((shipment) => [
              shipment.origen.codigo,
              shipment.destino.codigo,
            ]),
          ]
        )
      ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" })),
    [airportOptionsProp, shipments]
  );
  const visibleShipments = usesBackendPaging
    ? []
    : airportFilter === "todos"
      ? visibleShipmentsByMode
      : visibleShipmentsByMode.filter(
          (shipment) =>
            shipment.origen.codigo === airportFilter ||
            shipment.destino.codigo === airportFilter
        );
  const baggageResult = usesBackendPaging
    ? { items: [], total: 0 }
    : buildVirtualBaggageItems(
        visibleShipments,
        shipmentStatus,
        visibleBaggageLimit,
        baggageSearch
      );
  const baggageItems: DisplayBaggageItem[] =
    pagedBaggage?.items ?? baggageResult.items;
  const totalVisibleBaggageCount =
    pagedBaggage?.totalItems ?? baggageResult.total;
  const hiddenBaggageCount = Math.max(
    0,
    totalVisibleBaggageCount - baggageItems.length
  );
  const statusCounts = pagedBaggage?.countsByStatus;
  const getStatusCount = (key: ShipmentViewMode, fallback: number) =>
    statusCounts?.[key] ?? fallback;

  useEffect(() => {
    setVisibleBaggageLimit(BAGGAGE_LIST_PAGE_SIZE);
  }, [airportFilter, baggageSearch, deliveredHours, mode]);

  useEffect(() => {
    if (!usesBackendPaging) {
      setPagedBaggage(null);
      return;
    }

    let isCancelled = false;
    const params: BackendPageQuery = {
      page: 0,
      size: visibleBaggageLimit,
      codigo: baggageSearch.trim() || undefined,
      estado: mode,
      aeropuerto: airportFilter,
      horasEntregados: deliveredHours,
    };

    setIsPageLoading(true);
    const request =
      idSimulacion != null
        ? listLiveSimulationBaggagePage(idSimulacion, params)
        : listOperationBaggagePage(params);

    request
      .then((response) => {
        if (!isCancelled) {
          setPagedBaggage(response);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setPagedBaggage({
            items: [],
            page: 0,
            size: visibleBaggageLimit,
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
    baggageSearch,
    deliveredHours,
    idSimulacion,
    mode,
    refreshKey,
    usesBackendPaging,
    visibleBaggageLimit,
  ]);

  const handleHoursChange = (value: string) => {
    const nextValue = Number(value);
    if (!Number.isFinite(nextValue)) {
      return;
    }

    setDeliveredHours(Math.min(23, Math.max(1, Math.floor(nextValue))));
  };

  const countBagsByStatus = (status: Exclude<ShipmentViewMode, "todos">) => {
    switch (status) {
      case "registrados":
        return countBags(registeredShipments);
      case "planificados":
        return countBags(plannedShipments);
      case "en-transito":
        return countBags(inTransitShipments);
      case "completados":
        return countBags(completedShipments);
      case "entregados":
        return countBags(deliveredShipments);
    }
  };

  const handleOpenShipment = (bag: DisplayBaggageItem) => {
    if (isBackendBaggageItem(bag)) {
      if (!bag.shipmentApiCode) {
        return;
      }

      openShipment(bag.shipmentApiCode, {
        idSimulacion,
        displayCodigo: bag.shipmentCode,
      });
      return;
    }

    if (bag.shipment.idEnvio === null) {
      return;
    }

    openShipment(getShipmentApiIdentifier(bag.shipment.idEnvio), {
      idSimulacion,
      displayCodigo: getShipmentCodeLabel(bag.shipment),
    });
  };

  const handleFocusBag = (bag: DisplayBaggageItem) => {
    if (bag.routeSegments.length === 0) {
      if (isBackendBaggageItem(bag)) {
        focusShipmentRouteSegments([
          {
            fromIcao: bag.originIcao,
            toIcao: bag.destinationIcao,
          },
        ]);
        return;
      }

      focusShipmentRouteSegments([
        {
          fromIcao: bag.shipment.origen.codigo,
          toIcao: bag.shipment.destino.codigo,
        },
      ]);
      return;
    }

    focusShipmentRouteSegments(bag.routeSegments);
  };

  return (
    <DrawerBase
      title="Panel de maletas"
      hideHeader
      onClose={close}
      footer={
        <div className="flex items-center justify-between text-secondary text-text-primary">
          <span>Maletas mostradas</span>
          <span className="text-button text-text-primary">
            {baggageItems.length}/{totalVisibleBaggageCount}
          </span>
        </div>
      }
    >
      <div className="mb-5">
        <label
          htmlFor="baggage-status-filter"
          className="block text-label-sm text-text-primary mb-1"
        >
          Filtrar por estado
        </label>
        <select
          id="baggage-status-filter"
          value={mode}
          onChange={(event) => setMode(event.target.value as ShipmentViewMode)}
          className="w-full bg-field border border-border rounded-input px-3 py-2 text-button text-text-primary focus:outline-none focus:border-primary"
        >
          <option value="todos">
            Todos ({getStatusCount("todos", countBags(shipments))})
          </option>
          {SHIPMENT_STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {SHIPMENT_STATUS_LABEL[status]} ({getStatusCount(status, countBagsByStatus(status))})
            </option>
          ))}
        </select>
      </div>

      <div className="mb-5">
        <label
          htmlFor="baggage-search"
          className="block text-label-sm text-text-primary mb-1"
        >
          Buscar maleta
        </label>
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
            aria-hidden
          />
          <input
            id="baggage-search"
            type="search"
            value={baggageSearch}
            onChange={(event) => setBaggageSearch(event.target.value)}
            placeholder="Código de maleta"
            className="tasf-input-placeholder w-full bg-field border border-border rounded-input pl-9 pr-3 py-2 text-button text-text-primary focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {mode === "entregados" && (
        <div className="mb-5">
          <label
            htmlFor="baggage-delivered-hours"
            className="block text-label-sm text-text-primary mb-1"
          >
            Últimas horas
          </label>
          <input
            id="baggage-delivered-hours"
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
          htmlFor="baggage-airport-filter"
          className="block text-label-sm text-text-primary mb-1"
        >
          Filtrar por aeropuerto
        </label>
        <select
          id="baggage-airport-filter"
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

      {isPageLoading && baggageItems.length === 0 ? (
        <p className="text-body text-text-primary">
          Cargando maletas...
        </p>
      ) : baggageItems.length === 0 ? (
        <p className="text-body text-text-primary">
          No hay maletas registradas para esta vista.
        </p>
      ) : (
        <ul className="space-y-2">
          {baggageItems.map((bag) => {
            const canOpen = isBackendBaggageItem(bag)
              ? Boolean(bag.shipmentApiCode)
              : bag.shipment.idEnvio !== null;
            const legs = bag.routeSegments.length;

            return (
              <li
                key={bag.id}
                className="rounded-input border border-border bg-card px-3 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-button text-text-primary">
                      {bag.id}
                    </p>
                    <p className="mt-1 text-secondary text-text-primary">
                      {bag.routeLabel}
                    </p>
                    <p className="mt-1 text-secondary text-text-primary">
                      {bag.assigned ? `${legs} tramo(s) de ruta` : "Sin ruta asignada"}
                    </p>
                    {canOpen ? (
                      <button
                        type="button"
                        className="mt-2 text-secondary text-primary hover:underline"
                        onClick={() => handleOpenShipment(bag)}
                      >
                        Ver envío completo ({bag.shipmentCode})
                      </button>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <button
                      type="button"
                      onClick={() => handleFocusBag(bag)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-primary bg-card text-primary transition-colors hover:bg-primary/10"
                      aria-label={`Enfocar ruta de ${bag.id} en el mapa`}
                      title="Ver ruta en el mapa"
                    >
                      <Eye size={16} strokeWidth={2.2} aria-hidden />
                    </button>
                    <Tag
                      variant={getShipmentStatusTagVariant(bag.status)}
                    >
                      {SHIPMENT_STATUS_BADGE_LABEL[bag.status]}
                    </Tag>
                    <span className="text-secondary text-text-primary">
                      #{bag.bagIndex.toLocaleString("es-PE")}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
          {hiddenBaggageCount > 0 && (
            <li>
              <button
                type="button"
                onClick={() =>
                  setVisibleBaggageLimit((currentLimit) =>
                    currentLimit + BAGGAGE_LIST_PAGE_SIZE
                  )
                }
                className="mt-2 w-full rounded-input border border-border bg-field px-3 py-2 text-button text-primary hover:border-primary hover:bg-primary-soft transition-colors"
              >
                Mostrar más ({hiddenBaggageCount})
              </button>
            </li>
          )}
        </ul>
      )}
    </DrawerBase>
  );
};

export default BaggageDrawer;
