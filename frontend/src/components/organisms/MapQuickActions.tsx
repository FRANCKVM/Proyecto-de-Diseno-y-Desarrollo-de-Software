import { Boxes, Building2, Package, Plane } from "lucide-react";
import type { ReactNode } from "react";
import { useDrawerStore, type DrawerSelection } from "@/store/drawerStore";
import { cn } from "@/utils/cn";

interface MapQuickActionsProps {
  onOpenActiveFlights?: () => void;
  onOpenWarehouses?: () => void;
  onOpenShipments?: () => void;
  onOpenBaggage?: () => void;
}

interface QuickActionButtonProps {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
  position: "first" | "middle" | "last";
}

const QuickActionButton = ({
  icon,
  label,
  onClick,
  active = false,
  position,
}: QuickActionButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={cn(
      "relative inline-flex h-11 items-center gap-2 border px-3 text-button shadow-card",
      "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
      active
        ? "z-10 border-primary bg-primary-soft text-primary"
        : "border-border bg-card text-text-primary hover:bg-field hover:border-primary/40",
      position !== "last" && !active && "border-r-0",
      position === "first" && "rounded-bl-input",
      position === "last" && "rounded-br-none"
    )}
  >
    {icon}
    <span>{label}</span>
    {active && (
      <span
        className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-primary"
        aria-hidden
      />
    )}
  </button>
);

const isQuickPanelActive = (
  selection: DrawerSelection,
  type: NonNullable<DrawerSelection>["type"]
) => selection?.type === type;

const MapQuickActions = ({
  onOpenActiveFlights,
  onOpenWarehouses,
  onOpenShipments,
  onOpenBaggage,
}: MapQuickActionsProps) => {
  const selection = useDrawerStore((s) => s.selection);
  const close = useDrawerStore((s) => s.close);

  const handlePanelClick = (
    type: NonNullable<DrawerSelection>["type"],
    openPanel?: () => void
  ) => {
    if (isQuickPanelActive(selection, type)) {
      close();
      return;
    }

    openPanel?.();
  };

  return (
    <div className="absolute right-0 top-0 z-[1000] flex flex-nowrap justify-end">
      <QuickActionButton
        icon={<Plane size={16} aria-hidden />}
        label="Vuelos"
        active={isQuickPanelActive(selection, "active-flights-panel")}
        onClick={() => handlePanelClick("active-flights-panel", onOpenActiveFlights)}
        position="first"
      />
      <QuickActionButton
        icon={<Building2 size={16} aria-hidden />}
        label="Almacenes"
        active={isQuickPanelActive(selection, "warehouse-list")}
        onClick={() => handlePanelClick("warehouse-list", onOpenWarehouses)}
        position="middle"
      />
      <QuickActionButton
        icon={<Package size={16} aria-hidden />}
        label="Envios"
        active={isQuickPanelActive(selection, "shipments-panel")}
        onClick={() => handlePanelClick("shipments-panel", onOpenShipments)}
        position="middle"
      />
      <QuickActionButton
        icon={<Boxes size={16} aria-hidden />}
        label="Maletas"
        active={isQuickPanelActive(selection, "baggage-panel")}
        onClick={() => handlePanelClick("baggage-panel", onOpenBaggage)}
        position="last"
      />
    </div>
  );
};

export default MapQuickActions;
