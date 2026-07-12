export const formatShipmentDisplayCode = (idEnvio: number): string =>
  idEnvio < 0
    ? `ENV-SIM-${String(Math.abs(idEnvio)).padStart(3, "0")}`
    : `ENV-${String(idEnvio).padStart(3, "0")}`;

export const getShipmentApiIdentifier = (idEnvio: number): string =>
  String(idEnvio);

export const parseShipmentIdentifier = (codigo: string): number | null => {
  const trimmed = codigo.trim();
  const directMatch = trimmed.match(/^-?\d+$/);
  if (directMatch) {
    return Number(trimmed);
  }

  const envMatch = trimmed.match(/^ENV-(-?\d+)$/i);
  if (envMatch) {
    return Number(envMatch[1]);
  }

  const legacyNegativeMatch = trimmed.match(/^ENV-0-(\d+)$/i);
  if (legacyNegativeMatch) {
    return -Number(legacyNegativeMatch[1]);
  }

  return null;
};
