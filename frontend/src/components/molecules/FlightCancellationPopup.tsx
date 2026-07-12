import { X } from "lucide-react";
import { cn } from "@/utils/cn";

interface FlightCancellationPopupProps {
  message: string | null;
  tone?: "warning" | "error" | "success";
  onClose: () => void;
}

const TONE_CLASS = {
  warning: "border-warning/40 bg-warning-soft text-warning",
  error: "border-danger/40 bg-danger/10 text-danger",
  success: "border-success/40 bg-success/10 text-success",
};

const FlightCancellationPopup = ({
  message,
  tone = "warning",
  onClose,
}: FlightCancellationPopupProps) => {
  if (!message) {
    return null;
  }

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      className={cn(
        "fixed right-4 top-16 z-[1300] flex max-w-[360px] items-start gap-3 rounded-card border px-4 py-3 shadow-drawer",
        TONE_CLASS[tone]
      )}
    >
      <p className="text-button leading-snug">{message}</p>
      <button
        type="button"
        onClick={onClose}
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-card/70 transition-colors hover:bg-card"
        aria-label="Cerrar aviso"
        title="Cerrar"
      >
        <X size={14} strokeWidth={2.4} aria-hidden />
      </button>
    </div>
  );
};

export default FlightCancellationPopup;
