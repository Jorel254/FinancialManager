/**
 * Utilidades de dinero — centavos enteros (sin float).
 * Display sugerido: es-MX / MXN.
 */

export function pesosToCents(pesos: number): number {
  if (!Number.isFinite(pesos)) {
    throw new Error("Monto inválido");
  }
  return Math.round(pesos * 100);
}

export function centsToPesos(cents: number): number {
  return cents / 100;
}

export function formatMxn(cents: number, locale = "es-MX"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "MXN",
  }).format(centsToPesos(cents));
}

export function assertPositiveCents(cents: number): void {
  if (!Number.isInteger(cents) || cents <= 0) {
    throw new Error("El monto debe ser un entero en centavos mayor a 0");
  }
}
