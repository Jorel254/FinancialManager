/**
 * Wrappers tipados sobre window.api (preload).
 * Etapa 2+: usar FinancialManagerApi de shared/ipc-contract.ts
 */
import type { FinancialManagerApi } from "../../shared/ipc-contract";

export function getApi(): FinancialManagerApi {
  if (!window.api) {
    throw new Error(
      "window.api no está disponible. ¿Se cargó el preload de Electron?",
    );
  }
  return window.api;
}
