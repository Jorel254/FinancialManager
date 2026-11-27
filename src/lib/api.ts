import type { FinancialManagerApi } from "@shared/ipc-contract";

export function getApi(): FinancialManagerApi {
  if (!window.api) {
    throw new Error(
      "window.api no está disponible. ¿Se cargó el preload de Electron?",
    );
  }
  return window.api;
}

export function hasApi(): boolean {
  return typeof window !== "undefined" && Boolean(window.api);
}
