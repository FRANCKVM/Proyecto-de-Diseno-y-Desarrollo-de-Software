import { Boxes, Building2, Package, Plane } from "lucide-react";
import type { ReactNode } from "react";
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
  position: "first" | "middle" | "last";
}

const QuickActionButton = ({
  icon,
  label,
  onClick,
  position,
}: QuickActionButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "inline-flex h-11 items-center gap-2 border border-border bg-card px-3 text-button text-text-primary shadow-card",
      "transition-colors hover:bg-field hover:border-primary/40",
      position !== "last" && "border-r-0",
      position === "first" && "rounded-bl-input",
      position === "last" && "rounded-br-none"
    )}
  >
    {icon}
    <span>{label}</span>
  </button>
);

const MapQuickActions = ({
  onOpenActiveFlights,
  onOpenWarehouses,
  onOpenShipments,
  onOpenBaggage,
}: MapQuickActionsProps) => (
  <div className="absolute right-0 top-0 z-[1000] flex flex-nowrap justify-end">
    <QuickActionButton
      icon={<Plane size={16} aria-hidden />}
      label="Vuelos"
      onClick={onOpenActiveFlights}
      position="first"
    />
    <QuickActionButton
      icon={<Building2 size={16} aria-hidden />}
      label="Almacenes"
      onClick={onOpenWarehouses}
      position="middle"
    />
    <QuickActionButton
      icon={<Package size={16} aria-hidden />}
      label="Envios"
      onClick={onOpenShipments}
      position="middle"
    />
    <QuickActionButton
      icon={<Boxes size={16} aria-hidden />}
      label="Maletas"
      onClick={onOpenBaggage}
      position="last"
    />
  </div>
);

export default MapQuickActions;
