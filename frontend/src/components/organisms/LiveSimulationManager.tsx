import { useLocation } from "react-router-dom";
import { useLiveSimulation } from "@/hooks/useLiveSimulation";

const LiveSimulationManager = () => {
  const { pathname } = useLocation();
  const simulationPageOwnsPolling =
    pathname === "/simulacion/ejecucion" || pathname === "/simulacion/colapso";

  useLiveSimulation({
    autoStart: false,
    pollingMode: simulationPageOwnsPolling ? "none" : "state-only",
  });
  return null;
};

export default LiveSimulationManager;
