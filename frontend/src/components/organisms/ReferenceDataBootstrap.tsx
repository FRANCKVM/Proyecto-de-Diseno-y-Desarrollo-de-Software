import { useEffect } from "react";
import { initializeReferenceData } from "@/store/referenceDataStore";

const ReferenceDataBootstrap = () => {
  useEffect(() => {
    void initializeReferenceData();
  }, []);

  return null;
};

export default ReferenceDataBootstrap;
