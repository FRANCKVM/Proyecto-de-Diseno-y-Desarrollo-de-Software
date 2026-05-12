import { useLiveSimulation } from "@/hooks/useLiveSimulation";

const LiveSimulationManager = () => {
  useLiveSimulation({ autoStart: false, enablePolling: true });
  return null;
};

export default LiveSimulationManager;
