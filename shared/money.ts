/**
 * Utilidades de dinero — centavos enteros (sin float).
 * Display sugerido: es-MX / MXN.
 */

/** Convierte pesos (número) a centavos redondeando a 2 decimales vía string. */
export function pesosToCents(pesos: number): number {
  if (!Number.isFinite(pesos)) {
    throw new Error("Monto inválido");
  }
  return parsePesosDecimalString(pesos.toFixed(2));
}

/**
 * Parsea un decimal en texto (`1234.56` o `1234`) a centavos enteros
 * sin pasar por aritmética flotante.
 */
export function parsePesosDecimalString(normalized: string): number {
  const match = /^(-?)(\d+)(?:\.(\d{0,2}))?$/.exec(normalized);
  if (!match) {
    throw new Error("Monto inválido");
  }
  const sign = match[1] === "-" ? -1 : 1;
  const whole = Number(match[2]);
  const frac = (match[3] ?? "").padEnd(2, "0").slice(0, 2);
  return sign * (whole * 100 + Number(frac));
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
