import DrawerBase from "@/components/drawers/DrawerBase";
import ShipmentRegistrationForm from "@/components/organisms/ShipmentRegistrationForm";
import { useDrawerStore } from "@/store/drawerStore";
import type { AirportWithCoords } from "@/types/airport.types";

interface ShipmentFormDrawerProps {
  airports: AirportWithCoords[];
  onCreated?: () => Promise<void> | void;
}

const ShipmentFormDrawer = ({
  airports,
  onCreated,
}: ShipmentFormDrawerProps) => {
  const close = useDrawerStore((s) => s.close);

  return (
    <DrawerBase eyebrow="Nuevo envio" title="Registrar envio" onClose={close}>
      <section className="space-y-4">
        <p className="text-secondary text-text-secondary">
          Selecciona origen, destino y cantidad de maletas. El plazo se define
          automaticamente en backend.
        </p>
        <ShipmentRegistrationForm
          airports={airports}
          onCreated={async () => {
            await onCreated?.();
            close();
          }}
          onCancel={close}
        />
      </section>
    </DrawerBase>
  );
};

export default ShipmentFormDrawer;
