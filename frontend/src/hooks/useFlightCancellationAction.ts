import { useEffect, useState } from "react";
import { cancelFlightOccurrence } from "@/services/flightService";
import { useCancellationAnimationStore } from "@/store/cancellationAnimationStore";
import { resolveFlightCancellationTiming } from "@/utils/flightCancellation";
import type { VueloDetalle } from "@/types/flight.types";

interface CancelFlightInput {
  actionKey: string;
  idOcurrencia: number;
  fechaSalida: string;
  departureMinute?: number;
  fallbackAirportIcao?: string | null;
  fallbackFlightCode?: string | null;
  onCancelled?: (result: {
    updatedFlight: VueloDetalle;
    shiftedToNextDay: boolean;
  }) => void;
}

interface UseFlightCancellationActionOptions {
  idSimulacion?: number | null;
  referenceMinute?: number | null;
  simulationStart?: string | null;
}

export const useFlightCancellationAction = ({
  idSimulacion,
  referenceMinute,
  simulationStart,
}: UseFlightCancellationActionOptions) => {
  const addFlightCancellationEvent = useCancellationAnimationStore(
    (s) => s.addFlightCancellationEvent
  );
  const [cancellingFlightKey, setCancellingFlightKey] = useState<string | null>(
    null
  );
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelNotice, setCancelNotice] = useState<{
    actionKey: string;
    message: string;
  } | null>(null);
  const [cancelPopup, setCancelPopup] = useState<{
    message: string;
    tone: "warning" | "error" | "success";
  } | null>(null);

  useEffect(() => {
    if (!cancelPopup) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCancelPopup(null);
    }, 3000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [cancelPopup]);

  const cancelFlight = async ({
    actionKey,
    idOcurrencia,
    fechaSalida,
    departureMinute,
    fallbackAirportIcao,
    fallbackFlightCode,
    onCancelled,
  }: CancelFlightInput) => {
    setCancelError(null);
    setCancelNotice(null);
    setCancelPopup(null);

    try {
      const cancellationTiming = resolveFlightCancellationTiming({
        fechaSalida,
        idSimulacion,
        referenceMinute,
        departureMinute,
        simulationStart,
      });

      setCancellingFlightKey(actionKey);
      const updatedFlight = await cancelFlightOccurrence(idOcurrencia, idSimulacion);

      if (cancellationTiming.shiftedToNextDay) {
        const message =
          cancellationTiming.notice ??
          "El vuelo actual esta dentro de la ultima hora antes del despegue. Se cancelo la siguiente ocurrencia.";
        setCancelPopup({
          tone: "warning",
          message,
        });
      } else {
        setCancelPopup({
          tone: "success",
          message: "Vuelo cancelado correctamente.",
        });
      }

      onCancelled?.({
        updatedFlight,
        shiftedToNextDay: cancellationTiming.shiftedToNextDay,
      });
      addFlightCancellationEvent({
        airportIcao: updatedFlight.origenIcao || fallbackAirportIcao || "",
        flightCode: updatedFlight.codigo || fallbackFlightCode,
      });
    } catch (error: any) {
      const message =
        typeof error?.response?.data === "string"
          ? error.response.data
          : "No se pudo cancelar el vuelo.";
      setCancelError(message);
      setCancelPopup({
        tone: "error",
        message,
      });
    } finally {
      setCancellingFlightKey(null);
    }
  };

  return {
    cancelFlight,
    cancellingFlightKey,
    cancelError,
    cancelNotice,
    cancelPopup,
    dismissCancelPopup: () => setCancelPopup(null),
  };
};
