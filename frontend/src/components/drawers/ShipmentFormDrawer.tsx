import DrawerBase from "@/components/drawers/DrawerBase";
import ShipmentRegistrationForm from "@/components/organisms/ShipmentRegistrationForm";
import { useDrawerStore } from "@/store/drawerStore";
import type { AirportWithCoords } from "@/types/airport.types";

interface ShipmentFormDrawerProps {
  airports: AirportWithCoords[];
  occupancyByIcao?: Record<string, number>;
  onCreated?: () => Promise<void> | void;
}

const ShipmentFormDrawer = ({
  airports,
  occupancyByIcao,
  onCreated,
}: ShipmentFormDrawerProps) => {
  const close = useDrawerStore((s) => s.close);

  return (
    <DrawerBase eyebrow="Nuevo envio" title="Registrar envio" onClose={close}>
      <section className="space-y-4">
        <p className="text-secondary text-text-primary">
          El origen se toma automaticamente desde la zona horaria del navegador.
          Selecciona destino y cantidad de maletas.
        </p>
        <ShipmentRegistrationForm
          airports={airports}
          occupancyByIcao={occupancyByIcao}
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
